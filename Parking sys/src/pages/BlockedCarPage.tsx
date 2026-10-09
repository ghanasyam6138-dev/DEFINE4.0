import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { BlockedCarManager } from '../components/blockedCar/BlockedCarManager';

export const BlockedCarPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const areaParam = searchParams.get('area') || undefined;
  const slotParam = searchParams.get('slot') || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header" style={{ marginBottom: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-occupied">AUTOMATED RESOLUTION HOTLINE</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Staged Escalation System</span>
          </div>
          <h1 className="page-title">Blocked Vehicle Incident Center</h1>
          <p className="page-desc">
            Report blocked bays, track automated driver notifications (Push &gt; SMS &gt; Voice), and dispatch on-duty marshalls.
          </p>
        </div>
      </div>

      <BlockedCarManager
        initialParkingAreaId={areaParam}
        initialSlotNumber={slotParam}
      />
    </div>
  );
};
