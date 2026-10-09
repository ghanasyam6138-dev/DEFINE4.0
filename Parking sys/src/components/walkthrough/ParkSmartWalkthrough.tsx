import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize,
  Minimize,
  AlertTriangle,
  CheckCircle2,
  Car
} from 'lucide-react';

interface SceneConfig {
  id: number;
  key: string;
  title: string;
  subtitle: string;
  caption: string;
  heroCarX: number;
  heroCarY: number;
  heroAngle: number;
  gateOpen: boolean;
  highlightSlot: string;
  highlightRoute: boolean;
  blockedCarVisible: boolean;
}

const SCENES: SceneConfig[] = [
  {
    id: 1,
    key: 'ARRIVE',
    title: '1. ARRIVE',
    subtitle: 'ANPR Plate Match & Barrier Event',
    caption: 'Vehicle KA 01 AB 1234 approaches Gate 1. ANPR camera achieves 96% confidence plate recognition, matches active booking #PS-2026-8812, triggers a simulated barrier raise, and directs driver to reserved Bay A-101.',
    heroCarX: 70,
    heroCarY: 60,
    heroAngle: 90,
    gateOpen: true,
    highlightSlot: 'A-101',
    highlightRoute: true,
    blockedCarVisible: false
  },
  {
    id: 2,
    key: 'GUIDE',
    title: '2. GUIDE',
    subtitle: 'Dynamic Routing & Find My Car',
    caption: 'Turn-by-turn schematic route guides the vehicle along Lane 1 into Bay A-101. The customer app automatically locks Find My Car coordinates (Ground Floor, North Wing, Bay A-101 next to Pillar 4B).',
    heroCarX: 180,
    heroCarY: 170,
    heroAngle: 0,
    gateOpen: false,
    highlightSlot: 'A-101',
    highlightRoute: true,
    blockedCarVisible: false
  },
  {
    id: 3,
    key: 'VISIT',
    title: '3. VISIT',
    subtitle: 'Duration Ticker & Service Request',
    caption: 'Active visit session is tracking 1 hr 35 mins. The customer selects Eco Foam Car Wash (₹249) in-app. Service staff receives a minimized task ticket containing only bay location and service type, protecting customer phone numbers.',
    heroCarX: 180,
    heroCarY: 170,
    heroAngle: 0,
    gateOpen: false,
    highlightSlot: 'A-101',
    highlightRoute: false,
    blockedCarVisible: false
  },
  {
    id: 4,
    key: 'PAY EARLY',
    title: '4. PAY EARLY',
    subtitle: 'Simulated UPI & Exit Pass Issued',
    caption: 'Customer settles itemized bill: ₹80 parking (2 hrs @ ₹40/hr) + ₹249 car wash = ₹329. A simulated UPI payment completes idempotently, and a digital 20-minute validity Exit Pass with unguessable token is issued.',
    heroCarX: 180,
    heroCarY: 170,
    heroAngle: 0,
    gateOpen: false,
    highlightSlot: 'A-101',
    highlightRoute: false,
    blockedCarVisible: false
  },
  {
    id: 5,
    key: 'BLOCKED IN',
    title: '5. BLOCKED IN',
    subtitle: 'Staged Escalation & Driver Ack',
    caption: 'A blocking car (MH 12 CD 5678) obstructs Bay A-102. Reporting via slot QR triggers Stage 1 Push Alert (30s window), transitioning to expiring SMS link. The blocking driver taps "Need 5 mins", halting automated voice calls and granting a single grace window.',
    heroCarX: 180,
    heroCarY: 170,
    heroAngle: 0,
    gateOpen: false,
    highlightSlot: 'A-102',
    highlightRoute: false,
    blockedCarVisible: true
  },
  {
    id: 6,
    key: 'EXIT',
    title: '6. EXIT',
    subtitle: 'Exit Pass Validation & Bay Release',
    caption: 'Vehicle reaches Exit Gate 2. The exit scanner verifies the valid Exit Pass token, records server timestamp, marks the visit completed, releases Bay A-101 to Available status in the live registry, and issues digital receipt.',
    heroCarX: 520,
    heroCarY: 60,
    heroAngle: -90,
    gateOpen: true,
    highlightSlot: '',
    highlightRoute: false,
    blockedCarVisible: false
  },
  {
    id: 7,
    key: 'OPERATE',
    title: '7. OPERATE',
    subtitle: 'Live Operations & Staffing Forecast',
    caption: 'Operations telemetry updates in real time: 82% occupancy, 14 overflow bays occupied, peak arrival forecast calculated for 19:00, recommending 2 additional Zone A attendants based on 25 cars/attendant/hr capacity.',
    heroCarX: 520,
    heroCarY: 60,
    heroAngle: -90,
    gateOpen: false,
    highlightSlot: '',
    highlightRoute: false,
    blockedCarVisible: false
  }
];

