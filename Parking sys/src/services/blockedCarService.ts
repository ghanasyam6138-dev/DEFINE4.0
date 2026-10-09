import type { BlockedCarIncident, StaffTask, IncidentStage } from '../types';
import { dbService } from './dbService';
import { normalizePlateNumber, maskMobile } from './cryptoService';

export class BlockedCarService {
  /**
   * Reports a blocked car incident.
   * Searches for active booking matching the blocking vehicle plate.
   * If found: starts staged escalation (Push -> SMS -> Masked Call -> Staff Dispatch).
   * If not found: immediately dispatches staff task!
   */
  public reportBlockedCar(params: {
    parkingAreaId: string;
    slotNumber: string;
    blockingPlate: string;
    reportedByCustomerId: string;
    reportedByCustomerMobile: string;
    description?: string;
    photoUrl?: string;
  }): { success: boolean; incident?: BlockedCarIncident; error?: string } {
    const area = dbService.getParkingAreaById(params.parkingAreaId);
    if (!area) return { success: false, error: 'Parking facility not found.' };

    const plateInfo = normalizePlateNumber(params.blockingPlate);
    if (!plateInfo.isValid) {
      return { success: false, error: 'Please enter a valid vehicle license plate number.' };
    }

    const now = new Date().toISOString();
    const incidentId = `inc-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const incidentNumber = `INC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Search for active booking or visit with this normalized plate in the same facility
    const allBookings = dbService.getBookings(undefined, params.parkingAreaId);
    const allVisits = dbService.getVisits(undefined, params.parkingAreaId);

    const matchedBooking = allBookings.find(
      b => b.vehiclePlateNormalized === plateInfo.normalized &&
           (b.status === 'active_inside' || b.status === 'reserved')
    );

    const matchedVisit = allVisits.find(
      v => v.vehiclePlateNormalized === plateInfo.normalized &&
           (v.status === 'active' || v.status === 'exit_pass_issued')
    );

    let driverUserId: string | undefined;
    let driverMobileMasked: string | undefined;
    let matchedId: string | undefined;

    if (matchedBooking) {
      driverUserId = matchedBooking.customerId;
      driverMobileMasked = maskMobile(matchedBooking.customerMobile);
      matchedId = matchedBooking.id;
    } else if (matchedVisit) {
      driverUserId = matchedVisit.customerId;
      driverMobileMasked = matchedVisit.customerMobileMasked;
      matchedId = matchedVisit.bookingId;
    }

    const hasMatch = !!(matchedBooking || matchedVisit);
    const initialStage: IncidentStage = hasMatch ? 'push_notified' : 'staff_dispatched';

    const incident: BlockedCarIncident = {
      id: incidentId,
      incidentNumber,
      parkingAreaId: params.parkingAreaId,
      parkingAreaName: area.name,
      slotNumber: params.slotNumber,
      reportedByCustomerId: params.reportedByCustomerId,
      reportedByCustomerMobileMasked: maskMobile(params.reportedByCustomerMobile),
      reportedAt: now,
      blockingPlate: plateInfo.display,
      blockingPlateNormalized: plateInfo.normalized,
      description: params.description,
      photoUrl: params.photoUrl,
      matchedBookingId: matchedId,
      driverUserId,
      driverMobileMasked,
      currentStage: initialStage,
      stageTimestamps: {
        initial_search: now,
        [initialStage]: now
      },
      gracePeriodUsed: false,
      isSimulated: true,
      auditTrail: [
        {
          timestamp: now,
          action: 'INCIDENT_CREATED',
          actor: `Customer (${maskMobile(params.reportedByCustomerMobile)})`,
          details: `Reported vehicle ${plateInfo.display} blocking bay ${params.slotNumber}`
        }
      ]
    };

    if (hasMatch) {
      incident.auditTrail.push({
        timestamp: now,
        action: 'MATCH_FOUND_STAGE_1_PUSH_SENT',
        actor: 'Escalation Engine',
        details: `Active vehicle record matched. Staged Push Notification sent to driver device.`
      });
    } else {
      // No match found -> dispatch staff immediately
      incident.auditTrail.push({
        timestamp: now,
        action: 'NO_MATCH_IMMEDIATE_STAFF_DISPATCH',
        actor: 'Escalation Engine',
        details: 'No registered booking found for this plate. Urgent staff task dispatched to Bay ' + params.slotNumber
      });

      this.createStaffTaskForIncident(incident, 'urgent', 'No registered booking found. Urgent on-site inspection required.');
    }

    dbService.saveIncident(incident);

    dbService.addAuditLog({
      actorId: params.reportedByCustomerId,
      actorName: 'Reporting Customer',
      actorRole: 'customer',
      action: 'BLOCKED_CAR_REPORTED',
      parkingAreaId: params.parkingAreaId,
      targetResource: `Slot ${params.slotNumber}`,
      details: `Reported blocking vehicle ${plateInfo.display} (${matchedBooking ? 'Driver matched' : 'Unregistered vehicle'}). Incident #${incidentNumber}`
    });

    return { success: true, incident };
  }

