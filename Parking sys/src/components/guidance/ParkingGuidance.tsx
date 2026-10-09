import React from 'react';
import type { ParkingArea, Visit, Booking } from '../../types';
import { Compass, MapPin, Navigation } from 'lucide-react';

interface ParkingGuidanceProps {
  parkingArea: ParkingArea;
  booking?: Booking;
  visit?: Visit;
  slotNumber: string;
}

export const ParkingGuidance: React.FC<ParkingGuidanceProps> = ({
  parkingArea,
  booking,
  visit,
  slotNumber
}) => {
  const currentSlot = parkingArea.levels.flatMap((l) => l.zones).length > 0
    ? slotNumber
    : 'A-101';

  const levelName = visit?.levelName || booking?.levelName || parkingArea.levels[0]?.name || 'Ground Floor';
  const zoneName = visit?.zoneName || booking?.zoneName || 'Zone A';
  const notes = visit?.savedCarLocation.notes || 'Turn right after North Entry Gate 1, park in bay next to Pillar 4B.';

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Compass size={22} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#120f26' }}>
            Smart Wayfinding & Find My Car
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Facility Schematic Route & Pinpointed Bay Coordinates
          </p>
        </div>
      </div>

      {/* Target Location Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Assigned Bay</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7e22ce' }}>{currentSlot}</div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Facility Level</span>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#120f26', marginTop: '6px' }}>{levelName}</div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Designated Zone</span>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#120f26', marginTop: '6px' }}>{zoneName}</div>
        </div>
      </div>

      {/* Turn-by-Turn Schematic Guidance */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <strong style={{ fontSize: '0.88rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Navigation size={16} /> Turn-by-Turn Directional Steps:
        </strong>
        <ol style={{ paddingLeft: '20px', fontSize: '0.85rem', color: '#1e3a8a', lineHeight: '1.7' }}>
          <li>Enter through <strong>North Entry Gate (Gate 1)</strong> on 100 Feet Ring Road.</li>
          <li>Proceed 30 meters forward along Lane 1 following the blue overhead signs.</li>
          <li>Turn right into North Wing Parking Lane.</li>
          <li>Park your vehicle in <strong>Bay {currentSlot}</strong> on your right.</li>
          <li>Exit to mall retail area via <strong>Walkway 1 (Escalator Lobby B)</strong>.</li>
        </ol>
      </div>

      {/* Directional Notes from Builder */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <MapPin size={18} style={{ color: '#d97706', marginTop: '2px', flexShrink: 0 }} />
        <div>
          <strong style={{ fontSize: '0.82rem', color: '#120f26' }}>Pillar Landmark & Notes:</strong>
          <p style={{ fontSize: '0.82rem', color: '#475569', marginTop: '2px' }}>{notes}</p>
        </div>
      </div>
    </div>
  );
};
