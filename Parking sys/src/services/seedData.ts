import type { ParkingArea, ParkingLevel, Slot, User, Booking, Visit, TariffPolicy, BlockedCarIncident, StaffTask } from '../types';
import { hashPasswordWithSalt } from './cryptoService';

export const DEMO_MALL_ID = 'area-demo-mall-01';

export const DEFAULT_TARIFF: TariffPolicy = {
  currency: 'INR',
  currencySymbol: '₹',
  freePeriodMinutes: 15,
  baseHourlyRate: 40,
  evChargingRatePerHour: 80,
  twoWheelerRatePerHour: 20,
  twoWheelerEvRatePerHour: 40,
  minimumCharge: 40,
  maxDailyFee: 400,
  roundingUnitMinutes: 60
};

export async function createDemoSeedData(): Promise<{
  users: User[];
  parkingAreas: ParkingArea[];
  slots: Slot[];
  bookings: Booking[];
  visits: Visit[];
  incidents: BlockedCarIncident[];
  tasks: StaffTask[];
}> {
  // Pre-hash demo password "Demo@1234" and "Admin@1234" safely
  const demoPassResult = await hashPasswordWithSalt('Demo@1234');

  const users: User[] = [
    {
      id: 'usr-mall-admin-01',
      name: 'Vikram Mehta (Demo Mall Admin)',
      mobile: '+919876543211',
      passwordHash: demoPassResult.hash,
      salt: demoPassResult.salt,
      role: 'parking_admin',
      status: 'active',
      assignedParkingAreaId: DEMO_MALL_ID,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-01T08:00:00Z'
    },
    {
      id: 'usr-staff-approved-01',
      name: 'Ramesh Kumar',
      mobile: '+919876543212',
      passwordHash: demoPassResult.hash,
      salt: demoPassResult.salt,
      role: 'staff',
      status: 'active',
      staffId: 'STF-101',
      assignedParkingAreaId: DEMO_MALL_ID,
      approvalDetails: {
        approvedBy: 'usr-mall-admin-01',
        approvedByName: 'Vikram Mehta',
        approvedAt: '2026-10-02T09:00:00Z',
        notes: 'Gate and Zone A attendant'
      },
      createdAt: '2026-10-02T08:30:00Z',
      updatedAt: '2026-10-02T09:00:00Z'
    },
    {
      id: 'usr-staff-pending-01',
      name: 'Priya Sharma',
      mobile: '+919876543213',
      passwordHash: demoPassResult.hash,
      salt: demoPassResult.salt,
      role: 'staff',
      status: 'pending_approval',
      assignedParkingAreaId: DEMO_MALL_ID,
      createdAt: '2026-10-09T09:15:00Z',
      updatedAt: '2026-10-09T09:15:00Z'
    },
    {
      id: 'usr-customer-01',
      name: 'Arjun Verma',
      mobile: '+919876543214',
      passwordHash: demoPassResult.hash,
      salt: demoPassResult.salt,
      role: 'customer',
      status: 'active',
      createdAt: '2026-10-05T10:00:00Z',
      updatedAt: '2026-10-05T10:00:00Z'
    },
    {
      id: 'usr-customer-02',
      name: 'Sneha Patel',
      mobile: '+919876543215',
      passwordHash: demoPassResult.hash,
      salt: demoPassResult.salt,
      role: 'customer',
      status: 'active',
      createdAt: '2026-10-06T11:00:00Z',
      updatedAt: '2026-10-06T11:00:00Z'
    }
  ];

  const level1: ParkingLevel = {
    id: 'lvl-demo-g',
    name: 'Level 1 (Ground Floor - North Wing)',
    levelNumber: 1,
    width: 800,
    height: 520,
    zones: [
      { id: 'zone-a', name: 'Zone A (Standard)', color: '#ea580c', slotCount: 8 },
      { id: 'zone-ev', name: 'Zone EV (Fast Chargers)', color: '#10b981', slotCount: 4 },
      { id: 'zone-2w', name: 'Zone 2W (Bikes & Scooters)', color: '#f97316', slotCount: 3 }
    ],
    elements: [
      { id: 'el-entry', type: 'entry_gate', label: 'North Entry Gate (Gate 1)', x: 40, y: 30, width: 120, height: 40, direction: 'down' },
      { id: 'el-exit', type: 'exit_gate', label: 'East Exit Gate (Gate 2)', x: 640, y: 30, width: 120, height: 40, direction: 'up' },
      { id: 'el-road-main', type: 'road', label: 'Main Drive Lane (Aisle 1)', x: 170, y: 240, width: 460, height: 60, direction: 'right' },
      { id: 'el-ramp-up', type: 'ramp', label: 'Ramp to L2 Basement', x: 660, y: 420, width: 110, height: 60, direction: 'down' },
      { id: 'el-walkway-1', type: 'walkway', label: 'Mall Entrance Walkway', x: 340, y: 20, width: 140, height: 45, direction: 'up' }
    ]
  };

  const level2: ParkingLevel = {
    id: 'lvl-demo-b1',
    name: 'Level 2 (Basement B1 - South Wing)',
    levelNumber: 2,
    width: 800,
    height: 520,
    zones: [
      { id: 'zone-b', name: 'Zone B (Standard & Accessible)', color: '#a855f7', slotCount: 8 }
    ],
    elements: [
      { id: 'el-road-b1', type: 'road', label: 'Basement Central Lane', x: 160, y: 230, width: 480, height: 60, direction: 'right' },
      { id: 'el-ramp-dn', type: 'ramp', label: 'Ramp from Ground Floor', x: 40, y: 30, width: 110, height: 50, direction: 'down' },
      { id: 'el-lift', type: 'walkway', label: 'Elevator Lobby / Escalator', x: 350, y: 20, width: 120, height: 45, direction: 'up' }
    ]
  };

  const parkingAreas: ParkingArea[] = [
    {
      id: DEMO_MALL_ID,
      name: 'Demo Mall & Grand Galleria',
      address: '100 Feet Outer Ring Road, Indiranagar, Bengaluru, Karnataka 560038',
      locationDescription: 'Prime commercial hub with 550+ retail stores, IMAX cinema, and multi-tier parking',
      coordinates: { lat: 12.9716, lng: 77.5946 },
      operatingHours: { open: '08:00', close: '23:30', is24x7: false },
      ownerAdminId: 'usr-mall-admin-01',
      isPublished: true,
      levels: [level1, level2],
      tariffs: DEFAULT_TARIFF,
      overflowCount: 14,
      overflowCapacity: 50,
      overflowLastUpdatedBy: 'Ramesh Kumar (STF-101)',
      overflowLastUpdatedAt: '2026-10-09T17:30:00Z',
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-09T17:30:00Z'
    },
    {
      id: 'area-tech-park-02',
      name: 'EcoSpace Tech Park - Tower C',
      address: 'Bellandur Sarjapur Junction, Outer Ring Road, Bengaluru 560103',
      locationDescription: 'Corporate business campus with dedicated visitor parking & EV charging bays',
      coordinates: { lat: 12.9248, lng: 77.6845 },
      operatingHours: { open: '00:00', close: '23:59', is24x7: true },
      ownerAdminId: 'usr-mall-admin-01',
      isPublished: true,
      levels: [
        {
          id: 'lvl-tech-1',
          name: 'Ground Level (Visitor Bay)',
          levelNumber: 1,
          width: 800,
          height: 500,
          zones: [
            { id: 'zone-tech-a', name: 'Visitor Zone A', color: '#d946ef', slotCount: 6 },
            { id: 'zone-tech-ev', name: 'EV Supercharger Bay', color: '#10b981', slotCount: 3 }
          ],
          elements: [
            { id: 'tech-entry', type: 'entry_gate', label: 'Main Security Gate 1', x: 50, y: 30, width: 130, height: 40 },
            { id: 'tech-exit', type: 'exit_gate', label: 'Exit Gate 3', x: 620, y: 30, width: 130, height: 40 }
          ]
        }
      ],
      tariffs: {
        currency: 'INR',
        currencySymbol: '₹',
        freePeriodMinutes: 30,
        baseHourlyRate: 30,
        evChargingRatePerHour: 75,
        minimumCharge: 30,
        maxDailyFee: 350,
        roundingUnitMinutes: 60
      },
      overflowCount: 5,
      overflowCapacity: 30,
      createdAt: '2026-10-02T10:00:00Z',
      updatedAt: '2026-10-08T12:00:00Z'
    }
  ];

  // Generate Slots for Demo Mall
  const slots: Slot[] = [];

  // Ground Level - Zone A (Standard)
  for (let i = 1; i <= 8; i++) {
    const slotNum = `A-${100 + i}`;
    const isOccupied = i === 3;
    const isReserved = i === 1; // Reserved for Customer 1
    const isMaint = i === 7;

    slots.push({
      id: `slot-demo-${slotNum.toLowerCase()}`,
      number: slotNum,
      levelId: level1.id,
      zoneId: 'zone-a',
      parkingAreaId: DEMO_MALL_ID,
      type: 'standard',
      status: isOccupied ? 'occupied' : isReserved ? 'reserved' : isMaint ? 'under_maintenance' : 'available',
      coordinates: {
        x: 60 + (i - 1) * 85,
        y: 120,
        width: 70,
        height: 120
      },
      directionalNotes: 'Turn right after North Entry Gate, first lane on your right',
      isBookable: !isMaint
    });
  }

  // Ground Level - Zone EV (4 Fast Chargers)
  const evConnectors: ('CCS2' | 'Type 2')[] = ['CCS2', 'CCS2', 'Type 2', 'CCS2'];
  for (let i = 1; i <= 4; i++) {
    const slotNum = `EV-${String(i).padStart(2, '0')}`;
    const isReserved = i === 2; // Reserved for Customer 2
    slots.push({
      id: `slot-demo-${slotNum.toLowerCase()}`,
      number: slotNum,
      levelId: level1.id,
      zoneId: 'zone-ev',
      parkingAreaId: DEMO_MALL_ID,
      type: 'ev',
      status: isReserved ? 'reserved' : 'available',
      evSpecs: {
        connectorType: evConnectors[i - 1],
        powerKw: 60,
        chargingTariffPerHour: 80,
        includedInParking: false
      },
      coordinates: {
        x: 60 + (i - 1) * 95,
        y: 320,
        width: 80,
        height: 120
      },
      directionalNotes: 'Follow green EV overhead markings toward west charging bay',
      isBookable: true
    });
  }

  // Ground Level - Zone 2W (2-Wheelers & 2W EV)
  for (let i = 1; i <= 3; i++) {
    const isEV = i === 3;
    const slotNum = isEV ? '2W-EV-01' : `2W-0${i}`;
    slots.push({
      id: `slot-demo-${slotNum.toLowerCase()}`,
      number: slotNum,
      levelId: level1.id,
      zoneId: 'zone-2w',
      parkingAreaId: DEMO_MALL_ID,
      type: isEV ? 'two_wheeler_ev' : 'two_wheeler',
      status: 'available',
      evSpecs: isEV ? {
        connectorType: 'Type 2',
        powerKw: 3.3,
        chargingTariffPerHour: 40,
        includedInParking: false
      } : undefined,
      coordinates: {
        x: 480 + (i - 1) * 60,
        y: 340,
        width: 48,
        height: 90
      },
      directionalNotes: 'Dedicated two-wheeler bay near pedestrian gate',
      isBookable: true
    });
  }

  // Level 2 (B1) - Zone B (Standard & Accessible)
  for (let i = 1; i <= 8; i++) {
    const slotNum = `B-${200 + i}`;
    const isAccessible = i === 1 || i === 2;
    slots.push({
      id: `slot-demo-${slotNum.toLowerCase()}`,
      number: slotNum,
      levelId: level2.id,
      zoneId: 'zone-b',
      parkingAreaId: DEMO_MALL_ID,
      type: isAccessible ? 'accessible' : 'standard',
      status: 'available',
      coordinates: {
        x: 60 + (i - 1) * 85,
        y: 130,
        width: 70,
        height: 120
      },
      directionalNotes: isAccessible ? 'Next to Elevator Lobby B1' : 'Take Down Ramp, proceed straight to Lane 2',
      isBookable: true
    });
  }


  // Sample active visit (vehicle inside at A-103)
  const visit1: Visit = {
    id: 'vst-demo-01',
    bookingId: 'bk-demo-pre-03',
    parkingAreaId: DEMO_MALL_ID,
    parkingAreaName: 'Demo Mall & Grand Galleria',
    slotId: 'slot-demo-a-103',
    slotNumber: 'A-103',
    levelName: 'Level 1 (Ground Floor - North Wing)',
    zoneName: 'Zone A (Standard)',
    vehiclePlate: 'DL 03 C 9988',
    vehiclePlateNormalized: 'DL03C9988',
    customerId: 'usr-customer-02',
    customerName: 'Sneha Patel',
    customerMobileMasked: '+91 98*** **215',
    entryTimestamp: '2026-10-09T16:30:00Z',
    entryMethod: 'anpr_camera',
    entryOperatorId: 'usr-staff-approved-01',
    tariffSnapshot: DEFAULT_TARIFF,
    status: 'active',
    services: [],
    currentDurationMinutes: 95,
    calculatedFee: 80,
    savedCarLocation: {
      parkingAreaId: DEMO_MALL_ID,
      parkingAreaName: 'Demo Mall & Grand Galleria',
      levelName: 'Level 1 (Ground Floor - North Wing)',
      zoneName: 'Zone A (Standard)',
      slotNumber: 'A-103',
      notes: 'Pillar 4B, near North Wing entrance'
    },
    createdAt: '2026-10-09T16:30:00Z',
    updatedAt: '2026-10-09T18:05:00Z'
  };

  // Sample Blocked Car Incident for testing escalation
  const incident1: BlockedCarIncident = {
    id: 'inc-demo-01',
    incidentNumber: 'INC-2026-0042',
    parkingAreaId: DEMO_MALL_ID,
    parkingAreaName: 'Demo Mall & Grand Galleria',
    slotNumber: 'A-102',
    reportedByCustomerId: 'usr-customer-01',
    reportedByCustomerMobileMasked: '+91 98*** **214',
    reportedAt: '2026-10-09T17:45:00Z',
    blockingPlate: 'MH 12 CD 5678',
    blockingPlateNormalized: 'MH12CD5678',
    description: 'White SUV parked across the bay line blocking driver door access',
    matchedBookingId: 'bk-demo-pre-03',
    driverUserId: 'usr-customer-02',
    driverMobileMasked: '+91 98*** **215',
    currentStage: 'push_notified',
    stageTimestamps: {
      initial_search: '2026-10-09T17:45:05Z',
      push_notified: '2026-10-09T17:45:10Z'
    },
    gracePeriodUsed: false,
    isSimulated: true,
    auditTrail: [
      {
        timestamp: '2026-10-09T17:45:00Z',
        action: 'INCIDENT_CREATED',
        actor: 'Customer (usr-customer-01)',
        details: 'Reported blocking car MH 12 CD 5678 at A-102'
      },
      {
        timestamp: '2026-10-09T17:45:10Z',
        action: 'STAGE_PUSH_NOTIFICATION_SENT',
        actor: 'ParkSmart Escalation Engine',
        details: 'Sent high-priority push alert to registered vehicle owner'
      }
    ]
  };

  const tasks: StaffTask[] = [
    {
      id: 'tsk-demo-01',
      type: 'blocked_car',
      parkingAreaId: DEMO_MALL_ID,
      slotNumber: 'A-102',
      title: 'Investigate Blocked Vehicle at A-102',
      description: 'Vehicle MH 12 CD 5678 reported blocking bay. Check if driver is on way.',
      priority: 'high',
      status: 'pending',
      relatedEntityId: 'inc-demo-01',
      createdAt: '2026-10-09T17:46:00Z',
      updatedAt: '2026-10-09T17:46:00Z'
    }
  ];

  const booking1: Booking = {
    id: 'bkg-demo-01',
    bookingNumber: 'PS-MALL-1001',
    customerId: 'usr-customer-01',
    customerName: 'Arjun Verma',
    customerMobile: '+919876543214',
    parkingAreaId: DEMO_MALL_ID,
    parkingAreaName: 'Demo Mall & Grand Galleria',
    levelId: level1.id,
    levelName: level1.name,
    zoneId: 'zone-a',
    zoneName: 'Zone A (Standard)',
    slotId: 'slot-demo-a-101',
    slotNumber: 'A-101',
    slotType: 'standard',
    vehiclePlate: 'KA 01 AB 1234',
    vehiclePlateNormalized: 'KA01AB1234',
    startTime: new Date(Date.now() - 30 * 60000).toISOString(),
    endTime: new Date(Date.now() + 150 * 60000).toISOString(),
    expectedDurationHours: 3,
    status: 'reserved',
    ticketToken: 'TKT-DEMO-1001-TOKEN',
    servicesRequested: [],
    estimatedTotal: 120,
    isEVRequested: false,
    createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 35 * 60000).toISOString()
  };

  return {
    users,
    parkingAreas,
    slots,
    bookings: [booking1],
    visits: [visit1],
    incidents: [incident1],
    tasks
  };
}
