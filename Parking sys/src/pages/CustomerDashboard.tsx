import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { visitService } from '../services/visitService';
import { dbService } from '../services/dbService';
import { useDbRevision } from '../hooks/useDbRevision';
import { useToast } from '../context/ToastContext';
import { ParkingGuidance } from '../components/guidance/ParkingGuidance';
import type { Booking, Visit } from '../types';
import {
  Car,
  QrCode,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  LayoutDashboard,
  MapPin,
  History,
  Settings,
  ChevronDown,
  ChevronRight,
  Zap,
  Clock,
  Star,
  Bell,
  Sparkles,
  ArrowRight,
  Droplets,
  Wind
} from 'lucide-react';

type SideSection = 'overview' | 'reservations' | 'findcar' | 'history';

/* ─── tiny inline helpers ─── */
const Pill: React.FC<{ color: string; bg: string; border: string; children: React.ReactNode }> = ({
  color, bg, border, children
}) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.62rem', fontWeight: 800,
    letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '20px',
    color, background: bg, border: `1px solid ${border}`
  }}>
    {children}
  </span>
);

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [activeSection, setActiveSection] = useState<SideSection>('overview');
  const [visitOpen, setVisitOpen] = useState(true);
  const [bookOpen, setBookOpen] = useState(true);
  const [findOpen, setFindOpen] = useState(true);

  // Re-read bookings/visits whenever data changes on this or any other device.
  const dbRevision = useDbRevision();

  useEffect(() => {
    if (!user) return;
    dbService.expireStaleBookings();
    setBookings(dbService.getBookings(user.id).filter(b => b.status !== 'expired' && b.status !== 'cancelled'));
    setVisits(dbService.getVisits(user.id));
  }, [user, dbRevision]);

  const activeVisit = visits.find(v => v.status === 'active' || v.status === 'exit_pass_issued');
  const activeFacility = activeVisit ? dbService.getParkingAreaById(activeVisit.parkingAreaId) : null;
  const completedVisits = visits.filter(v => v.status === 'completed');

  const handleAddService = (serviceName: string, price: number) => {
    if (!activeVisit) return;
    activeVisit.services.push({ serviceId: `srv-${Date.now()}`, serviceName, price, status: 'pending' });
    activeVisit.updatedAt = new Date().toISOString();
    dbService.saveVisit(activeVisit);
    success('Service Added', `${serviceName} (₹${price}) added to your exit bill.`);
  };

  const handleLeaveNow = () => {
    if (!activeVisit?.exitPass) return;
    const res = visitService.completeExit({
      passTokenOrPlate: activeVisit.exitPass.passToken,
      exitMethod: 'qr_scan',
      parkingAreaId: activeVisit.parkingAreaId
    });
    if (res.success && res.visit) {
      success('Barrier Open!', `Bay ${res.visit.slotNumber} released. Drive safe! 🚗`);
      if (user) {
        setVisits(dbService.getVisits(user.id));
        setBookings(dbService.getBookings(user.id).filter(b => b.status !== 'expired' && b.status !== 'cancelled'));
      }
    } else {
      error('Exit Failed', res.error || 'Could not validate exit pass.');
    }
  };

  const navItems: { id: SideSection; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: 'overview', icon: <LayoutDashboard size={16} />, label: 'Overview' },
    { id: 'reservations', icon: <QrCode size={16} />, label: 'My Tickets', badge: bookings.length || undefined },
    { id: 'findcar', icon: <MapPin size={16} />, label: 'Find My Car' },
    { id: 'history', icon: <History size={16} />, label: 'History', badge: completedVisits.length || undefined },
  ];

  /* ── reusable panel icon wrapper ── */
  const IconBox = ({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) => (
    <div style={{
      width: 36, height: 36, borderRadius: 10, background: bg, border: `1px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>
      {React.cloneElement(children as React.ReactElement<{ style?: React.CSSProperties }>, { style: { color } })}
    </div>
  );

  /* ── section panel header ── */
  const PanelHeader = ({ icon, title, sub, right, onClick }: {
    icon: React.ReactNode; title: string; sub: string; right?: React.ReactNode; onClick?: () => void
  }) => (
    <div className="section-panel-header" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon}
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f1f5f9' }}>{title}</div>
          <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 1 }}>{sub}</div>
        </div>
      </div>
      {right}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ═══════════════════════════════════════════
          HERO HEADER
      ═══════════════════════════════════════════ */}
      <div style={{
        background: 'linear-gradient(135deg, #0c0820 0%, #140c2e 40%, #170f30 70%, #0e1728 100%)',
        borderRadius: 20,
        padding: '28px 30px 24px',
        marginBottom: 24,
        border: '1px solid #241b3e',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
      }}>
        {/* Mesh decoration */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: -80, right: -80, width: 300, height: 300,
            background: 'radial-gradient(circle, rgba(147, 51, 234, 0.25)  0%, transparent 70%)', borderRadius: '50%'
          }} />
          <div style={{
            position: 'absolute', bottom: -60, left: -40, width: 200, height: 200,
            background: 'radial-gradient(circle, rgba(232, 121, 249, 0.25)  0%, transparent 70%)', borderRadius: '50%'
          }} />
        </div>

        {/* Top row: greeting + CTAs */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexWrap: 'wrap', gap: 16, position: 'relative'
        }}>
          <div>
            {activeVisit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <div className="live-dot" />
                <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 700, letterSpacing: '0.1em' }}>
                  VEHICLE INSIDE
                </span>
              </div>
            )}
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1.15 }}>
              {activeVisit ? (
                <>Bay&nbsp;
                  <span style={{
                    background: 'linear-gradient(135deg, #a855f7, #e879f9)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                  }}>
                    {activeVisit.slotNumber}
                  </span>
                  &nbsp;Active
                </>
              ) : (
                <>Hey,&nbsp;
                  <span style={{
                    background: 'linear-gradient(135deg, #d946ef, #e879f9)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                  }}>
                    {user?.name?.split(' ')[0] || 'there'}
                  </span>&nbsp;👋
                </>
              )}
            </h1>
            <p style={{ color: '#475569', fontSize: '0.87rem', marginTop: 5 }}>
              {activeVisit
                ? `${activeVisit.parkingAreaName} · ${activeVisit.levelName}`
                : 'Manage your reservations, tickets, and vehicle.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Primary CTA — glowing indigo */}
            <Link to="/" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 12,
              background: 'linear-gradient(135deg, #9333ea, #a855f7)',
              color: '#fff', fontWeight: 700, fontSize: '0.88rem',
              boxShadow: '0 4px 20px rgba(147, 51, 234, 0.25) ',
              border: '1px solid rgba(217, 70, 239, 0.25) ',
              transition: 'all 0.2s',
              textDecoration: 'none'
            }}>
              <Car size={16} /><span>Book Parking</span>
            </Link>
            {/* Secondary CTA — subtle rose */}
            <Link to="/blocked-car" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 12,
              background: 'rgba(239,68,68,0.1)',
              color: '#f87171', fontWeight: 700, fontSize: '0.88rem',
              border: '1px solid rgba(239,68,68,0.25)',
              textDecoration: 'none'
            }}>
              <AlertTriangle size={15} /><span>Report Block</span>
            </Link>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 22 }}>
          {[
            {
              label: 'Active Visits', icon: <CheckCircle2 size={13} />,
              value: activeVisit ? '1' : '0',
              sub: activeVisit ? `Bay ${activeVisit.slotNumber}` : 'No vehicle inside',
              grad: 'linear-gradient(135deg, #059669, #34d399)',
              border: 'rgba(52,211,153,0.3)', bg: 'rgba(5,150,105,0.12)'
            },
            {
              label: 'Reservations', icon: <QrCode size={13} />,
              value: String(bookings.length),
              sub: `${bookings.length} ticket${bookings.length !== 1 ? 's' : ''}`,
              grad: 'linear-gradient(135deg, #d97706, #fbbf24)',
              border: 'rgba(251,191,36,0.3)', bg: 'rgba(217,119,6,0.12)'
            },
            {
              label: 'Total Visits', icon: <History size={13} />,
              value: String(visits.length),
              sub: `${completedVisits.length} completed`,
              grad: 'linear-gradient(135deg, #9333ea, #d946ef)',
              border: 'rgba(217, 70, 239, 0.2)', bg: 'rgba(79,70,229,0.12)'
            },
            {
              label: 'Loyalty Pts', icon: <Star size={13} />,
              value: String(completedVisits.length * 12),
              sub: '12 pts / visit',
              grad: 'linear-gradient(135deg, #db2777, #f472b6)',
              border: 'rgba(244,114,182,0.3)', bg: 'rgba(219,39,119,0.1)'
            },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: 14, padding: '14px 16px',
              transition: 'transform 0.18s, box-shadow 0.18s', cursor: 'default'
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6,
                fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                background: s.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
              }}>
                {s.icon}{s.label}
              </div>
              <div style={{
                fontSize: '1.65rem', fontWeight: 900, lineHeight: 1,
                background: s.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SHELL: SIDEBAR + CONTENT
      ═══════════════════════════════════════════ */}
      <div className="dashboard-shell">

        {/* ── Left Sidebar ── */}
        <div className="dashboard-sidebar" style={{
          background: '#0f0a22', borderRadius: 16, padding: '16px 10px',
          border: '1px solid #241b3e'
        }}>
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-item${activeSection === item.id ? ' active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 8,
                background: activeSection === item.id ? 'rgba(147, 51, 234, 0.15)' : 'rgba(255,255,255,0.05)',
                transition: 'background 0.2s'
              }}>
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge != null && (
                <span style={{
                  background: activeSection === item.id
                    ? 'linear-gradient(135deg, #9333ea, #a855f7)' : 'rgba(255,255,255,0.08)',
                  color: activeSection === item.id ? '#fff' : '#64748b',
                  fontSize: '0.62rem', fontWeight: 800,
                  padding: '1px 7px', borderRadius: 20, minWidth: 20, textAlign: 'center'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}

          <div className="sidebar-section-label" style={{ marginTop: 12 }}>Quick Actions</div>

          <Link to="/" className="sidebar-nav-item" style={{ textDecoration: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(251,191,36,0.1)' }}>
              <Zap size={15} style={{ color: '#fbbf24' }} />
            </span>
            New Booking
          </Link>

          <Link to="/blocked-car" className="sidebar-nav-item" style={{ textDecoration: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.1)' }}>
              <Bell size={15} style={{ color: '#f87171' }} />
            </span>
            Report Blocked
          </Link>

          <Link to="/settings" className="sidebar-nav-item" style={{ textDecoration: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.05)' }}>
              <Settings size={15} style={{ color: '#94a3b8' }} />
            </span>
            Settings
          </Link>
        </div>

        {/* ── Right Content ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* ═══ OVERVIEW / FINDCAR ═══ */}
          {(activeSection === 'overview' || activeSection === 'findcar') && (
            <>
              {/* Active Visit Panel */}
              {activeVisit && activeFacility && (
                <div className="section-panel" style={{ border: '1px solid #2d1a52' }}>
                  <PanelHeader
                    icon={<IconBox color="#34d399" bg="rgba(5,150,105,0.15)"><Car size={17} /></IconBox>}
                    title="Active Visit"
                    sub={activeVisit.parkingAreaName}
                    onClick={() => setVisitOpen(v => !v)}
                    right={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Pill color="#34d399" bg="rgba(5,150,105,0.15)" border="#34d399">
                          <div className="live-dot" style={{ width: 5, height: 5 }} /> Live
                        </Pill>
                        {visitOpen ? <ChevronDown size={17} style={{ color: '#475569' }} /> : <ChevronRight size={17} style={{ color: '#475569' }} />}
                      </div>
                    }
                  />

                  {visitOpen && (
                    <div className="section-panel-body">
                      {/* Top row: big bay + plate */}
                      <div style={{ display: 'flex', alignItems: 'stretch', gap: 16, marginBottom: 16 }}>
                        {/* Bay hero */}
                        <div style={{
                          flex: '0 0 120px', borderRadius: 14,
                          background: 'linear-gradient(135deg, #0f2540, #0d1f35)',
                          border: '1px solid #2d1a52',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16
                        }}>
                          <div style={{ fontSize: '0.6rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bay</div>
                          <div style={{
                            fontSize: '2.6rem', fontWeight: 900, lineHeight: 1,
                            background: 'linear-gradient(135deg, #9333ea, #e879f9)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                          }}>
                            {activeVisit.slotNumber}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>{activeVisit.levelName}</div>
                        </div>

                        {/* Metric tiles */}
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {[
                            { label: 'Vehicle', val: activeVisit.vehiclePlate, color: '#e2e8f0', mono: true },
                            { label: 'Entry Time', val: new Date(activeVisit.entryTimestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), color: '#94a3b8', mono: false },
                            { label: 'Rate', val: `₹${activeVisit.tariffSnapshot.baseHourlyRate}/hr`, color: '#fbbf24', mono: false },
                            { label: 'Est. Bill', val: `₹${activeVisit.calculatedFee || 40}`, color: '#34d399', mono: false },
                          ].map(m => (
                            <div key={m.label} style={{
                              background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px',
                              border: '1px solid rgba(255,255,255,0.06)'
                            }}>
                              <div style={{ fontSize: '0.62rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{m.label}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: m.color, fontFamily: m.mono ? 'var(--font-mono)' : 'inherit', letterSpacing: m.mono ? '1px' : 'normal' }}>{m.val}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                        {activeVisit.exitPass && !activeVisit.exitPass.isConsumed ? (
                          <>
                            <button onClick={handleLeaveNow} style={{
                              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                              padding: '11px 20px', borderRadius: 12,
                              background: 'linear-gradient(135deg, #059669, #34d399)',
                              color: '#fff', fontWeight: 800, fontSize: '0.88rem',
                              border: 'none', cursor: 'pointer',
                              boxShadow: '0 4px 18px rgba(5,150,105,0.45)'
                            }}>
                              <CheckCircle2 size={16} /><span>Open Barrier & Leave</span>
                            </button>
                            <Link to={`/pay/${activeVisit.id}`} style={{
                              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                              padding: '11px 20px', borderRadius: 12,
                              background: 'rgba(147, 51, 234, 0.15)',
                              color: '#d946ef', fontWeight: 700, fontSize: '0.88rem',
                              border: '1px solid rgba(147, 51, 234, 0.25) ', textDecoration: 'none'
                            }}>
                              <QrCode size={16} /><span>View Exit QR</span>
                            </Link>
                          </>
                        ) : (
                          <Link to={`/pay/${activeVisit.id}`} style={{
                            flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '12px 24px', borderRadius: 12,
                            background: 'linear-gradient(135deg, #9333ea, #a855f7)',
                            color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                            border: 'none', textDecoration: 'none',
                            boxShadow: '0 4px 20px rgba(147, 51, 234, 0.25) '
                          }}>
                            <CreditCard size={17} /><span>Pay & Get Exit Pass</span>
                            <ArrowRight size={15} />
                          </Link>
                        )}
                      </div>

                      {/* Add-on services */}
                      <div className="divider-label">Add-on Services</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                          { name: 'Car Wash', icon: <Droplets size={13} />, price: 249, color: '#e879f9', border: 'rgba(232, 121, 249, 0.15)', bg: 'rgba(232, 121, 249, 0.15)' },
                          { name: 'Interior Vacuum', icon: <Wind size={13} />, price: 149, color: '#a78bfa', border: 'rgba(167,139,250,0.3)', bg: 'rgba(167,139,250,0.08)' },
                          { name: 'Tyre Check', icon: <Sparkles size={13} />, price: 49, color: '#34d399', border: 'rgba(52,211,153,0.3)', bg: 'rgba(52,211,153,0.08)' },
                        ].map(svc => (
                          <button
                            key={svc.name}
                            onClick={() => handleAddService(svc.name, svc.price)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '7px 14px', borderRadius: 10,
                              background: svc.bg, color: svc.color,
                              border: `1px solid ${svc.border}`,
                              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                              transition: 'all 0.18s'
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                          >
                            {svc.icon} {svc.name}
                            <span style={{ opacity: 0.65, fontSize: '0.75rem' }}>₹{svc.price}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Find My Car Panel */}
              {activeVisit && activeFacility && (
                <div className="section-panel">
                  <PanelHeader
                    icon={<IconBox color="#fbbf24" bg="rgba(217,119,6,0.15)"><MapPin size={17} /></IconBox>}
                    title="Find My Car"
                    sub="Interactive map & turn-by-turn directions"
                    onClick={() => setFindOpen(v => !v)}
                    right={findOpen ? <ChevronDown size={17} style={{ color: '#475569' }} /> : <ChevronRight size={17} style={{ color: '#475569' }} />}
                  />
                  {findOpen && (
                    <div className="section-panel-body">
                      <ParkingGuidance parkingArea={activeFacility} visit={activeVisit} slotNumber={activeVisit.slotNumber} />
                    </div>
                  )}
                </div>
              )}

              {/* Empty state — no active visit */}
              {!activeVisit && (
                <div style={{
                  background: '#0f0a22', border: '1px solid #241b3e', borderRadius: 16,
                  padding: '48px 24px', textAlign: 'center'
                }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'rgba(147, 51, 234, 0.15)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 14px'
                  }}>
                    <Car size={28} style={{ color: '#9333ea' }} />
                  </div>
                  <h3 style={{ fontWeight: 800, color: '#94a3b8', fontSize: '1rem' }}>No Active Visit</h3>
                  <p style={{ color: '#475569', fontSize: '0.84rem', marginTop: 6, maxWidth: 280, margin: '6px auto 20px' }}>
                    Your live session details will appear here once your vehicle enters a facility.
                  </p>
                  <Link to="/" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: 12,
                    background: 'linear-gradient(135deg, #9333ea, #a855f7)',
                    color: '#fff', fontWeight: 700, fontSize: '0.88rem',
                    textDecoration: 'none', boxShadow: '0 4px 16px rgba(147, 51, 234, 0.25) '
                  }}>
                    <Zap size={15} /> Browse Parking
                  </Link>
                </div>
              )}
            </>
          )}

          {/* ═══ RESERVATIONS ═══ */}
          {(activeSection === 'reservations' || activeSection === 'overview') && (
            <div className="section-panel">
              <PanelHeader
                icon={<IconBox color="#fbbf24" bg="rgba(217,119,6,0.15)"><QrCode size={17} /></IconBox>}
                title="My Reservations"
                sub={`${bookings.length} active ticket${bookings.length !== 1 ? 's' : ''}`}
                onClick={() => setBookOpen(v => !v)}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Link to="/" onClick={e => e.stopPropagation()} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: '0.78rem', fontWeight: 700, color: '#d946ef',
                      background: 'rgba(147, 51, 234, 0.15)', padding: '4px 10px', borderRadius: 8,
                      border: '1px solid rgba(147, 51, 234, 0.25) ', textDecoration: 'none'
                    }}>
                      + Book
                    </Link>
                    {bookOpen ? <ChevronDown size={17} style={{ color: '#475569' }} /> : <ChevronRight size={17} style={{ color: '#475569' }} />}
                  </div>
                }
              />

              {bookOpen && (
                <div className="section-panel-body">
                  {bookings.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {bookings.map(b => (
                        <div key={b.id} style={{
                          background: 'rgba(255,255,255,0.025)',
                          border: '1px solid #241b3e',
                          borderRadius: 14, padding: '15px 16px',
                          display: 'flex', alignItems: 'center', gap: 14,
                          transition: 'border-color 0.2s, box-shadow 0.2s'
                        }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2d3f6d'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#241b3e'; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
                        >
                          {/* Bay badge */}
                          <div style={{
                            width: 52, height: 52, flexShrink: 0, borderRadius: 12,
                            background: 'linear-gradient(135deg, rgba(147,51,234,0.35), rgba(232,121,249,0.2))',
                            border: '1px solid rgba(147, 51, 234, 0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 900, fontSize: '1.1rem',
                            color: '#d946ef'
                          }}>
                            {b.slotNumber}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                              <Pill
                                color={b.status === 'reserved' ? '#fbbf24' : '#34d399'}
                                bg={b.status === 'reserved' ? 'rgba(217,119,6,0.15)' : 'rgba(5,150,105,0.15)'}
                                border={b.status === 'reserved' ? '#fbbf24' : '#34d399'}
                              >
                                {b.status.replace(/_/g, ' ')}
                              </Pill>
                              <span style={{ fontSize: '0.7rem', color: '#334155', fontFamily: 'var(--font-mono)' }}>
                                #{b.bookingNumber}
                              </span>
                            </div>
                            <div style={{
                              fontWeight: 700, fontSize: '0.9rem', color: '#e2e8f0',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                              {b.vehiclePlate}
                              <span style={{ color: '#334155', margin: '0 6px' }}>·</span>
                              {b.parkingAreaName}
                            </div>
                            <div style={{ fontSize: '0.73rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <Clock size={11} />
                              {new Date(b.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} –{' '}
                              {new Date(b.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              <span style={{ color: '#34d399', fontWeight: 700, marginLeft: 4 }}>₹{b.estimatedTotal}</span>
                            </div>
                          </div>

                          <Link to={`/ticket/${b.id}`} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', borderRadius: 10, flexShrink: 0,
                            background: 'linear-gradient(135deg, #9333ea, #a855f7)',
                            color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                            textDecoration: 'none',
                            boxShadow: '0 2px 10px rgba(147, 51, 234, 0.25) '
                          }}>
                            <QrCode size={14} /> Ticket
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '36px 0' }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: '50%', background: 'rgba(147, 51, 234, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
                      }}>
                        <QrCode size={22} style={{ color: '#9333ea' }} />
                      </div>
                      <p style={{ color: '#475569', fontSize: '0.87rem', marginBottom: 14 }}>No reservations yet.</p>
                      <Link to="/" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '9px 18px', borderRadius: 10,
                        background: 'linear-gradient(135deg, #9333ea, #a855f7)',
                        color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                        textDecoration: 'none'
                      }}>
                        Browse Facilities <ArrowRight size={14} />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ HISTORY ═══ */}
          {activeSection === 'history' && (
            <div className="section-panel">
              <PanelHeader
                icon={<IconBox color="#d946ef" bg="rgba(147, 51, 234, 0.15)"><History size={17} /></IconBox>}
                title="Visit History"
                sub={`${completedVisits.length} completed sessions`}
              />
              <div className="section-panel-body">
                {completedVisits.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {completedVisits.map(v => (
                      <div key={v.id} style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid #1a2540',
                        borderRadius: 12, padding: '13px 16px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                            background: 'rgba(147, 51, 234, 0.15)', border: '1px solid rgba(147, 51, 234, 0.25) ',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 900, color: '#d946ef'
                          }}>
                            {v.slotNumber}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#e2e8f0' }}>
                              {v.vehiclePlate}
                              <span style={{ color: '#334155', margin: '0 5px' }}>·</span>
                              {v.parkingAreaName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 2 }}>
                              {new Date(v.entryTimestamp).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                              {' · '}{v.currentDurationMinutes} min
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#34d399' }}>
                            ₹{v.calculatedFee ?? '—'}
                          </div>
                          <div style={{
                            fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, marginTop: 2,
                            textTransform: 'uppercase', letterSpacing: '0.06em'
                          }}>
                            Completed
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: '#475569' }}>
                    <History size={36} style={{ margin: '0 auto 10px', color: '#241b3e' }} />
                    <p>No completed visits yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