export const ParkSmartWalkthrough: React.FC = () => {
  const [currentSceneIdx, setCurrentSceneIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scene = SCENES[currentSceneIdx];

  // Auto-play interval
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setTimeout(() => {
        setCurrentSceneIdx((prev) => (prev + 1) % SCENES.length);
      }, 5500);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentSceneIdx]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        background: '#120f26',
        borderRadius: isFullscreen ? '0px' : '16px',
        border: '1px solid #334155',
        color: '#f8fafc',
        padding: '24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
        marginTop: '36px'
      }}
    >
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: '#9333ea', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.5px' }}>
              INTERACTIVE DEMO ARTIFACT
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Isolated Simulation Pipeline</span>
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
            ParkSmart Walkthrough — One Visit at Demo Mall
          </h2>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="btn btn-sm"
            style={{ background: isPlaying ? '#eab308' : '#7e22ce', color: '#fff', fontWeight: 700 }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
          </button>
          <button
            onClick={() => { setIsPlaying(false); setCurrentSceneIdx(0); }}
            className="btn btn-secondary btn-sm"
            style={{ background: '#1c1338', color: '#cbd5e1', borderColor: '#475569' }}
            title="Restart from Scene 1"
          >
            <RotateCcw size={15} />
            <span>Restart</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="btn btn-secondary btn-sm"
            style={{ background: '#1c1338', color: '#cbd5e1', borderColor: '#475569' }}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
        </div>
      </div>

      {/* Clickable Stage Chips Progress Rail */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px' }}>
        {SCENES.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => { setIsPlaying(false); setCurrentSceneIdx(idx); }}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              background: currentSceneIdx === idx ? '#7e22ce' : '#1c1338',
              color: currentSceneIdx === idx ? '#ffffff' : '#94a3b8',
              border: currentSceneIdx === idx ? '1px solid #c084fc' : '1px solid #334155'
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Main Split: Left Top-down SVG Plan vs Right Phone Mockup */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'center' }}>
        {/* Left: Top-Down SVG Parking Plan */}
        <div
          style={{
            background: '#090d16',
            borderRadius: '12px',
            border: '1px solid #1c1338',
            padding: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '8px' }}>
            <span>GROUND LEVEL SCHEMATIC (DEMO MALL)</span>
            <span>STAGE: {scene.title}</span>
          </div>

          <svg viewBox="0 0 600 360" style={{ width: '100%', height: 'auto', borderRadius: '8px' }}>
            {/* Asphalt Background */}
            <rect x="0" y="0" width="600" height="360" fill="#131b2e" />

            {/* Entry Gate (Gate 1) */}
            <rect x="20" y="20" width="100" height="36" rx="4" fill="#1e3a8a" stroke="#9333ea" strokeWidth="2" />
            <text x="70" y="42" fill="#e0f2fe" fontSize="11" fontWeight="700" textAnchor="middle">ENTRY GATE 1</text>
            <line
              x1="70" y1="56"
              x2={scene.gateOpen ? "50" : "110"} y2="56"
              stroke={scene.gateOpen ? "#10b981" : "#ef4444"}
              strokeWidth="4"
              strokeDasharray={scene.gateOpen ? "4,4" : "none"}
            />

            {/* Exit Gate (Gate 2) */}
            <rect x="480" y="20" width="100" height="36" rx="4" fill="#1e3a8a" stroke="#9333ea" strokeWidth="2" />
            <text x="530" y="42" fill="#e0f2fe" fontSize="11" fontWeight="700" textAnchor="middle">EXIT GATE 2</text>
            <line
              x1="530" y1="56"
              x2={currentSceneIdx === 5 ? "510" : "570"} y2="56"
              stroke={currentSceneIdx === 5 ? "#10b981" : "#ef4444"}
              strokeWidth="4"
            />

            {/* Driving Lanes & Markings */}
            <path d="M 70 60 L 70 230 L 530 230 L 530 60" fill="none" stroke="#334155" strokeWidth="36" strokeLinecap="round" />
            <path d="M 70 60 L 70 230 L 530 230 L 530 60" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="8,8" opacity="0.4" />

            {/* Highlighted Route Path for Scene 1 & 2 */}
            {scene.highlightRoute && (
              <path
                d="M 70 60 L 70 170 L 140 170"
                fill="none"
                stroke="#e879f9"
                strokeWidth="5"
                strokeDasharray="6,4"
              />
            )}

            {/* Bay A-101 (Assigned Bay) */}
            <rect
              x="140" y="120" width="60" height="100" rx="4"
              fill={scene.highlightSlot === 'A-101' ? 'rgba(232, 121, 249, 0.15)' : '#1c1338'}
              stroke={scene.highlightSlot === 'A-101' ? '#e879f9' : '#475569'}
              strokeWidth={scene.highlightSlot === 'A-101' ? '3' : '1.5'}
            />
            <text x="170" y="145" fill="#f8fafc" fontSize="12" fontWeight="800" textAnchor="middle">A-101</text>
            <text x="170" y="162" fill="#e879f9" fontSize="9" fontWeight="700" textAnchor="middle">ASSIGNED</text>

            {/* Bay A-102 (Neighbor / Blocked Bay) */}
            <rect
              x="220" y="120" width="60" height="100" rx="4"
              fill={scene.highlightSlot === 'A-102' ? 'rgba(239, 68, 68, 0.25)' : '#1c1338'}
              stroke={scene.highlightSlot === 'A-102' ? '#ef4444' : '#475569'}
              strokeWidth={scene.highlightSlot === 'A-102' ? '3' : '1.5'}
            />
            <text x="250" y="145" fill="#f8fafc" fontSize="12" fontWeight="800" textAnchor="middle">A-102</text>

            {/* Parked Cars */}
            {/* Car in A-103 */}
            <rect x="300" y="120" width="60" height="100" rx="4" fill="#1c1338" stroke="#475569" strokeWidth="1.5" />
            <text x="330" y="145" fill="#94a3b8" fontSize="12" fontWeight="700" textAnchor="middle">A-103</text>
            <rect x="312" y="150" width="36" height="58" rx="6" fill="#475569" />

            {/* EV Charging Bays */}
            <rect x="380" y="120" width="60" height="100" rx="4" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="1.5" />
            <text x="410" y="145" fill="#34d399" fontSize="11" fontWeight="800" textAnchor="middle">EV-01</text>
            <circle cx="410" cy="180" r="10" fill="#10b981" opacity="0.3" />

            {/* Blocking Car Graphic (Scene 5) */}
            {scene.blockedCarVisible && (
              <g transform="translate(245, 195) rotate(-25)">
                <rect x="-18" y="-30" width="36" height="60" rx="6" fill="#dc2626" stroke="#fca5a5" strokeWidth="2" />
                <text x="0" y="4" fill="#fff" fontSize="8" fontWeight="800" textAnchor="middle">BLOCKING</text>
                <circle cx="0" cy="-35" r="8" fill="#ef4444" />
                <text x="0" y="-32" fill="#fff" fontSize="10" fontWeight="900" textAnchor="middle">!</text>
              </g>
            )}

            {/* HERO CAR (KA 01 AB 1234) */}
            <g transform={`translate(${scene.heroCarX}, ${scene.heroCarY}) rotate(${scene.heroAngle})`} style={{ transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <rect x="-16" y="-28" width="32" height="56" rx="6" fill="#7e22ce" stroke="#93c5fd" strokeWidth="2" />
              <rect x="-12" y="-12" width="24" height="24" rx="3" fill="#c084fc" opacity="0.8" />
              {/* Headlights */}
              <circle cx="-10" cy="-26" r="3" fill="#fef08a" />
              <circle cx="10" cy="-26" r="3" fill="#fef08a" />
            </g>
          </svg>

          {/* Plan Footer status indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e879f9' }}>
              <Car size={15} /> KA 01 AB 1234
            </span>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={14} /> Assigned: Bay A-101
            </span>
          </div>
        </div>

        {/* Right: Phone-shaped UI Mockup */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '300px',
              height: '520px',
              background: '#ffffff',
              borderRadius: '36px',
              border: '10px solid #1c1338',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              color: '#120f26',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            {/* Phone Speaker Notch */}
            <div style={{ width: '90px', height: '18px', background: '#1c1338', borderRadius: '0 0 12px 12px', margin: '0 auto' }} />

            {/* In-app Screen Content according to selected scene */}
            <div style={{ padding: '16px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {/* Top in-app header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '12px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#7e22ce' }}>ParkSmart App</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Demo Mall</span>
              </div>

              {/* Scene 1 Mockup: ARRIVE Ticket */}
              {scene.id === 1 && (
                <div>
                  <div style={{ textAlign: 'center', margin: '10px 0' }}>
                    <span className="badge badge-available">Gate 1 Open • Verified</span>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, marginTop: '8px' }}>ANPR Match Confirmed</h4>
                    <p style={{ fontSize: '0.75rem', color: '#64748b' }}>KA 01 AB 1234 (Confidence: 96%)</p>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', margin: '12px 0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Assigned Bay</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#7e22ce' }}>A-101</div>
                    <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>Ground Floor • North Wing</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: '1.4' }}>
                    Barrier raised. Follow blue overhead markings along Lane 1.
                  </div>
                </div>
              )}

              {/* Scene 2 Mockup: GUIDE Find My Car */}
              {scene.id === 2 && (
                <div>
                  <span className="badge badge-available">Find My Car Saved</span>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, marginTop: '6px' }}>Bay Navigation Active</h4>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px', marginTop: '12px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700 }}>Directional Guidance:</div>
                    <ul style={{ fontSize: '0.75rem', color: '#1e3a8a', paddingLeft: '16px', marginTop: '6px', lineHeight: '1.5' }}>
                      <li>Turn right after Gate 1</li>
                      <li>Proceed straight along Lane 1</li>
                      <li>Park in Bay A-101 (Pillar 4B)</li>
                    </ul>
                  </div>
                  <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                    Vehicle securely parked.
                  </div>
                </div>
              )}

              {/* Scene 3 Mockup: VISIT Services */}
              {scene.id === 3 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-available">Session Active</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>1h 35m</span>
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, marginTop: '8px' }}>Active Parking Visit</h4>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>Parking Duration:</span>
                      <strong>95 mins (₹80)</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: '14px', background: '#ecfdf5', padding: '10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46' }}>Requested Service:</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#047857' }}>Eco Foam Car Wash</div>
                    <div style={{ fontSize: '0.72rem', color: '#065f46' }}>Status: In Progress • ₹249</div>
                  </div>
                </div>
              )}

              {/* Scene 4 Mockup: PAY EARLY Bill */}
              {scene.id === 4 && (
                <div>
                  <span className="badge badge-reserved">Payment Due</span>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, marginTop: '6px' }}>Itemized Bill</h4>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Parking (2 hrs):</span>
                      <span>₹80</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Eco Foam Wash:</span>
                      <span>₹249</span>
                    </div>
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.9rem' }}>
                      <span>Total:</span>
                      <span style={{ color: '#7e22ce' }}>₹329</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857' }}>SIMULATED UPI: SUCCESS</span>
                    <p style={{ fontSize: '0.68rem', color: '#065f46' }}>Exit Pass Valid: 20 Minutes</p>
                  </div>
                </div>
              )}

              {/* Scene 5 Mockup: BLOCKED IN Alert */}
              {scene.id === 5 && (
                <div>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                    <AlertTriangle size={24} style={{ color: '#ef4444', margin: '0 auto 4px' }} />
                    <strong style={{ fontSize: '0.85rem', color: '#991b1b' }}>Blocked Vehicle Incident</strong>
                    <p style={{ fontSize: '0.72rem', color: '#7f1d1d' }}>Bay A-102 • MH 12 CD 5678</p>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '0.75rem', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <strong>Driver Responses:</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                      <div style={{ padding: '6px', background: '#7e22ce', color: '#fff', borderRadius: '4px', textAlign: 'center', fontWeight: 600 }}>
                        I'm moving now
                      </div>
                      <div style={{ padding: '6px', background: '#f59e0b', color: '#fff', borderRadius: '4px', textAlign: 'center', fontWeight: 600 }}>
                        Need 5 minutes (Grace Window)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Scene 6 Mockup: EXIT Confirmation */}
              {scene.id === 6 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '40px', height: '40px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px auto' }}>
                    <CheckCircle2 size={24} style={{ color: '#16a34a' }} />
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>Exit Validated</h4>
                  <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Exit Gate 2 Barrier Raised</p>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', margin: '14px 0', fontSize: '0.75rem', textAlign: 'left' }}>
                    <div>Vehicle: <strong>KA 01 AB 1234</strong></div>
                    <div>Bay Released: <strong>A-101 (Available)</strong></div>
                    <div>Total Paid: <strong>₹329</strong></div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>Receipt Saved in Customer Hub</span>
                </div>
              )}

              {/* Scene 7 Mockup: OPERATE Dashboard */}
              {scene.id === 7 && (
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Live Operations</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '10px 0' }}>
                    <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>82%</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Occupancy</div>
                    </div>
                    <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>14/50</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Overflow</div>
                    </div>
                  </div>
                  <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '6px', fontSize: '0.72rem', color: '#1e40af' }}>
                    <strong>Peak Hour Recommendation:</strong>
                    <div>Deploy 2 attendants on Ramp North (25 cars/attendant/hr capacity model).</div>
                  </div>
                </div>
              )}
            </div>

            {/* Phone Bottom Home Bar */}
            <div style={{ width: '100px', height: '4px', background: '#cbd5e1', borderRadius: '2px', margin: '6px auto 10px' }} />
          </div>
        </div>
      </div>

      {/* Caption Box */}
      <div style={{ background: '#1c1338', border: '1px solid #334155', borderRadius: '10px', padding: '16px', marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e879f9', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>
          <span>SCENE {scene.id} OF 7:</span>
          <span>{scene.subtitle}</span>
        </div>
        <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: '1.6' }}>
          {scene.caption}
        </p>
      </div>
    </div>
  );
};
