import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { dbService } from '../services/dbService';
import { useDbRevision } from '../hooks/useDbRevision';
import { ShieldCheck, UserCheck, Phone, Lock, User } from 'lucide-react';
import type { ParkingArea } from '../types';

export const StaffAccessPage: React.FC = () => {
  const { requestStaffAccess, isApprovedStaff, user } = useAuth();
  const { error, warning } = useToast();
  const navigate = useNavigate();
  useDbRevision();

  const parkingAreas = dbService.getParkingAreas(true);

  const [name, setName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [parkingAreaId, setParkingAreaId] = useState<string>(parkingAreas[0]?.id || '');
  const [notes, setNotes] = useState<string>('Gate attendant & zone marshall application');
  const [loading, setLoading] = useState<boolean>(false);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await requestStaffAccess(name, mobile, password, parkingAreaId, notes);
    setLoading(false);

    if (res.success) {
      warning('Submitted for Review', 'Your staff access request has been recorded. Current status: PENDING ADMIN APPROVAL.');
      navigate('/staff');
    } else {
      error('Request Failed', res.error || 'Could not process staff application.');
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '40px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: '32px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '12px',
              background: '#dcfce7',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px'
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#120f26' }}>
            Staff Access Request
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '4px' }}>
            Apply for operational console access. Requires administrator approval before activation.
          </p>
        </div>

        {isApprovedStaff ? (
          <div style={{ textAlign: 'center', background: '#ecfdf5', padding: '20px', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
            <h3 style={{ color: '#065f46', fontWeight: 700 }}>Staff Account Active</h3>
            <p style={{ fontSize: '0.85rem', color: '#047857', marginTop: '4px' }}>
              Logged in as {user?.name} (ID: {user?.staffId})
            </p>
            <Link to="/staff" className="btn btn-primary" style={{ marginTop: '16px' }}>
              Open Staff Console
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRequestSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+91 98765 43212"
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                  required
                />
              </div>
              <span className="form-helper">10-digit registered Indian mobile</span>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Target Parking Facility</label>
              <select
                value={parkingAreaId}
                onChange={(e) => setParkingAreaId(e.target.value)}
                className="form-select"
              >
                {parkingAreas.map((p: ParkingArea) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Role Notes / Shift Request</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-textarea"
                rows={2}
                placeholder="Gate 1 scanner, EV bay monitoring, etc."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '12px' }}
            >
              <UserCheck size={16} />
              <span>{loading ? 'Submitting...' : 'Submit Access Request'}</span>
            </button>
          </form>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
          Already approved?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Log In Here
          </Link>
        </div>
      </div>
    </div>
  );
};
