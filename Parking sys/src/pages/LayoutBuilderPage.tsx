import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { useDbRevision } from '../hooks/useDbRevision';
import { LayoutBuilder } from '../components/builder/LayoutBuilder';
import { ArrowLeft } from 'lucide-react';

export const LayoutBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  useDbRevision();
  const area = id ? dbService.getParkingAreaById(id) : null;

  if (!area) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2>Facility Not Found</h2>
        <Link to="/admin" className="btn btn-primary" style={{ marginTop: '16px' }}>
          Back to Admin Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/admin" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.88rem' }}>
              <ArrowLeft size={16} /> Back to Facilities
            </Link>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#120f26', marginTop: '6px' }}>
            Visual Layout Builder — {area.name}
          </h1>
        </div>
      </div>

      <LayoutBuilder parkingArea={area} />
    </div>
  );
};
