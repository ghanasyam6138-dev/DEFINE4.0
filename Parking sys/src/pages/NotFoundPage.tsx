import React from 'react';
import { Link } from 'react-router-dom';
import { Car, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', maxWidth: '540px', margin: '0 auto' }}>
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: '#eff6ff',
          color: '#7e22ce',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px'
        }}
      >
        <Car size={32} />
      </div>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#120f26' }}>
        404
      </h1>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', marginTop: '6px' }}>
        Page Not Found
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.92rem', marginTop: '8px', marginBottom: '24px' }}>
        The requested parking URL or operational resource could not be found.
      </p>
      <Link to="/" className="btn btn-primary">
        <ArrowLeft size={16} />
        <span>Return to Parking Facilities</span>
      </Link>
    </div>
  );
};
