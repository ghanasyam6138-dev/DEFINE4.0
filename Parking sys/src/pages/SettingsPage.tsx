import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/dbService';
import { useToast } from '../context/ToastContext';
import {
  RotateCcw,
  Database,
  Lock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);

  const handleResetDemoData = async () => {
    if (!isAdmin) {
      error('Unauthorized', 'Only facility administrators can reset demo datasets.');
      return;
    }

    setResetting(true);
    await dbService.resetDemoData(user?.id || 'admin', user?.name || 'Administrator');
    setResetting(false);
    setConfirmReset(false);
    success('Demo Mall Reset Complete', 'Demo Mall slots, bookings, visits, and incidents have been safely reset to initial seed state.');
  };

  return (
    <div style={{ maxWidth: '780px', margin: '20px auto', padding: '0 16px' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">System Settings & Configuration</h1>
          <p className="page-desc">
            Environment telemetry, simulation controls, and demo dataset maintenance.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Environment Status Card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#120f26', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} style={{ color: 'var(--primary)' }} />
            <span>Database & Cloud Architecture</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Firebase Realtime Database:</span>
              <strong style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={15} /> Active ({import.meta.env.VITE_FIREBASE_PROJECT_ID || 'parksmart-demo-234'})
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Database Endpoint:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#120f26' }}>
                asia-southeast1.firebasedatabase.app
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Storage Driver:</span>
              <span style={{ color: '#120f26', fontWeight: 600 }}>
                Firebase Cloud Storage & Client Memory Resilient Mirror
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: '#64748b' }}>Password Encryption:</span>
              <span style={{ color: '#120f26', fontWeight: 600 }}>
                PBKDF2-SHA256 (10,000 iterations + Cryptographic Salt)
              </span>
            </div>
          </div>
        </div>

        {/* Admin Demo Data Reset Card (Section S) */}
        {isAdmin && (
          <div className="card" style={{ padding: '24px', border: '1.5px solid #fde68a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <RotateCcw size={18} style={{ color: '#d97706' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#120f26' }}>
                Reset Demo Mall Dataset
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px', lineHeight: '1.5' }}>
              Safely resets ONLY the dedicated Demo Mall slots, active bookings, sample visits, and blocked-car tasks back to their original clean seed state.
              This never deletes production venues or unrelated administrator accounts.
            </p>

            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="btn btn-secondary btn-sm"
                style={{ color: '#d97706', borderColor: '#fde68a' }}
              >
                <RotateCcw size={14} />
                <span>Reset Demo Mall to Seed State</span>
              </button>
            ) : (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '16px' }}>
                <strong style={{ fontSize: '0.88rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} /> Confirm Demo Reset?
                </strong>
                <p style={{ fontSize: '0.8rem', color: '#78350f', marginTop: '4px', marginBottom: '12px' }}>
                  All current reservations and active visits in Demo Mall will be restored to default demo state.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleResetDemoData}
                    disabled={resetting}
                    className="btn btn-danger btn-sm"
                  >
                    <span>{resetting ? 'Resetting...' : 'Yes, Reset Demo Mall'}</span>
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security & Data Retention Guidance */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#120f26', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} style={{ color: '#059669' }} />
            <span>Privacy & Data Minimization Architecture</span>
          </h3>

          <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: '#475569', lineHeight: '1.7' }}>
            <li>
              <strong>Data Minimization:</strong> Service providers and attendants only view bay numbers and task descriptions. Customer mobile numbers and billing secrets are never exposed on task tickets.
            </li>
            <li>
              <strong>Unguessable Tokens:</strong> QR passes contain cryptographically strong random nonces (never plaintext phone numbers or passwords).
            </li>
            <li>
              <strong>Driver Phone Protection:</strong> In blocked car incidents, phone numbers are masked on both ends and routing occurs via automated push and virtual SMS links.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