  /**
   * Advances an incident through its staged escalation:
   * push_notified -> (30s) -> sms_sent -> (timeout) -> voice_call_initiated -> staff_dispatched
   */
  public advanceEscalation(incidentId: string): { success: boolean; incident?: BlockedCarIncident } {
    const incident = dbService.getIncidentById(incidentId);
    if (!incident) return { success: false };
    if (incident.currentStage === 'acknowledged' || incident.currentStage === 'resolved') {
      return { success: false, incident };
    }

    const now = new Date().toISOString();

    if (incident.currentStage === 'push_notified') {
      incident.currentStage = 'sms_sent';
      incident.stageTimestamps.sms_sent = now;
      incident.auditTrail.push({
        timestamp: now,
        action: 'STAGE_2_SMS_ESCALATION',
        actor: 'Escalation Engine',
        details: '30-second push window expired without response. Sending urgent SMS with expiring action link.'
      });
    } else if (incident.currentStage === 'sms_sent') {
      incident.currentStage = 'voice_call_initiated';
      incident.stageTimestamps.voice_call_initiated = now;
      incident.auditTrail.push({
        timestamp: now,
        action: 'STAGE_3_MASKED_VOICE_CALL',
        actor: 'Escalation Engine',
        details: 'SMS unacknowledged. Initiating automated masked voice call with recorded advisory.'
      });
    } else if (incident.currentStage === 'voice_call_initiated') {
      incident.currentStage = 'staff_dispatched';
      incident.stageTimestamps.staff_dispatched = now;
      incident.auditTrail.push({
        timestamp: now,
        action: 'STAGE_4_STAFF_DISPATCHED',
        actor: 'Escalation Engine',
        details: 'Driver call unanswered/unacknowledged. Dispatching on-duty parking marshall to bay.'
      });
      this.createStaffTaskForIncident(incident, 'urgent', 'Automated escalation reached Stage 4. Driver unresponsive.');
    }

    dbService.saveIncident(incident);
    return { success: true, incident };
  }

  /**
   * Directly jumps to a target escalation stage for evaluation/demo purposes.
   */
  public jumpToStage(incidentId: string, targetStage: IncidentStage): { success: boolean; incident?: BlockedCarIncident; error?: string } {
    const incident = dbService.getIncidentById(incidentId);
    if (!incident) return { success: false, error: 'Incident not found' };

    const now = new Date().toISOString();
    incident.currentStage = targetStage;
    incident.stageTimestamps[targetStage] = now;

    const descriptions: Record<IncidentStage, string> = {
      initial_search: 'Demo jumped to Initial Search stage.',
      push_notified: 'Demo jumped to Stage 1: Push Notification broadcasted to matched driver.',
      sms_sent: 'Demo jumped to Stage 2: SMS notification sent with expiring action link.',
      voice_call_initiated: 'Demo jumped to Stage 3: Masked automated voice call initiated.',
      staff_dispatched: 'Demo jumped to Stage 4: On-duty parking marshall dispatched on-site.',
      acknowledged: 'Demo jumped to Acknowledged: Driver responded to notification.',
      resolved: 'Demo jumped to Resolved: Bay cleared.'
    };

    incident.auditTrail.push({
      timestamp: now,
      action: `DEMO_STAGE_JUMP_${targetStage.toUpperCase()}`,
      actor: 'Demo Operator',
      details: descriptions[targetStage] || `Fast forwarded to ${targetStage}`
    });

    if (targetStage === 'staff_dispatched') {
      this.createStaffTaskForIncident(incident, 'urgent', 'Demo escalation fast-forwarded to Stage 4: On-site marshall dispatch.');
    }

    dbService.saveIncident(incident);
    return { success: true, incident };
  }

  /**
   * For evaluation/demo purposes: Seeds a sample blocked car incident immediately.
   */
  public seedDemoIncident(parkingAreaId: string, slotNumber: string = 'A-01', plate: string = 'KA 01 AB 1234'): BlockedCarIncident {
    const res = this.reportBlockedCar({
      parkingAreaId,
      slotNumber,
      blockingPlate: plate,
      reportedByCustomerId: 'demo-customer-1',
      reportedByCustomerMobile: '+919876543210',
      description: 'Vehicle parked across lane blocking exit path (Demo Incident)'
    });
    return res.incident!;
  }

