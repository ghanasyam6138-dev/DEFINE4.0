export type Role = 'customer' | 'staff' | 'parking_admin' | 'platform_admin';

export type UserStatus = 'active' | 'pending_approval' | 'rejected' | 'suspended';

export interface User {
  id: string;
  name: string;
  mobile: string; // E.164 or normalized 10-digit, e.g. +919876543210
  passwordHash: string;
  salt: string;
  role: Role;
  status: UserStatus;
  staffId?: string; // unique ID assigned by admin
  assignedParkingAreaId?: string;
  approvalDetails?: {
    approvedBy: string;
    approvedByName: string;
    approvedAt: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type SlotType = 'standard' | 'ev' | 'accessible' | 'staff_only' | 'two_wheeler' | 'two_wheeler_ev';

export type SlotStatus = 'available' | 'reserved' | 'occupied' | 'under_maintenance' | 'not_allocated';

export interface EVSpecs {
  connectorType: 'Type 2' | 'CCS2' | 'CHAdeMO' | 'GB/T';
  powerKw: number;
  chargingTariffPerHour: number;
  includedInParking: boolean;
}

export interface Slot {
  id: string;
  number: string; // e.g. "A-101"
  levelId: string;
  zoneId: string;
  parkingAreaId: string;
  type: SlotType;
  status: SlotStatus;
  evSpecs?: EVSpecs;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  };
  directionalNotes?: string;
  isBookable: boolean;
  tariffOverride?: number;
}

export interface Zone {
  id: string;
  name: string; // e.g. "Zone A", "Zone B", "Zone EV"
  color: string;
  slotCount: number;
}

export interface LayoutElement {
  id: string;
  type: 'entry_gate' | 'exit_gate' | 'ramp' | 'walkway' | 'road' | 'arrow' | 'sign' | 'pillar';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  curveCorner?: 'top_right' | 'top_left' | 'bottom_right' | 'bottom_left' | 'none';
}

export interface ParkingLevel {
  id: string;
  name: string; // e.g. "Level 1 (Ground Floor)", "Level 2 (Basement)"
  levelNumber: number;
  zones: Zone[];
  elements: LayoutElement[];
  width: number;
  height: number;
}

export interface TariffPolicy {
  currency: 'INR';
  currencySymbol: '₹';
  freePeriodMinutes: number; // e.g. 15
  baseHourlyRate: number; // e.g. 40
  evChargingRatePerHour: number; // e.g. 80
  twoWheelerRatePerHour?: number; // e.g. 20 (defaults to 20 if undefined)
  twoWheelerEvRatePerHour?: number; // e.g. 40 (defaults to 40 if undefined)
  minimumCharge: number; // e.g. 40
  maxDailyFee: number; // e.g. 400
  roundingUnitMinutes: number; // e.g. 60
}

export interface ParkingArea {
  id: string;
  name: string;
  address: string;
  locationDescription: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  operatingHours: {
    open: string;
    close: string;
    is24x7?: boolean;
  };
  ownerAdminId: string;
  isPublished: boolean;
  levels: ParkingLevel[];
  tariffs: TariffPolicy;
  image?: string;
  overflowCount: number;
  overflowCapacity: number;
  overflowLastUpdatedBy?: string;
  overflowLastUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdditionalServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedDurationMins: number;
  available: boolean;
}

export interface RequestedService {
  serviceId: string;
  serviceName: string;
  price: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedStaffId?: string;
  completedAt?: string;
}

export type BookingStatus = 'reserved' | 'active_inside' | 'completed' | 'cancelled' | 'expired';

export interface Booking {
  id: string;
  bookingNumber: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  parkingAreaId: string;
  parkingAreaName: string;
  levelId: string;
  levelName: string;
  zoneId: string;
  zoneName: string;
  slotId: string;
  slotNumber: string;
  slotType: SlotType;
  vehiclePlate: string;
  vehiclePlateNormalized: string;
  startTime: string; // ISO
  endTime: string; // ISO
  expectedDurationHours: number;
  status: BookingStatus;
  ticketToken: string;
  servicesRequested: RequestedService[];
  estimatedTotal: number;
  isEVRequested: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VisitStatus = 'active' | 'payment_pending' | 'exit_pass_issued' | 'completed';

export interface PaymentRecord {
  transactionId: string;
  amount: number;
  currency: 'INR';
  method: 'UPI' | 'Card' | 'Cash' | 'Fastag';
  upiVpa?: string;
  status: 'pending' | 'simulated_success' | 'verified_success' | 'failed';
  isSimulated: boolean;
  paidAt: string;
  breakdown: {
    parkingFee: number;
    evChargingFee: number;
    servicesFee: number;
    taxAmount: number;
    totalAmount: number;
  };
}

export interface ExitPass {
  passToken: string;
  issuedAt: string;
  expiresAt: string;
  isConsumed: boolean;
  consumedAt?: string;
  consumedByOperatorId?: string;
}

export interface Visit {
  id: string;
  bookingId: string;
  parkingAreaId: string;
  parkingAreaName: string;
  slotId: string;
  slotNumber: string;
  levelName: string;
  zoneName: string;
  vehiclePlate: string;
  vehiclePlateNormalized: string;
  customerId: string;
  customerName: string;
  customerMobileMasked: string; // Strictly masked for data minimization
  entryTimestamp: string;
  entryMethod: 'qr_scan' | 'anpr_camera';
  entryOperatorId?: string;
  tariffSnapshot: TariffPolicy;
  exitTimestamp?: string;
  exitMethod?: 'qr_scan' | 'anpr_camera';
  exitOperatorId?: string;
  status: VisitStatus;
  services: RequestedService[];
  currentDurationMinutes: number;
  calculatedFee: number;
  paymentRecord?: PaymentRecord;
  exitPass?: ExitPass;
  savedCarLocation: {
    parkingAreaId: string;
    parkingAreaName: string;
    levelName: string;
    zoneName: string;
    slotNumber: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type IncidentStage =
  | 'initial_search'
  | 'push_notified'
  | 'sms_sent'
  | 'voice_call_initiated'
  | 'staff_dispatched'
  | 'acknowledged'
  | 'resolved';

export interface BlockedCarIncident {
  id: string;
  incidentNumber: string;
  parkingAreaId: string;
  parkingAreaName: string;
  slotNumber: string;
  reportedByCustomerId: string;
  reportedByCustomerMobileMasked: string;
  reportedAt: string;
  blockingPlate: string;
  blockingPlateNormalized: string;
  description?: string;
  photoUrl?: string;
  matchedBookingId?: string;
  driverUserId?: string;
  driverMobileMasked?: string;
  currentStage: IncidentStage;
  stageTimestamps: Partial<Record<IncidentStage, string>>;
  driverResponse?: 'moving_now' | 'need_5_mins' | 'not_my_vehicle';
  gracePeriodExpiresAt?: string;
  gracePeriodUsed: boolean;
  assignedStaffId?: string;
  staffAssignedAt?: string;
  staffArrivedAt?: string;
  staffNotes?: string;
  resolution?: 'driver_moved' | 'staff_cleared' | 'false_alarm' | 'cancelled';
  resolvedAt?: string;
  isSimulated: boolean;
  auditTrail: {
    timestamp: string;
    action: string;
    actor: string;
    details?: string;
  }[];
}

export interface StaffTask {
  id: string;
  type: 'blocked_car' | 'ev_relocation' | 'car_wash' | 'gate_assistance' | 'overflow_check';
  parkingAreaId: string;
  slotNumber?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'claimed' | 'in_progress' | 'resolved' | 'cancelled';
  assignedStaffId?: string;
  assignedStaffName?: string;
  claimedAt?: string;
  resolvedAt?: string;
  relatedEntityId?: string; // incidentId, bookingId, etc.
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  parkingAreaId?: string;
  targetResource: string;
  details: string;
}

export interface StaffShiftConfig {
  id: string;
  parkingAreaId: string;
  staffId: string;
  staffName: string;
  roleTitle: 'Entry Gate Attendant' | 'Exit Gate Attendant' | 'Zone Marshall' | 'Service Specialist' | 'Supervisor';
  assignedZoneId?: string;
  shiftStart: string;
  shiftEnd: string;
  status: 'scheduled' | 'on_duty' | 'break' | 'off_duty';
  updatedBy: string;
  updatedAt: string;
}

export interface StaffingRecommendation {
  zoneId: string;
  zoneName: string;
  expectedCarsPerHour: number;
  carsPerAttendantPerHourCapacity: number;
  recommendedStaffCount: number;
  currentStaffCount: number;
  assumptions: string;
}

export interface OperationsMetrics {
  totalSlots: number;
  availableSlots: number;
  reservedSlots: number;
  occupiedSlots: number;
  underMaintenanceSlots: number;
  evSlotsTotal: number;
  evSlotsAvailable: number;
  occupancyRatePercent: number;
  activeSessionsCount: number;
  averageDurationMinutes: number;
  todayRevenueINR: number;
  pendingStaffTasksCount: number;
  blockedCarIncidentsCount: number;
  overflowCount: number;
  overflowCapacity: number;
}
