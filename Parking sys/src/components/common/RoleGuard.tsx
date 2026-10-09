import React from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { dbService } from '../../services/dbService';
import { ShieldAlert, Clock, RefreshCw, ArrowLeft } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: ('customer' | 'staff' | 'parking_admin' | 'platform_admin')[];
  disallowedRoles?: ('customer' | 'staff' | 'parking_admin' | 'platform_admin')[];
  allowUnauthenticated?: boolean;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  disallowedRoles,
  allowUnauthenticated = false
}) => {
  const { user, role, isAuthenticated, isPendingStaff, isLoading } = useAuth();
  const navigate = useNavigate();
  const { warning: warnToast } = useToast();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} className="spin-icon" style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Checking authorization credentials...</p>
        </div>
      </div>
    );
  }

  // If role is explicitly disallowed (e.g. staff accessing customer booking)
  if (role && disallowedRoles && disallowedRoles.includes(role)) {
    return (
      <div style={{ maxWidth: '540px', margin: '40px auto', padding: '0 16px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ShieldAlert size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
            Access Restricted
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '24px' }}>
            {role === 'staff'
              ? 'Staff members are restricted to operational consoles and cannot access the customer reservation and booking area.'
              : `You do not have permission to view this section with your current account role (${role}).`}
          </p>
          <Link to="/" className="btn btn-primary">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!allowUnauthenticated && (!isAuthenticated || !user)) {
    return <Navigate to="/login" replace />;
  }

  // Handle staff pending approval
  if (allowedRoles && allowedRoles.includes('staff') && isPendingStaff) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px', borderTop: '4px solid #f59e0b' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Clock size={36} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#120f26', marginBottom: '8px' }}>
            PENDING ADMIN APPROVAL
          </h2>
          <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
            Your staff access request has been recorded and is currently awaiting verification by a facility administrator.
            Operational tools, ANPR cameras, and live slot maps are restricted until approved.
          </p>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', textAlign: 'left', marginBottom: '24px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b' }}>Staff Applicant:</span>
              <strong style={{ color: '#120f26' }}>{user?.name || 'Staff Applicant'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b' }}>Registered Mobile:</span>
              <strong style={{ color: '#120f26' }}>{user?.mobile || 'N/A'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Application Status:</span>
              <span className="badge badge-reserved">Pending Admin Review</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                if (user?.id) {
                  const fresh = dbService.getUserById(user.id);
                  if (fresh && fresh.status === 'pending_approval') {
                    warnToast(
                      'Still Pending Approval',
                      'Your staff account is awaiting admin verification. Returning to previous page.'
                    );
                    navigate(-1);
                  } else {
                    // Approved — refresh session
                    window.location.reload();
                  }
                } else {
                  window.location.reload();
                }
              }}
              className="btn btn-secondary"
            >
              <RefreshCw size={16} />
              <span>Check Status</span>
            </button>
            <Link to="/" className="btn btn-primary">
              <ArrowLeft size={16} />
              <span>Back to Facilities</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if role is allowed
  if (role && allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div style={{ maxWidth: '540px', margin: '40px auto', padding: '0 16px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ShieldAlert size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#120f26', marginBottom: '8px' }}>
            Access Restricted
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: '24px' }}>
            You do not have permission to view this section with your current account role (<strong>{role}</strong>).
          </p>
          <Link to="/" className="btn btn-primary">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
