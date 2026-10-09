import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LogIn, Phone, Lock, Car, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { success, error, warning } = useToast();
  const navigate = useNavigate();

  const [mobile, setMobile] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(mobile, password);
    setLoading(false);

    if (result.success) {
      if (result.isPendingApproval) {
        warning('Pending Approval', 'Your staff account is currently PENDING ADMIN APPROVAL.');
        navigate('/staff');
      } else {
        success('Welcome Back!', 'Logged in successfully.');
        if (result.role === 'customer') {
          navigate('/customer');
        } else if (result.role === 'staff') {
          navigate('/staff');
        } else if (result.role === 'parking_admin' || result.role === 'platform_admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }
    } else {
      error('Login Failed', result.error || 'Invalid credentials.');
    }
  };

  const fillCredentials = (presetMobile: string) => {
    setMobile(presetMobile);
    setPassword('Demo@1234');
  };

  return (
    <div style={{ maxWidth: '440px', margin: '40px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: '32px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #7e22ce, #6b21a8)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            <Car size={26} strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#120f26' }}>
            Log in to ParkSmart
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '4px' }}>
            Enter your registered mobile number and password
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <div style={{ position: 'relative' }}>
              <Phone size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91 98765 43214"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                required
              />
            </div>
            <span className="form-helper">
              Standard 10-digit Indian mobile number
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
          >
            <LogIn size={16} />
            <span>{loading ? 'Authenticating...' : 'Log In'}</span>
          </button>
        </form>

        {/* Demo Fast Login Switcher */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={13} style={{ color: '#f59e0b' }} /> Quick Demo Credentials (Demo@1234):
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => fillCredentials('+919876543214')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', justifyContent: 'flex-start' }}
            >
              Customer (Arjun)
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('+919876543212')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', justifyContent: 'flex-start' }}
            >
              Staff (Approved)
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('+919876543213')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', justifyContent: 'flex-start' }}
            >
              Staff (Priya - Pending)
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('+919876543211')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', justifyContent: 'flex-start' }}
            >
              Facility Admin
            </button>
            </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign Up
          </Link>
          <span style={{ margin: '0 8px' }}>•</span>
          <Link to="/staff/access" style={{ color: '#059669', fontWeight: 600 }}>
            Staff Access
          </Link>
        </div>
      </div>
    </div>
  );
};