  /**
   * Driver responds to alert:
   * - 'moving_now' -> acknowledges, cancels remaining queued calls
   * - 'need_5_mins' -> grants one-time 5-minute grace period
   * - 'not_my_vehicle' -> flags false alarm / manual check
   */
  public driverRespond(params: {
    incidentId: string;
    response: 'moving_now' | 'need_5_mins' | 'not_my_vehicle';
    driverUserId?: string;
  }): { success: boolean; incident?: BlockedCarIncident; error?: string } {
    const incident = dbService.getIncidentById(params.incidentId);
    if (!incident) return { success: false, error: 'Incident not found.' };

    const now = new Date();
    const nowIso = now.toISOString();

    if (params.response === 'need_5_mins') {
      if (incident.gracePeriodUsed) {
        return { success: false, error: 'Grace period has already been used once for this incident.' };
      }
      incident.gracePeriodUsed = true;
      incident.gracePeriodExpiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
      incident.driverResponse = 'need_5_mins';
      incident.currentStage = 'acknowledged';
      incident.auditTrail.push({
        timestamp: nowIso,
        action: 'DRIVER_ACK_NEED_5_MINS',
        actor: 'Driver',
        details: 'Driver requested 5 minutes grace window. Escalation paused.'
      });
    } else if (params.response === 'moving_now') {
      incident.driverResponse = 'moving_now';
      incident.currentStage = 'acknowledged';
      incident.auditTrail.push({
        timestamp: nowIso,
        action: 'DRIVER_ACK_MOVING_NOW',
        actor: 'Driver',
        details: 'Driver confirmed: "I\'m moving now". Escalation halted.'
      });
    } else if (params.response === 'not_my_vehicle') {
      incident.driverResponse = 'not_my_vehicle';
      incident.currentStage = 'staff_dispatched';
      incident.auditTrail.push({
        timestamp: nowIso,
        action: 'DRIVER_DISPUTED_VEHICLE',
        actor: 'Driver',
        details: 'Driver reported vehicle mismatch. Dispatching staff for physical verification.'
      });
      this.createStaffTaskForIncident(incident, 'high', 'Driver indicated "This is not my vehicle". Check on-site.');
    }

    dbService.saveIncident(incident);
    return { success: true, incident };
  }

  /**
   * Resolves the incident (driver moved, or staff verified & resolved).
   */
  public resolveIncident(params: {
    incidentId: string;
    resolution: 'driver_moved' | 'staff_cleared' | 'false_alarm' | 'cancelled';
    actorId: string;
    actorName: string;
    notes?: string;
  }): { success: boolean; incident?: BlockedCarIncident } {
    const incident = dbService.getIncidentById(params.incidentId);
    if (!incident) return { success: false };

    const nowIso = new Date().toISOString();
    incident.currentStage = 'resolved';
    incident.resolution = params.resolution;
    incident.resolvedAt = nowIso;
    incident.staffNotes = params.notes;

    incident.auditTrail.push({
      timestamp: nowIso,
      action: 'INCIDENT_RESOLVED',
      actor: params.actorName,
      details: `Incident marked resolved (${params.resolution}). ${params.notes || ''}`
    });

    dbService.saveIncident(incident);

    // If an associated task exists, mark it resolved
    const tasks = dbService.getTasks(incident.parkingAreaId);
    const relatedTask = tasks.find(t => t.relatedEntityId === incident.id && t.status !== 'resolved');
    if (relatedTask) {
      relatedTask.status = 'resolved';
      relatedTask.resolvedAt = nowIso;
      relatedTask.notes = params.notes || 'Resolved via incident closeout';
      dbService.saveTask(relatedTask);
    }

    dbService.addAuditLog({
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: 'staff',
      action: 'BLOCKED_CAR_RESOLVED',
      parkingAreaId: incident.parkingAreaId,
      targetResource: `Incident #${incident.incidentNumber}`,
      details: `Resolution: ${params.resolution}. Notes: ${params.notes || 'None'}`
    });

    return { success: true, incident };
  }

  private createStaffTaskForIncident(incident: BlockedCarIncident, priority: 'urgent' | 'high', description: string): void {
    const taskId = `tsk-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    const task: StaffTask = {
      id: taskId,
      type: 'blocked_car',
      parkingAreaId: incident.parkingAreaId,
      slotNumber: incident.slotNumber,
      title: `Blocked Car Alert: Bay ${incident.slotNumber}`,
      description: `${description} Blocking Plate: ${incident.blockingPlate}`,
      priority,
      status: 'pending',
      relatedEntityId: incident.id,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    dbService.saveTask(task);
  }
}

export const blockedCarService = new BlockedCarService();
