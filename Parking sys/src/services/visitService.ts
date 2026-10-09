import type { Visit, TariffPolicy, PaymentRecord, ExitPass } from '../types';
import { dbService } from './dbService';
import { generateSecureToken, maskMobile } from './cryptoService';

export class VisitService {
  /**
   * Calculates parking fee based on entry timestamp, current/exit timestamp,
   * tariff policy snapshot, EV charging, and additional services.
   */
  public calculateFee(params: {
    entryTimestamp: string;
    exitTimestamp?: string;
    tariff: TariffPolicy;
    isEVCharging?: boolean;
    isTwoWheeler?: boolean;
    isTwoWheelerEV?: boolean;
    evHours?: number;
    servicesTotal?: number;
  }): {
    durationMinutes: number;
    billableHours: number;
    parkingFee: number;
    evChargingFee: number;
    servicesFee: number;
    isFreePeriod: boolean;
    totalAmount: number;
  } {
    const start = new Date(params.entryTimestamp).getTime();
    const end = params.exitTimestamp ? new Date(params.exitTimestamp).getTime() : Date.now();
    const durationMinutes = Math.max(0, Math.floor((end - start) / (1000 * 60)));

    const { freePeriodMinutes, baseHourlyRate, evChargingRatePerHour, twoWheelerRatePerHour, twoWheelerEvRatePerHour, minimumCharge, maxDailyFee, roundingUnitMinutes } = params.tariff;

    const effectiveHourlyRate = params.isTwoWheeler
      ? (twoWheelerRatePerHour ?? Math.max(10, Math.round(baseHourlyRate * 0.5)))
      : baseHourlyRate;

    let parkingFee = 0;
    let billableHours = 0;
    const isFreePeriod = durationMinutes <= freePeriodMinutes;

    if (!isFreePeriod) {
      // Billable time: ceil to rounding unit (e.g. 60 mins)
      billableHours = Math.ceil(durationMinutes / (roundingUnitMinutes || 60));
      parkingFee = billableHours * effectiveHourlyRate;
      if (parkingFee < minimumCharge && !params.isTwoWheeler) {
        parkingFee = minimumCharge;
      }
      if (maxDailyFee > 0 && parkingFee > maxDailyFee) {
        parkingFee = maxDailyFee;
      }
    }

    // EV charging fee calculation
    let evChargingFee = 0;
    if (params.isEVCharging || params.isTwoWheelerEV) {
      const chargeHours = params.evHours !== undefined ? params.evHours : (billableHours || 1);
      const evRate = params.isTwoWheelerEV
        ? (twoWheelerEvRatePerHour ?? Math.max(20, Math.round((evChargingRatePerHour || 80) * 0.5)))
        : (evChargingRatePerHour || 80);
      evChargingFee = Math.ceil(chargeHours) * evRate;
    }

    const servicesFee = params.servicesTotal || 0;
    const totalAmount = parkingFee + evChargingFee + servicesFee;

    return {
      durationMinutes,
      billableHours,
      parkingFee,
      evChargingFee,
      servicesFee,
      isFreePeriod,
      totalAmount
    };
  }

  /**
   * Starts a live visit when entry is confirmed via QR scan or ANPR camera.
   * Atomically marks booking active_inside, marks slot occupied, and creates visit.
   */
  public startVisit(params: {
    bookingId: string;
    entryMethod: 'qr_scan' | 'anpr_camera';
    operatorId?: string;
  }): { success: boolean; visit?: Visit; error?: string } {
    const booking = dbService.getBookingById(params.bookingId);
    if (!booking) return { success: false, error: 'Booking record not found.' };

    if (booking.status === 'active_inside') {
      return { success: false, error: 'This vehicle is already recorded as inside the facility.' };
    }
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return { success: false, error: `This booking is ${booking.status} and cannot be used for entry.` };
    }

    const area = dbService.getParkingAreaById(booking.parkingAreaId);
    if (!area) return { success: false, error: 'Parking facility not found.' };

    const slot = dbService.getSlotById(booking.slotId);
    if (!slot) return { success: false, error: 'Assigned parking slot not found.' };

