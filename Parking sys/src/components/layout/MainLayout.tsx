import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { ChevronRight } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const pathSnippets = location.pathname.split('/').filter(Boolean);
  const breadcrumbItems = pathSnippets.map((snippet, index) => ({
    url: `/${pathSnippets.slice(0, index + 1).join('/')}`,
    name: snippet.charAt(0).toUpperCase() + snippet.slice(1).replace(/-/g, ' ')
  }));
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content">
        {!isLoginPage && breadcrumbItems.length > 0 && (
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link to="/" style={{ color: 'var(--primary)' }}>Home</Link>
            {breadcrumbItems.map((item, idx) => (
              <React.Fragment key={item.url}>
                <span className="breadcrumb-sep"><ChevronRight size={14} /></span>
                {idx === breadcrumbItems.length - 1
                  ? <span className="breadcrumb-active">{item.name}</span>
                  : <Link to={item.url}>{item.name}</Link>}
              </React.Fragment>
            ))}
          </nav>
        )}
        <Outlet />
      </main>
      <footer className="app-footer">
        <div className="app-footer-inner">
          <div>
            <strong>ParkSmart</strong> — Smart Parking &amp; Venue Operations
            <div className="app-footer-sub">Built with React, TypeScript, Vite and Firebase Realtime Database.</div>
          </div>
          <div className="app-footer-links">
            <Link to="/staff/access">Staff Request Portal</Link>
            <Link to="/blocked-car">Blocked Car Hotline</Link>
            <Link to="/settings">System Info</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
