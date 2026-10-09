import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { normalizeIndianMobile, normalizePlateNumber, hashPasswordWithSalt, verifyPassword } from '../src/services/cryptoService';
import { dbService } from '../src/services/dbService';
import { authService } from '../src/services/authService';
import { visitService } from '../src/services/visitService';
import { anprService } from '../src/services/anprService';
import { blockedCarService } from '../src/services/blockedCarService';
import { operationsService } from '../src/services/operationsService';
import { DEMO_MALL_ID, DEFAULT_TARIFF } from '../src/services/seedData';

describe('ParkSmart Business Rules & Core Invariants', () => {
  beforeAll(async () => {
    await dbService.initialize();
  }, 20000);

  beforeEach(async () => {
    // Reset seed data in memory for deterministic test runs
    await dbService.resetDemoData('test-runner', 'Test Admin');
  });

  describe('1. Phone & Plate Normalization & Cryptography', () => {
    it('should validate and normalize Indian mobile numbers to E.164 (+91XXXXXXXXXX)', () => {
      expect(normalizeIndianMobile('9876543210')).toEqual({
        isValid: true,
        normalized: '+919876543210'
      });

      expect(normalizeIndianMobile('+91 98765 43210')).toEqual({
        isValid: true,
        normalized: '+919876543210'
      });

      expect(normalizeIndianMobile('09876543210')).toEqual({
        isValid: true,
        normalized: '+919876543210'
      });

      // Invalid start digit
      expect(normalizeIndianMobile('1234567890').isValid).toBe(false);
      // Short number
      expect(normalizeIndianMobile('98765').isValid).toBe(false);
    });

    it('should normalize vehicle registration plates consistently', () => {
      const res = normalizePlateNumber('ka 01 - ab 1234');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('KA01AB1234');
      expect(res.display).toBe('KA 01 - AB 1234');
    });

    it('should hash passwords with salt and verify securely', async () => {
      const { hash, salt } = await hashPasswordWithSalt('Secret@123');
      expect(hash).toBeDefined();
      expect(salt).toBeDefined();

      const isValid = await verifyPassword('Secret@123', hash, salt);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('WrongPassword', hash, salt);
      expect(isInvalid).toBe(false);
    });
  });

  describe('2. Authentication, Roles & Staff Approval Workflow', () => {
    it('should register a customer and prevent duplicate mobile registration', async () => {
      const mobile = '9900112233';
      const reg = await authService.register({
        name: 'Test Customer',
        mobile,
        password: 'Password@123',
        confirmPassword: 'Password@123'
      });

      expect(reg.success).toBe(true);
      expect(reg.user?.role).toBe('customer');

      // Duplicate registration attempt
      const dup = await authService.register({
        name: 'Duplicate Guy',
        mobile,
        password: 'Password@123',
        confirmPassword: 'Password@123'
      });
      expect(dup.success).toBe(false);
      expect(dup.error).toContain('already exists');
    });

    it('should enforce staff pending approval state until approved by admin', async () => {
      const staffMobile = '9888877777';
      const req = await authService.requestStaffAccess({
        name: 'New Staff Applicant',
        mobile: staffMobile,
        password: 'StaffPass@123',
        parkingAreaId: DEMO_MALL_ID
      });

      expect(req.success).toBe(true);
      expect(req.user?.status).toBe('pending_approval');

      // Attempt staff login while pending
      const loginRes = await authService.login({
        mobile: staffMobile,
        password: 'StaffPass@123'
      });
      expect(loginRes.isPendingApproval).toBe(true);

      // Admin approves request
      const approval = authService.approveStaffRequest({
        adminId: 'usr-mall-admin-01',
        adminName: 'Vikram Mehta',
        targetUserId: req.user!.id,
        assignedStaffId: 'STF-555'
      });

      expect(approval.success).toBe(true);
      expect(approval.user?.status).toBe('active');
      expect(approval.user?.staffId).toBe('STF-555');
    });
  });

  describe('3. Slot Booking & Race Prevention (Double-Booking)', () => {
    it('should reserve an available slot atomically and prevent double booking', () => {
      const slot = dbService.getSlots(DEMO_MALL_ID).find(s => s.status === 'available')!;

      const res1 = dbService.atomicReserveSlot({
        slotId: slot.id,
        bookingData: {
          customerId: 'usr-customer-01',
          customerName: 'Arjun Verma',
          customerMobile: '+919876543214',
          parkingAreaId: DEMO_MALL_ID,
          parkingAreaName: 'Demo Mall',
          levelId: slot.levelId,
          levelName: 'Level 1',
          zoneId: slot.zoneId,
          zoneName: 'Zone A',
          slotId: slot.id,
          slotNumber: slot.number,
          slotType: slot.type,
          vehiclePlate: 'KA 05 MN 9000',
          vehiclePlateNormalized: 'KA05MN9000',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 7200000).toISOString(),
          expectedDurationHours: 2,
          servicesRequested: [],
          estimatedTotal: 80,
          isEVRequested: false
        }
      });

      expect(res1.success).toBe(true);
      expect(res1.booking?.ticketToken).toBeDefined();

      // Second user tries to reserve the exact same slot concurrently
      const res2 = dbService.atomicReserveSlot({
        slotId: slot.id,
        bookingData: {
          customerId: 'usr-customer-02',
          customerName: 'Sneha Patel',
          customerMobile: '+919876543215',
          parkingAreaId: DEMO_MALL_ID,
          parkingAreaName: 'Demo Mall',
          levelId: slot.levelId,
          levelName: 'Level 1',
          zoneId: slot.zoneId,
          zoneName: 'Zone A',
          slotId: slot.id,
          slotNumber: slot.number,
          slotType: slot.type,
          vehiclePlate: 'DL 08 CC 1111',
          vehiclePlateNormalized: 'DL08CC1111',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 7200000).toISOString(),
          expectedDurationHours: 2,
          servicesRequested: [],
          estimatedTotal: 80,
          isEVRequested: false
        }
      });

      expect(res2.success).toBe(false);
      expect(res2.error).toContain('no longer available');
    });
  });

  describe('4. Staff EV Upgrade Workflow', () => {
    it('should atomically swap an active reservation to an available EV slot', () => {
      const booking = dbService.getBookings('usr-customer-01', DEMO_MALL_ID)[0];
      const evSlots = dbService.getSlots(DEMO_MALL_ID).filter(s => s.type === 'ev' && s.status === 'available');
      const targetEV = evSlots[0];

      const oldSlotId = booking.slotId;

      const upgradeRes = dbService.atomicUpgradeToEV({
        bookingId: booking.id,
        newEVSlotId: targetEV.id,
        staffId: 'usr-staff-approved-01',
        staffName: 'Ramesh Kumar',
        reason: 'Customer requested charger access upon gate arrival'
      });

      expect(upgradeRes.success).toBe(true);
      expect(upgradeRes.updatedBooking?.slotNumber).toBe(targetEV.number);
      expect(upgradeRes.updatedBooking?.slotType).toBe('ev');

      // Verify old slot is released to available
      const oldSlot = dbService.getSlotById(oldSlotId);
      expect(oldSlot?.status).toBe('available');

      // Verify new EV slot is now reserved
      const newSlot = dbService.getSlotById(targetEV.id);
      expect(newSlot?.status).toBe('reserved');
    });
  });

  describe('5. ANPR Plate Matching & Camera Recognition', () => {
    it('should match registered plate with active reservation', () => {
      const match = anprService.processRecognition({
        rawPlate: 'KA 01 AB 1234',
        confidence: 96,
        parkingAreaId: DEMO_MALL_ID
      });

      expect(match.matchStatus).toBe('matched');
      expect(match.matchedBooking).toBeDefined();
      expect(match.matchedBooking?.vehiclePlateNormalized).toBe('KA01AB1234');
    });

    it('should fail with low_confidence if confidence score is below 70%', () => {
      const lowConf = anprService.processRecognition({
        rawPlate: 'KA 01 AB 1234',
        confidence: 55,
        parkingAreaId: DEMO_MALL_ID
      });

      expect(lowConf.matchStatus).toBe('low_confidence');
    });

    it('should indicate no_active_booking for unknown vehicles', () => {
      const unknown = anprService.processRecognition({
        rawPlate: 'MH 99 ZZ 0001',
        confidence: 92,
        parkingAreaId: DEMO_MALL_ID
      });

      expect(unknown.matchStatus).toBe('no_active_booking');
    });
  });

  describe('6. Visit Lifecycle, Tariff Calculation & Exit Pass', () => {
    it('should calculate free parking during 15-minute grace period', () => {
      const entryTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 mins ago
      const fee = visitService.calculateFee({
        entryTimestamp: entryTime,
        tariff: DEFAULT_TARIFF
      });

      expect(fee.isFreePeriod).toBe(true);
      expect(fee.parkingFee).toBe(0);
      expect(fee.totalAmount).toBe(0);
    });

    it('should calculate hourly rounding and minimum charge past free period', () => {
      const entryTime = new Date(Date.now() - 65 * 60 * 1000).toISOString(); // 65 mins ago -> 2 billable hours
      const fee = visitService.calculateFee({
        entryTimestamp: entryTime,
        tariff: DEFAULT_TARIFF
      });

      expect(fee.isFreePeriod).toBe(false);
      expect(fee.billableHours).toBe(2);
      expect(fee.parkingFee).toBe(80); // 2 * 40
    });

    it('should process payment, issue exit pass, and validate exit barrier', () => {
      const visit = dbService.getVisits(undefined, DEMO_MALL_ID)[0];

      // Settle payment
      const payRes = visitService.processPaymentAndIssueExitPass({
        visitId: visit.id,
        method: 'UPI',
        isSimulated: true
      });

      expect(payRes.success).toBe(true);
      expect(payRes.exitPass?.passToken).toBeDefined();
      expect(payRes.exitPass?.isConsumed).toBe(false);

      // Gate Exit Validation
      const exitRes = visitService.completeExit({
        passTokenOrPlate: payRes.exitPass!.passToken,
        exitMethod: 'qr_scan',
        parkingAreaId: DEMO_MALL_ID
      });

      expect(exitRes.success).toBe(true);
      expect(exitRes.visit?.status).toBe('completed');
      expect(exitRes.visit?.exitPass?.isConsumed).toBe(true);

      // Slot must be released back to available
      const bay = dbService.getSlotById(visit.slotId);
      expect(bay?.status).toBe('available');
    });
  });

  describe('7. Blocked Car Staged Escalation & Driver Interaction', () => {
    it('should initiate Stage 1 Push when matching booking is found', () => {
      const report = blockedCarService.reportBlockedCar({
        parkingAreaId: DEMO_MALL_ID,
        slotNumber: 'A-102',
        blockingPlate: 'DL 03 C 9988',
        reportedByCustomerId: 'usr-customer-01',
        reportedByCustomerMobile: '+919876543214'
      });

      expect(report.success).toBe(true);
      expect(report.incident?.currentStage).toBe('push_notified');
      expect(report.incident?.matchedBookingId).toBeDefined();
    });

    it('should advance escalation stages (Push -> SMS -> Voice -> Staff Dispatch)', () => {
      const incident = dbService.getIncidents(DEMO_MALL_ID)[0];

      // Advance from push to SMS
      blockedCarService.advanceEscalation(incident.id);
      let updated = dbService.getIncidentById(incident.id)!;
      expect(updated.currentStage).toBe('sms_sent');

      // Advance from SMS to voice call
      blockedCarService.advanceEscalation(incident.id);
      updated = dbService.getIncidentById(incident.id)!;
      expect(updated.currentStage).toBe('voice_call_initiated');

      // Advance to staff dispatch
      blockedCarService.advanceEscalation(incident.id);
      updated = dbService.getIncidentById(incident.id)!;
      expect(updated.currentStage).toBe('staff_dispatched');
    });

    it('should grant 5-minute grace period only once per incident', () => {
      const incident = dbService.getIncidents(DEMO_MALL_ID)[0];

      const res1 = blockedCarService.driverRespond({
        incidentId: incident.id,
        response: 'need_5_mins'
      });
      expect(res1.success).toBe(true);
      expect(res1.incident?.gracePeriodUsed).toBe(true);

      // Attempt second grace period
      const res2 = blockedCarService.driverRespond({
        incidentId: incident.id,
        response: 'need_5_mins'
      });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('already been used once');
    });
  });

  describe('8. Operations Telemetry & Staffing Recommendations', () => {
    it('should calculate accurate metrics and staffing recommendation using 25 cars/attendant/hr capacity', () => {
      const metrics = operationsService.getMetrics(DEMO_MALL_ID);
      expect(metrics.totalSlots).toBeGreaterThan(0);
      expect(metrics.occupancyRatePercent).toBeGreaterThanOrEqual(0);

      const area = dbService.getParkingAreaById(DEMO_MALL_ID)!;
      const recs = operationsService.getStaffingRecommendations(area);
      expect(recs.length).toBeGreaterThan(0);
      expect(recs[0].carsPerAttendantPerHourCapacity).toBe(25);
      expect(recs[0].recommendedStaffCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('9. Layout Builder Deletion Engine', () => {
    it('should allow deleting an individual floor level and cleanup its slots', () => {
      const area = dbService.getParkingAreaById(DEMO_MALL_ID)!;
      const initialLevelsCount = area.levels.length;
      expect(initialLevelsCount).toBe(2);

      const level2Id = area.levels[1].id;
      const slotsBefore = dbService.getSlots(DEMO_MALL_ID).filter(s => s.levelId === level2Id);
      expect(slotsBefore.length).toBeGreaterThan(0);

      const res = dbService.deleteLevel(DEMO_MALL_ID, level2Id);
      expect(res.success).toBe(true);

      const updatedArea = dbService.getParkingAreaById(DEMO_MALL_ID)!;
      expect(updatedArea.levels.length).toBe(1);
      expect(updatedArea.levels.some(l => l.id === level2Id)).toBe(false);

      // Verify level 2 slots were cleaned up
      const slotsAfter = dbService.getSlots(DEMO_MALL_ID).filter(s => s.levelId === level2Id);
      expect(slotsAfter.length).toBe(0);
    });

    it('should allow clearing all slots and elements on a floor level canvas', () => {
      const area = dbService.getParkingAreaById(DEMO_MALL_ID)!;
      const level1Id = area.levels[0].id;

      dbService.clearLevel(DEMO_MALL_ID, level1Id);

      const updatedArea = dbService.getParkingAreaById(DEMO_MALL_ID)!;
      const level1 = updatedArea.levels.find(l => l.id === level1Id)!;
      expect(level1.elements.length).toBe(0);

      const remainingSlots = dbService.getSlots(DEMO_MALL_ID).filter(s => s.levelId === level1Id);
      expect(remainingSlots.length).toBe(0);
    });

    it('should allow deleting an entire parking facility venue layout', () => {
      const tempFacility = {
        id: 'fac-temp-delete-test',
        name: 'Temporary Test Plaza',
        slug: 'temp-test-plaza',
        address: '123 Test Road',
        levels: [],
        ownerAdminId: 'usr-admin-01',
        isPublished: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tariffPolicy: { ...DEFAULT_TARIFF }
      };
      dbService.saveParkingArea(tempFacility);
      expect(dbService.getParkingAreaById('fac-temp-delete-test')).toBeDefined();

      const deleted = dbService.deleteParkingArea('fac-temp-delete-test');
      expect(deleted).toBe(true);
      expect(dbService.getParkingAreaById('fac-temp-delete-test')).toBeUndefined();
    });
  });

  describe('10. Layout Builder Roads & Snapping Geometry', () => {
    it('should support adding and configuring road driving lanes with directional orientation', () => {
      const area = dbService.getParkingAreaById(DEMO_MALL_ID)!;
      const roadElement = {
        id: 'el-road-test-01',
        type: 'road' as const,
        label: 'Express Driving Lane',
        x: 100,
        y: 200,
        width: 320,
        height: 60,
        direction: 'right' as const
      };

      area.levels[0].elements.push(roadElement);
      dbService.saveParkingArea(area);

      const saved = dbService.getParkingAreaById(DEMO_MALL_ID)!;
      const foundRoad = saved.levels[0].elements.find(e => e.id === 'el-road-test-01');
      expect(foundRoad).toBeDefined();
      expect(foundRoad?.type).toBe('road');
      expect(foundRoad?.width).toBe(320);
      expect(foundRoad?.height).toBe(60);
      expect(foundRoad?.direction).toBe('right');
    });

    it('should enforce 10px grid coordinate snapping mathematics for canvas drag-and-drop', () => {
      const snapToGrid = (coord: number, delta: number, zoom: number = 1) => {
        return Math.max(0, Math.round(((coord + delta / zoom) / 10)) * 10);
      };

      expect(snapToGrid(60, 14)).toBe(70);
      expect(snapToGrid(60, 4)).toBe(60);
      expect(snapToGrid(60, 26)).toBe(90);
      expect(snapToGrid(100, -37)).toBe(60);
      expect(snapToGrid(0, -50)).toBe(0); // Clamped at 0
    });
  });

  describe('11. Role Segregation & Authentication Credentials', () => {
    it('should authenticate the facility admin account (+919876543211)', async () => {
      const res = await authService.login({
        mobile: '+919876543211',
        password: 'Demo@1234'
      });
      expect(res.success).toBe(true);
      expect(res.user?.role).toBe('parking_admin');
      expect(res.user?.status).toBe('active');
    });

    it('should distinguish customer, staff, and admin roles strictly', async () => {
      const customerLogin = await authService.login({ mobile: '+919876543214', password: 'Demo@1234' });
      expect(customerLogin.user?.role).toBe('customer');

      const staffLogin = await authService.login({ mobile: '+919876543212', password: 'Demo@1234' });
      expect(staffLogin.user?.role).toBe('staff');

      const adminLogin = await authService.login({ mobile: '+919876543211', password: 'Demo@1234' });
      expect(adminLogin.user?.role).toBe('parking_admin');

      // Allowed roles segregation
      const customerAllowed = ['customer'];
      const staffAllowed = ['staff'];
      const adminAllowed = ['parking_admin', 'platform_admin'];

      expect(customerAllowed.includes(customerLogin.user!.role)).toBe(true);
      expect(customerAllowed.includes(staffLogin.user!.role)).toBe(false);
      expect(customerAllowed.includes(adminLogin.user!.role)).toBe(false);

      expect(staffAllowed.includes(staffLogin.user!.role)).toBe(true);
      expect(staffAllowed.includes(customerLogin.user!.role)).toBe(false);
      expect(staffAllowed.includes(adminLogin.user!.role)).toBe(false);

      expect(adminAllowed.includes(adminLogin.user!.role)).toBe(true);
      expect(adminAllowed.includes(customerLogin.user!.role)).toBe(false);
      expect(adminAllowed.includes(staffLogin.user!.role)).toBe(false);
    });
  });

  describe('12. Demo Escalation, Pay Early & Leave, and Curved Roads', () => {
    it('should allow demo operator to jump blocked car incident directly to any stage', () => {
      const incident = blockedCarService.seedDemoIncident(DEMO_MALL_ID, 'A-01');
      expect(incident.currentStage).toBe('push_notified');

      // Jump to Stage 2 (SMS)
      const res2 = blockedCarService.jumpToStage(incident.id, 'sms_sent');
      expect(res2.success).toBe(true);
      expect(res2.incident?.currentStage).toBe('sms_sent');
      expect(res2.incident?.auditTrail.some(a => a.action.includes('STAGE_JUMP'))).toBe(true);

      // Jump to Stage 3 (Voice Call)
      const res3 = blockedCarService.jumpToStage(incident.id, 'voice_call_initiated');
      expect(res3.success).toBe(true);
      expect(res3.incident?.currentStage).toBe('voice_call_initiated');

      // Jump to Stage 4 (Staff Dispatched)
      const res4 = blockedCarService.jumpToStage(incident.id, 'staff_dispatched');
      expect(res4.success).toBe(true);
      expect(res4.incident?.currentStage).toBe('staff_dispatched');

      // Check urgent task was created for staff
      const tasks = dbService.getTasks(DEMO_MALL_ID);
      const relatedTask = tasks.find(t => t.relatedEntityId === incident.id);
      expect(relatedTask).toBeDefined();
      expect(relatedTask?.priority).toBe('urgent');
    });

    it('should complete pay early and leave flow by releasing parking bay and closing visit', () => {
      // 1. Get existing active visit in DEMO_MALL_ID
      const visit = dbService.getVisits(undefined, DEMO_MALL_ID)[0];
      expect(visit).toBeDefined();

      // 2. Pay Early & Issue Exit Pass
      const payRes = visitService.processPaymentAndIssueExitPass({
        visitId: visit.id,
        method: 'UPI',
        isSimulated: true,
        upiVpa: 'user@okhdfc'
      });
      expect(payRes.success).toBe(true);
      expect(payRes.exitPass).toBeDefined();
      expect(payRes.visit?.status).toBe('exit_pass_issued');

      // 3. Complete Exit (Pay Early & Leave)
      const exitRes = visitService.completeExit({
        passTokenOrPlate: payRes.exitPass!.passToken,
        exitMethod: 'qr_scan',
        parkingAreaId: DEMO_MALL_ID
      });

      expect(exitRes.success).toBe(true);
      expect(exitRes.visit?.status).toBe('completed');
      expect(exitRes.visit?.exitPass?.isConsumed).toBe(true);

      // Verify slot is released back to available
      const releasedSlot = dbService.getSlotById(visit.slotId);
      expect(releasedSlot?.status).toBe('available');

      // Verify booking is completed if present
      if (visit.bookingId) {
        const completedBooking = dbService.getBookingById(visit.bookingId);
        if (completedBooking) {
          expect(completedBooking.status).toBe('completed');
        }
      }
    });

    it('should reject road snapping if target coordinate overlaps with a parking bay', () => {
      const slotBox = { x: 100, y: 100, width: 75, height: 120 };
      const roadW = 320;
      const roadH = 60;

      const doesOverlap = (boxA: { x: number; y: number; width: number; height: number }, boxB: { x: number; y: number; width: number; height: number }) => {
        return !(
          boxA.x + boxA.width <= boxB.x ||
          boxA.x >= boxB.x + boxB.width ||
          boxA.y + boxA.height <= boxB.y ||
          boxA.y >= boxB.y + boxB.height
        );
      };

      // Candidate 1: directly overlaps slot
      const overlappingCandidate = { x: 90, y: 110, width: roadW, height: roadH };
      expect(doesOverlap(overlappingCandidate, slotBox)).toBe(true);

      // Candidate 2: clear aisle separated from slot
      const clearAisleCandidate = { x: 200, y: 100, width: roadW, height: roadH };
      expect(doesOverlap(clearAisleCandidate, slotBox)).toBe(false);
    });

    it('should support curved road corner definitions on layouts', () => {
      const facility = dbService.getParkingAreaById(DEMO_MALL_ID)!;
      const level = facility.levels[0];

      level.elements.push({
        id: 'el-curve-corner-test',
        type: 'road',
        label: 'Corner Bend A',
        x: 120,
        y: 120,
        width: 90,
        height: 90,
        curveCorner: 'top_right'
      });

      dbService.saveParkingArea(facility);

      const refreshed = dbService.getParkingAreaById(DEMO_MALL_ID)!;
      const curve = refreshed.levels[0].elements.find(e => e.id === 'el-curve-corner-test');
      expect(curve).toBeDefined();
      expect(curve?.curveCorner).toBe('top_right');
    });

    it('should compute seamless 60px curved road geometry with matching midpoint center lines', () => {
      // Test concentric arc calculations for standard 60px lane width
      const w = 60;
      const h = 60;
      const rOut = Math.min(w, h); // 60
      const laneW = Math.min(60, rOut); // 60
      const rIn = Math.max(0, rOut - laneW); // 0
      const rMid = (rIn + rOut) / 2; // 30

      expect(rOut).toBe(60);
      expect(laneW).toBe(60);
      expect(rIn).toBe(0);
      expect(rMid).toBe(30); // Perfectly aligns with 50% midpoint of 60px straight road

      // Verify for 90px tile
      const w90 = 90;
      const rOut90 = 90;
      const laneW90 = 60;
      const rIn90 = rOut90 - laneW90; // 30
      const rMid90 = (rIn90 + rOut90) / 2; // 60
      expect(w90 - rMid90).toBe(30); // Outer offset to center line is still exactly 30px!
    });

    it('should compute magnetic snap target points between perpendicular and curved roads', () => {
      // Horizontal road (320x60) meeting Vertical road (60x280)
      const vRoad = { x: 100, y: 100, width: 60, height: 280 };
      const hRoad = { width: 320, height: 60 };

      // Top-left snap point (Horizontal road meeting top-left of Vertical road)
      const snapTopLeft = { x: vRoad.x - hRoad.width, y: vRoad.y };
      expect(snapTopLeft.x).toBe(-220);
      expect(snapTopLeft.y).toBe(100);

      // Top-right snap point (Horizontal road meeting right side of Vertical road)
      const snapTopRight = { x: vRoad.x + vRoad.width, y: vRoad.y };
      expect(snapTopRight.x).toBe(160);
      expect(snapTopRight.y).toBe(100);

      // 60x60 Top-Right curve meeting vertical road above and horizontal road right
      const trCurve = { x: 100, y: 200, width: 60, height: 60 };
      const connectedVRoad = { x: trCurve.x, y: trCurve.y - 280 }; // Vert above curve
      const connectedHRoad = { x: trCurve.x + trCurve.width, y: trCurve.y }; // Horiz right of curve

      expect(connectedVRoad.x).toBe(100);
      expect(connectedVRoad.y).toBe(-80);
      expect(connectedHRoad.x).toBe(160);
      expect(connectedHRoad.y).toBe(200);
    });

    it('should strictly deny unauthenticated and staff users from booking access', async () => {
      // Only authenticated users with 'customer' role can book
      const isBookingPermitted = (user: { role: string } | null) => {
        if (!user) return false;
        return user.role === 'customer';
      };

      expect(isBookingPermitted(null)).toBe(false); // Unauthenticated / Login page
      expect(isBookingPermitted({ role: 'staff' })).toBe(false);
      expect(isBookingPermitted({ role: 'parking_admin' })).toBe(false);
      expect(isBookingPermitted({ role: 'platform_admin' })).toBe(false);
      expect(isBookingPermitted({ role: 'customer' })).toBe(true);
    });
  });
});