    const now = new Date().toISOString();
    const visitId = `vst-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Snapshot current tariff policy
    const tariffSnapshot: TariffPolicy = { ...area.tariffs };

    const visit: Visit = {
      id: visitId,
      bookingId: booking.id,
      parkingAreaId: booking.parkingAreaId,
      parkingAreaName: booking.parkingAreaName,
      slotId: slot.id,
      slotNumber: slot.number,
      levelName: booking.levelName,
      zoneName: booking.zoneName,
      vehiclePlate: booking.vehiclePlate,
      vehiclePlateNormalized: booking.vehiclePlateNormalized,
      customerId: booking.customerId,
      customerName: booking.customerName,
      customerMobileMasked: maskMobile(booking.customerMobile),
      entryTimestamp: now,
      entryMethod: params.entryMethod,
      entryOperatorId: params.operatorId,
      tariffSnapshot,
      status: 'active',
      services: booking.servicesRequested || [],
      currentDurationMinutes: 0,
      calculatedFee: 0,
      savedCarLocation: {
        parkingAreaId: area.id,
        parkingAreaName: area.name,
        levelName: booking.levelName,
        zoneName: booking.zoneName,
        slotNumber: slot.number,
        notes: slot.directionalNotes || 'Parked in assigned bay'
      },
      createdAt: now,
      updatedAt: now
    };

    // Update booking status
    booking.status = 'active_inside';
    booking.updatedAt = now;
    dbService.saveBooking(booking);

    // Update slot status to occupied
    slot.status = 'occupied';
    dbService.saveSlot(slot);

    // Save visit
    dbService.saveVisit(visit);

    dbService.addAuditLog({
      actorId: params.operatorId || 'gate-system',
      actorName: params.operatorId ? 'Staff Operator' : 'Automated Gate Sensor',
      actorRole: 'staff',
      action: 'VEHICLE_ENTRY_CONFIRMED',
      parkingAreaId: area.id,
      targetResource: `Vehicle ${booking.vehiclePlate}`,
      details: `Entry verified via ${params.entryMethod}. Assigned slot ${slot.number}. Barrier open simulated.`
    });

    return { success: true, visit };
  }

  /**
   * Processes payment and issues a digital Exit Pass with an expiry validity window (e.g. 20 minutes).
   */
  public processPaymentAndIssueExitPass(params: {
    visitId: string;
    method: 'UPI' | 'Card' | 'Cash' | 'Fastag';
    isSimulated?: boolean;
    upiVpa?: string;
  }): { success: boolean; visit?: Visit; exitPass?: ExitPass; error?: string } {
    const visit = dbService.getVisitById(params.visitId);
    if (!visit) return { success: false, error: 'Visit record not found.' };

    if (visit.status === 'completed') {
      return { success: false, error: 'Visit is already completed.' };
    }

    const servicesTotal = visit.services.reduce((acc, s) => acc + (s.status !== 'cancelled' ? s.price : 0), 0);
    const booking = dbService.getBookingById(visit.bookingId);
    const slot = visit.slotId ? dbService.getSlotById(visit.slotId) : undefined;
    const slotType = booking?.slotType || slot?.type;
    const isTwoWheeler = slotType === 'two_wheeler' || slotType === 'two_wheeler_ev';
    const isTwoWheelerEV = slotType === 'two_wheeler_ev';
    const isEV = slotType === 'ev' || booking?.isEVRequested;

    const feeBreakdown = this.calculateFee({
      entryTimestamp: visit.entryTimestamp,
      tariff: visit.tariffSnapshot,
      isEVCharging: isEV,
      isTwoWheeler,
      isTwoWheelerEV,
      servicesTotal
    });

    const now = new Date();
    const paidAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 20 * 60 * 1000).toISOString(); // 20 mins to exit

    const passToken = `EXIT-${generateSecureToken(12).toUpperCase()}`;

    const paymentRecord: PaymentRecord = {
      transactionId: `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: feeBreakdown.totalAmount,
      currency: 'INR',
      method: params.method,
      upiVpa: params.upiVpa || 'customer@okaxis',
      status: params.isSimulated ? 'simulated_success' : 'verified_success',
      isSimulated: params.isSimulated !== false,
      paidAt,
      breakdown: {
        parkingFee: feeBreakdown.parkingFee,
        evChargingFee: feeBreakdown.evChargingFee,
        servicesFee: feeBreakdown.servicesFee,
        taxAmount: 0,
        totalAmount: feeBreakdown.totalAmount
      }
    };

    const exitPass: ExitPass = {
      passToken,
      issuedAt: paidAt,
      expiresAt,
      isConsumed: false
    };

    visit.calculatedFee = feeBreakdown.totalAmount;
    visit.currentDurationMinutes = feeBreakdown.durationMinutes;
    visit.paymentRecord = paymentRecord;
    visit.exitPass = exitPass;
    visit.status = 'exit_pass_issued';
    visit.updatedAt = paidAt;

    dbService.saveVisit(visit);

    dbService.addAuditLog({
      actorId: visit.customerId,
      actorName: visit.customerName,
      actorRole: 'customer',
      action: 'PAYMENT_AND_EXIT_PASS_ISSUED',
      parkingAreaId: visit.parkingAreaId,
      targetResource: `Visit #${visit.id}`,
      details: `Paid ₹${feeBreakdown.totalAmount} via ${params.method} (${params.isSimulated ? 'SIMULATED' : 'LIVE'}). Exit Pass valid until ${new Date(expiresAt).toLocaleTimeString()}`
    });

    return { success: true, visit, exitPass };
  }

  /**
   * Validates exit at the gate via QR pass or ANPR exit camera.
   * Consumes exit pass, releases slot, marks visit & booking completed.
   */
  public completeExit(params: {
    passTokenOrPlate: string;
    exitMethod: 'qr_scan' | 'anpr_camera';
    parkingAreaId: string;
    operatorId?: string;
  }): { success: boolean; visit?: Visit; error?: string } {
    const visits = dbService.getVisits(undefined, params.parkingAreaId);

    // Search by passToken or normalized plate
    const cleanQuery = params.passTokenOrPlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    const targetVisit = visits.find(v => {
      if (v.status !== 'exit_pass_issued' && v.status !== 'active') return false;
      const tokenMatch = v.exitPass?.passToken.replace(/[^A-Z0-9]/g, '') === cleanQuery;
      const plateMatch = v.vehiclePlateNormalized === cleanQuery;
      return tokenMatch || plateMatch;
    });

    if (!targetVisit) {
      return { success: false, error: 'No active visit found matching this exit pass or plate number at this facility.' };
    }

    if (!targetVisit.exitPass) {
      return { success: false, error: 'Payment has not been settled. Please complete payment before exiting.' };
    }

    if (targetVisit.exitPass.isConsumed) {
      return { success: false, error: 'This exit pass has already been consumed.' };
    }

    const now = new Date();
    const expiry = new Date(targetVisit.exitPass.expiresAt);
    if (now > expiry) {
      return { success: false, error: 'Exit pass grace window has expired. Additional parking fee may apply.' };
    }

    const nowIso = now.toISOString();

    // Consume pass
    targetVisit.exitPass.isConsumed = true;
    targetVisit.exitPass.consumedAt = nowIso;
    targetVisit.exitPass.consumedByOperatorId = params.operatorId;
    targetVisit.exitTimestamp = nowIso;
    targetVisit.exitMethod = params.exitMethod;
    targetVisit.exitOperatorId = params.operatorId;
    targetVisit.status = 'completed';
    targetVisit.updatedAt = nowIso;

    // Complete booking
    const booking = dbService.getBookingById(targetVisit.bookingId);
    if (booking) {
      booking.status = 'completed';
      booking.updatedAt = nowIso;
      dbService.saveBooking(booking);
    }

    // Release slot to available
    const slot = dbService.getSlotById(targetVisit.slotId);
    if (slot) {
      slot.status = 'available';
      dbService.saveSlot(slot);
    }

    dbService.saveVisit(targetVisit);

    dbService.addAuditLog({
      actorId: params.operatorId || 'exit-gate-system',
      actorName: params.operatorId ? 'Exit Staff' : 'Automated Exit Barrier',
      actorRole: 'staff',
      action: 'VEHICLE_EXIT_COMPLETED',
      parkingAreaId: params.parkingAreaId,
      targetResource: `Vehicle ${targetVisit.vehiclePlate}`,
      details: `Exit processed via ${params.exitMethod}. Bay ${targetVisit.slotNumber} released to Available. Barrier open confirmed.`
    });

    return { success: true, visit: targetVisit };
  }
}

export const visitService = new VisitService();
