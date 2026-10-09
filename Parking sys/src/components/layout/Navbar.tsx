import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Car,
  LayoutDashboard,
  Sliders,
  LogOut,
  LogIn,
  UserPlus,
  Compass,
  AlertTriangle,
  QrCode
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, role, isAuthenticated, isCustomer, isApprovedStaff, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="navbar">
      <div className="navbar-container">
        <Link to="/" className="brand">
          <div className="brand-icon">
            <Car size={22} strokeWidth={2.5} />
          </div>
          <div className="brand-title">
            <span className="brand-name">ParkSmart</span>
            <span className="brand-sub">Smart Parking & Venue Ops</span>
          </div>
        </Link>

        <nav className="nav-links">
          <Link to="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
            <Compass size={17} />
            <span>Facilities</span>
          </Link>

          {isCustomer && (
            <Link to="/customer" className={`nav-item ${isActive('/customer') ? 'active' : ''}`}>
              <LayoutDashboard size={17} />
              <span>Customer Hub</span>
            </Link>
          )}

          {isApprovedStaff && (
            <Link to="/staff" className={`nav-item ${isActive('/staff') ? 'active' : ''}`}>
              <QrCode size={17} />
              <span>Staff Console</span>
            </Link>
          )}

          {isAdmin && (
            <>
              <Link to="/admin" className={`nav-item ${isActive('/admin') ? 'active' : ''}`}>
                <Sliders size={17} />
                <span>Facility Admin</span>
              </Link>
              <Link to="/admin/operations" className={`nav-item ${isActive('/admin/operations') ? 'active' : ''}`}>
                <LayoutDashboard size={17} />
                <span>Live Operations</span>
              </Link>
            </>
          )}

          <Link to="/blocked-car" className={`nav-item ${isActive('/blocked-car') ? 'active' : ''}`}>
            <AlertTriangle size={17} />
            <span>Report Blocked Car</span>
          </Link>

          <Link to="/settings" className={`nav-item ${isActive('/settings') ? 'active' : ''}`}>
            <Sliders size={17} />
            <span>Settings</span>
          </Link>
        </nav>

        <div className="nav-user">
          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="user-badge">
                <span style={{ fontWeight: 600 }}>{user.name.split(' ')[0]}</span>
                <span className={`role-pill role-${role}`}>{role}</span>
              </div>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm" title="Log out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link to="/login" className="btn btn-secondary btn-sm">
                <LogIn size={15} />
                <span>Log In</span>
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                <UserPlus size={15} />
                <span>Sign Up</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
