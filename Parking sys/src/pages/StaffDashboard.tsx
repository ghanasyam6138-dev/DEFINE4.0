import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/dbService';
import { useDbRevision } from '../hooks/useDbRevision';
import { operationsService } from '../services/operationsService';
import { useToast } from '../context/ToastContext';
import { ANPRConsole } from '../components/anpr/ANPRConsole';
import { DEMO_MALL_ID } from '../services/seedData';
import type { Booking, Slot, StaffTask } from '../types';
import {
  Camera,
  Car,
  Zap,
  CheckCircle2,
  DollarSign,
  LayoutGrid,
  ClipboardList,
  ChevronRight,
  Activity,
  Shield,
  RefreshCw
} from 'lucide-react';

type StaffTab = 'console' | 'slots' | 'tasks' | 'ev_upgrade';

export const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const assignedAreaId = user?.assignedParkingAreaId || DEMO_MALL_ID;
  const area = dbService.getParkingAreaById(assignedAreaId);

  const [activeTab, setActiveTab] = useState<StaffTab>('console');
  const [tasks, setTasks]         = useState<StaffTask[]>([]);
  const [slots, setSlots]         = useState<Slot[]>([]);
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);

  const [showEVModal, setShowEVModal]               = useState(false);
  const [selectedBooking, setSelectedBooking]       = useState<Booking | null>(null);
  const [targetEVSlotId, setTargetEVSlotId]         = useState('');
  const [upgradeReason, setUpgradeReason]           = useState('Customer vehicle arrived with low EV battery');
  const [overflowInput, setOverflowInput]           = useState<number>(area?.overflowCount || 14);

  const refreshData = () => {
    setTasks(dbService.getTasks(assignedAreaId));
    setSlots(dbService.getSlots(assignedAreaId));
    setActiveBookings(
      dbService.getBookings(undefined, assignedAreaId)
        .filter((b: Booking) => b.status === 'reserved' || b.status === 'active_inside')
    );
  };

  const dbRevision = useDbRevision();
  useEffect(() => {
    refreshData();
  }, [user, dbRevision]);

  const availableEV   = slots.filter(s => s.type === 'ev' && s.status === 'available');
  const openTasks     = tasks.filter(t => t.status !== 'resolved');
  const availableSlots = slots.filter(s => s.status === 'available').length;
  const occupiedSlots  = slots.filter(s => s.status === 'occupied').length;

  const handleUpdateTask = (task: StaffTask, newStatus: StaffTask['status']) => {
    task.status = newStatus;
    if (newStatus === 'claimed')   { task.assignedStaffId = user?.id; task.assignedStaffName = user?.name; task.claimedAt = new Date().toISOString(); }
    if (newStatus === 'resolved')  { task.resolvedAt = new Date().toISOString(); }
    task.updatedAt = new Date().toISOString();
    dbService.saveTask(task);
    success('Task Updated', `Task marked as ${newStatus}.`);
  };

  const handleEVUpgrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !targetEVSlotId) { error('Selection Required', 'Please select a target EV slot.'); return; }
    const res = dbService.atomicUpgradeToEV({
      bookingId: selectedBooking.id,
      newEVSlotId: targetEVSlotId,
      staffId: user?.id || 'staff-101',
      staffName: user?.name || 'Staff',
      reason: upgradeReason
    });
    if (res.success && res.updatedBooking) {
      success('EV Upgrade Done!', `Booking #${res.updatedBooking.bookingNumber} → Bay ${res.updatedBooking.slotNumber}`);
      setShowEVModal(false); setSelectedBooking(null);
    } else {
      error('Upgrade Failed', res.error);
    }
  };

  const handleSaveOverflow = () => {
    const res = operationsService.updateOverflowCount({
      parkingAreaId: assignedAreaId,
      newCount: Number(overflowInput),
      staffId: user?.id || 'staff-101',
      staffName: user?.name || 'Staff'
    });
    if (res.success) success('Overflow Updated', `Count set to ${overflowInput}.`);
    else error('Update Failed', res.error);
  };

  /* ── Nav items ── */
  const navItems: { id: StaffTab; icon: React.ReactNode; label: string; badge?: number; color?: string }[] = [
    { id: 'console',    icon: <Camera size={16} />,       label: 'Entry/Exit Scanner',  color: '#e879f9' },
    { id: 'slots',      icon: <LayoutGrid size={16} />,   label: 'Live Bay Map',         color: '#34d399' },
    { id: 'tasks',      icon: <ClipboardList size={16} />,label: 'Task Queue',   badge: openTasks.length || undefined, color: '#f87171' },
    { id: 'ev_upgrade', icon: <Zap size={16} />,          label: 'EV Upgrade Tool',      color: '#fbbf24' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ══ Shift header ══ */}
      <div style={{
        background: 'linear-gradient(135deg, #0c0820 0%, #140c2e 45%, #120a28 100%)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 24,
        border: '1px solid #241b3e', position: 'relative', overflow: 'hidden',
        boxShadow: '0 16px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:220, height:220,
          background:'radial-gradient(circle, rgba(232, 121, 249, 0.25)  0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16, position:'relative' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div className="live-dot" />
              <span style={{ fontSize:'0.68rem', color:'#34d399', fontWeight:800, letterSpacing:'0.1em' }}>ON DUTY SHIFT</span>
              <span style={{ fontSize:'0.72rem', color:'#334155', fontFamily:'var(--font-mono)' }}>{user?.staffId || 'STF-101'}</span>
            </div>
            <h1 style={{ fontSize:'1.65rem', fontWeight:900, color:'#f1f5f9', lineHeight:1.15 }}>
              {user?.name?.split(' ')[0]}'s&nbsp;
              <span style={{ background:'linear-gradient(135deg,#e879f9,#d946ef)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                Ops Console
              </span>
            </h1>
            <p style={{ color:'#475569', fontSize:'0.87rem', marginTop:5, display:'flex', alignItems:'center', gap:6 }}>
              <Shield size={13} style={{ color:'#334155' }} />
              {area?.name || 'Demo Mall'} — Staff Operations
            </p>
          </div>

          {/* Stat chips */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {[
              { label:'Available', val: availableSlots, color:'#34d399', bg:'rgba(5,150,105,0.15)', border:'rgba(52,211,153,0.3)' },
              { label:'Occupied',  val: occupiedSlots,  color:'#f87171', bg:'rgba(239,68,68,0.12)',  border:'rgba(248,113,113,0.3)' },
              { label:'Open Tasks',val: openTasks.length, color:'#fbbf24', bg:'rgba(217,119,6,0.12)', border:'rgba(251,191,36,0.3)' },
            ].map(chip => (
              <div key={chip.label} style={{
                padding:'8px 16px', borderRadius:12,
                background: chip.bg, border:`1px solid ${chip.border}`
              }}>
                <div style={{ fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'0.08em', color: chip.color, marginBottom:2 }}>{chip.label}</div>
                <div style={{ fontSize:'1.4rem', fontWeight:900, color: chip.color, lineHeight:1 }}>{chip.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Walk-in Cash quick access */}
        <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid #170f30' }}>
          <Link to="/staff/walkin" style={{
            display:'inline-flex', alignItems:'center', gap:8,
            padding:'9px 18px', borderRadius:12,
            background:'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(251,191,36,0.12))',
            border:'1px solid rgba(251,191,36,0.3)',
            color:'#fbbf24', fontWeight:700, fontSize:'0.86rem', textDecoration:'none'
          }}>
            <DollarSign size={15} /> Walk-in Cash Registration
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* ══ Sidebar + Content ══ */}
      <div className="dashboard-shell">

        {/* Sidebar */}
        <div className="dashboard-sidebar" style={{
          background:'#0f0a22', borderRadius:16, padding:'16px 10px',
          border:'1px solid #241b3e'
        }}>
          <div className="sidebar-section-label">Operations</div>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                width:28, height:28, borderRadius:8,
                background: activeTab === item.id
                  ? `${item.color}22`
                  : 'rgba(255,255,255,0.05)',
                color: activeTab === item.id ? item.color : '#475569',
                transition:'all 0.2s'
              }}>
                {item.icon}
              </span>
              <span style={{ flex:1 }}>{item.label}</span>
              {item.badge != null && (
                <span style={{
                  background: activeTab === item.id
                    ? 'rgba(248,113,113,0.3)' : 'rgba(248,113,113,0.12)',
                  color:'#f87171', fontSize:'0.62rem', fontWeight:800,
                  padding:'1px 7px', borderRadius:20
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}

          <div className="sidebar-section-label" style={{ marginTop:12 }}>Quick Info</div>
          <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(255,255,255,0.02)',
            border:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:'0.65rem', color:'#334155', fontWeight:700, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>
              EV Slots Free
            </div>
            <div style={{ fontSize:'1.4rem', fontWeight:900,
              background:'linear-gradient(135deg, #059669, #34d399)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              {availableEV.length}
            </div>
            <div style={{ fontSize:'0.7rem', color:'#334155', marginTop:2 }}>of {slots.filter(s=>s.type==='ev').length} total</div>
          </div>

          <button onClick={refreshData} style={{
            marginTop:8, display:'flex', alignItems:'center', gap:7, width:'100%',
            padding:'8px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)',
            background:'rgba(255,255,255,0.03)', color:'#475569',
            fontSize:'0.8rem', fontWeight:600, cursor:'pointer'
          }}>
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>

        {/* Content area */}
        <div style={{ minWidth:0 }}>

          {/* ── Entry/Exit Scanner ── */}
          {activeTab === 'console' && (
            <ANPRConsole parkingAreaId={assignedAreaId} />
          )}

          {/* ── Live Bay Map ── */}
          {activeTab === 'slots' && (
            <div className="section-panel">
              <div className="section-panel-header" style={{ cursor:'default' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'rgba(52,211,153,0.15)',
                    border:'1px solid rgba(52,211,153,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <LayoutGrid size={18} style={{ color:'#34d399' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight:800, color:'#f1f5f9' }}>Live Bay Status Matrix</div>
                    <div style={{ fontSize:'0.73rem', color:'#475569' }}>{slots.length} bays · real-time sync</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div className="live-dot" />
                  <span style={{ fontSize:'0.7rem', color:'#34d399', fontWeight:700 }}>Live</span>
                </div>
              </div>
              <div className="section-panel-body">
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(110px, 1fr))', gap:10 }}>
                  {slots.map(s => (
                    <div key={s.id} className={`slot-node slot-node-${s.status}`}
                      style={{ position:'relative', width:'100%', height:100, cursor:'default' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                        {s.type === 'ev' && <Zap size={13} style={{ color:'#10b981' }} />}
                        <span style={{ fontSize:'1rem', fontWeight:900 }}>{s.number}</span>
                      </div>
                      <span style={{ fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2 }}>
                        {s.status}
                      </span>
                      {s.status === 'occupied' && <Car size={20} style={{ marginTop:6, color:'#f87171' }} />}
                      {s.type === 'ev' && s.status === 'available' && (
                        <Zap size={18} style={{ marginTop:6, color:'#34d399' }} />
                      )}
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div style={{ display:'flex', gap:12, marginTop:16, flexWrap:'wrap' }}>
                  {[
                    { label:'Available', color:'#34d399', bg:'rgba(52,211,153,0.15)' },
                    { label:'Occupied',  color:'#f87171', bg:'rgba(248,113,113,0.15)' },
                    { label:'Reserved',  color:'#fbbf24', bg:'rgba(251,191,36,0.15)' },
                    { label:'EV Bay',    color:'#34d399', bg:'rgba(5,150,105,0.15)' },
                  ].map(l => (
                    <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5,
                      fontSize:'0.72rem', color:'#64748b', fontWeight:600 }}>
                      <div style={{ width:10, height:10, borderRadius:3, background:l.bg, border:`1px solid ${l.color}` }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Task Queue ── */}
          {activeTab === 'tasks' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div className="section-panel">
                <div className="section-panel-header" style={{ cursor:'default' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'rgba(248,113,113,0.15)',
                      border:'1px solid rgba(248,113,113,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <ClipboardList size={18} style={{ color:'#f87171' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight:800, color:'#f1f5f9' }}>Active Task Queue</div>
                      <div style={{ fontSize:'0.73rem', color:'#475569' }}>{openTasks.length} open · {tasks.filter(t=>t.status==='resolved').length} resolved</div>
                    </div>
                  </div>
                </div>
                <div className="section-panel-body">
                  {tasks.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'32px 0', color:'#334155' }}>
                      <CheckCircle2 size={32} style={{ margin:'0 auto 10px', color:'#2d1a52' }} />
                      <p>All clear — no pending tasks!</p>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {tasks.map(task => (
                        <div key={task.id} style={{
                          borderRadius:12, padding:'16px',
                          background: task.priority === 'urgent' ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                          border: task.priority === 'urgent' ? '1px solid rgba(239,68,68,0.25)' : '1px solid #241b3e',
                          display:'flex', justifyContent:'space-between', alignItems:'center',
                          flexWrap:'wrap', gap:12
                        }}>
                          <div style={{ flex:1, minWidth:200 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                              <span style={{
                                fontSize:'0.62rem', fontWeight:800, padding:'2px 8px', borderRadius:20,
                                background: task.priority === 'urgent' ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.12)',
                                color: task.priority === 'urgent' ? '#f87171' : '#fbbf24',
                                border: `1px solid ${task.priority === 'urgent' ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.25)'}`,
                                letterSpacing:'0.08em', textTransform:'uppercase'
                              }}>
                                {task.priority}
                              </span>
                              <strong style={{ color:'#e2e8f0', fontSize:'0.92rem' }}>{task.title}</strong>
                            </div>
                            <p style={{ fontSize:'0.82rem', color:'#475569', marginBottom:4 }}>{task.description}</p>
                            <span style={{ fontSize:'0.7rem', color:'#334155', fontFamily:'var(--font-mono)' }}>
                              {task.status.replace(/_/g,' ').toUpperCase()} · {new Date(task.createdAt).toLocaleTimeString()}
                            </span>
                          </div>

                          <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>
                            {task.status === 'pending' && (
                              <button onClick={() => handleUpdateTask(task, 'claimed')} style={{
                                display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px',
                                borderRadius:10, cursor:'pointer', fontSize:'0.8rem', fontWeight:700,
                                background:'rgba(147, 51, 234, 0.15)', border:'1px solid rgba(217, 70, 239, 0.25) ',
                                color:'#d946ef'
                              }}>
                                Claim Task
                              </button>
                            )}
                            {task.status === 'claimed' && (
                              <button onClick={() => handleUpdateTask(task, 'in_progress')} style={{
                                display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px',
                                borderRadius:10, cursor:'pointer', fontSize:'0.8rem', fontWeight:700,
                                background:'rgba(232, 121, 249, 0.15)', border:'1px solid rgba(232, 121, 249, 0.25) ',
                                color:'#e879f9'
                              }}>
                                <Activity size={13} /> On My Way
                              </button>
                            )}
                            {task.status !== 'resolved' && (
                              <button onClick={() => handleUpdateTask(task, 'resolved')} style={{
                                display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px',
                                borderRadius:10, cursor:'pointer', fontSize:'0.8rem', fontWeight:700,
                                background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.25)',
                                color:'#34d399'
                              }}>
                                <CheckCircle2 size={13} /> Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Overflow counter */}
              <div className="section-panel">
                <div className="section-panel-header" style={{ cursor:'default' }}>
                  <div style={{ fontWeight:800, color:'#f1f5f9' }}>Manual Overflow Lot Count</div>
                </div>
                <div className="section-panel-body">
                  <p style={{ fontSize:'0.82rem', color:'#475569', marginBottom:14 }}>
                    When gate sensors are offline, ground staff manually records overflow occupancy.
                  </p>
                  <div style={{ display:'flex', gap:10, alignItems:'center', maxWidth:340 }}>
                    <input type="number" value={overflowInput}
                      onChange={e => setOverflowInput(Number(e.target.value))}
                      min={0} max={area?.overflowCapacity || 50}
                      className="form-input" style={{ flex:1 }}
                    />
                    <button onClick={handleSaveOverflow} style={{
                      display:'inline-flex', alignItems:'center', gap:6, padding:'10px 16px',
                      borderRadius:10, cursor:'pointer', whiteSpace:'nowrap',
                      background:'linear-gradient(135deg, #9333ea, #a855f7)',
                      border:'none', color:'#fff', fontWeight:700, fontSize:'0.85rem',
                      boxShadow:'0 2px 10px rgba(147, 51, 234, 0.25) '
                    }}>
                      Save ({overflowInput}/{area?.overflowCapacity || 50})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── EV Upgrade Tool ── */}
          {activeTab === 'ev_upgrade' && (
            <div className="section-panel">
              <div className="section-panel-header" style={{ cursor:'default' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'rgba(251,191,36,0.15)',
                    border:'1px solid rgba(251,191,36,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Zap size={18} style={{ color:'#fbbf24' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight:800, color:'#f1f5f9' }}>Staff-Authorized EV Slot Upgrade</div>
                    <div style={{ fontSize:'0.73rem', color:'#475569' }}>Atomically relocates a booking to a free EV charger bay</div>
                  </div>
                </div>
                <span style={{ fontSize:'0.72rem', color:'#34d399', fontWeight:700 }}>
                  {availableEV.length} EV slots free
                </span>
              </div>
              <div className="section-panel-body">
                {activeBookings.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'32px 0', color:'#334155' }}>
                    <Zap size={32} style={{ margin:'0 auto 10px', color:'#1e3a1a' }} />
                    <p>No active bookings available for EV upgrade.</p>
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
                    {activeBookings.map(b => (
                      <div key={b.id} style={{
                        borderRadius:14, padding:'16px',
                        background:'rgba(255,255,255,0.02)',
                        border:'1px solid #241b3e',
                        transition:'border-color 0.2s, box-shadow 0.2s'
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2d3f6d'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#241b3e'; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
                      >
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                          <span style={{ fontSize:'0.62rem', fontWeight:800, padding:'2px 8px', borderRadius:20,
                            background:'rgba(245,158,11,0.12)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.25)' }}>
                            #{b.bookingNumber}
                          </span>
                          <span style={{ fontSize:'0.75rem', color:'#334155', fontWeight:700 }}>Bay {b.slotNumber}</span>
                        </div>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'1rem', fontWeight:800, color:'#e2e8f0', marginBottom:3 }}>
                          {b.vehiclePlate}
                        </div>
                        <div style={{ fontSize:'0.8rem', color:'#475569', marginBottom:12 }}>
                          {b.customerName} · {b.slotType.toUpperCase()} · {b.status}
                        </div>
                        <button
                          onClick={() => { setSelectedBooking(b); if (availableEV.length > 0) setTargetEVSlotId(availableEV[0].id); setShowEVModal(true); }}
                          disabled={availableEV.length === 0}
                          style={{
                            width:'100%', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
                            padding:'9px 14px', borderRadius:10, cursor: availableEV.length === 0 ? 'not-allowed' : 'pointer',
                            background: availableEV.length === 0
                              ? 'rgba(255,255,255,0.04)'
                              : 'linear-gradient(135deg, rgba(5,150,105,0.2), rgba(52,211,153,0.15))',
                            border: availableEV.length === 0
                              ? '1px solid rgba(255,255,255,0.06)'
                              : '1px solid rgba(52,211,153,0.35)',
                            color: availableEV.length === 0 ? '#334155' : '#34d399',
                            fontWeight:700, fontSize:'0.82rem',
                            opacity: availableEV.length === 0 ? 0.5 : 1
                          }}
                        >
                          <Zap size={14} /> Upgrade to EV Bay ({availableEV.length} free)
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ EV Upgrade Modal ══ */}
      {showEVModal && selectedBooking && (
        <div className="modal-overlay" onClick={() => setShowEVModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}
            style={{ borderRadius:20, padding:0, overflow:'hidden', maxWidth:460 }}>
            <div style={{ background:'linear-gradient(135deg, #0c0820, #170f30)',
              padding:'22px 24px', borderBottom:'1px solid #241b3e' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                <Zap size={18} style={{ color:'#34d399' }} />
                <h3 style={{ fontWeight:800, color:'#f1f5f9', fontSize:'1.1rem' }}>Confirm EV Bay Upgrade</h3>
              </div>
              <p style={{ fontSize:'0.82rem', color:'#475569' }}>
                Relocating <strong style={{ color:'#e2e8f0' }}>{selectedBooking.vehiclePlate}</strong> from Bay {selectedBooking.slotNumber}
              </p>
            </div>
            <div style={{ padding:'22px 24px', background:'#0f0a22' }}>
              <form onSubmit={handleEVUpgrade}>
                <div className="form-group">
                  <label className="form-label">Available EV Charging Bay</label>
                  <select value={targetEVSlotId} onChange={e => setTargetEVSlotId(e.target.value)}
                    className="form-select" required>
                    {availableEV.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        Bay {ev.number} · {ev.evSpecs?.connectorType || 'CCS2'} · {ev.evSpecs?.powerKw || 60}kW
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Upgrade Justification</label>
                  <textarea value={upgradeReason} onChange={e => setUpgradeReason(e.target.value)}
                    className="form-textarea" rows={2} required />
                </div>
                <div style={{ display:'flex', gap:10, marginTop:20 }}>
                  <button type="button" onClick={() => setShowEVModal(false)} style={{
                    flex:1, padding:'11px', borderRadius:12, cursor:'pointer',
                    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                    color:'#64748b', fontWeight:600, fontSize:'0.88rem'
                  }}>
                    Cancel
                  </button>
                  <button type="submit" style={{
                    flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
                    padding:'11px', borderRadius:12, cursor:'pointer',
                    background:'linear-gradient(135deg, #059669, #34d399)',
                    border:'none', color:'#fff', fontWeight:700, fontSize:'0.88rem',
                    boxShadow:'0 4px 16px rgba(5,150,105,0.4)'
                  }}>
                    <Zap size={16} /> Atomically Swap Bay
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
