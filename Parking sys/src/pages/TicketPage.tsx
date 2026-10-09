import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { dbService } from '../services/dbService';
import { useDbRevision } from '../hooks/useDbRevision';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import type { Booking } from '../types';
import {
  Download,
  Printer,
  ShieldCheck,
  MapPin,
  Clock,
  Car,
  Zap,
  CalendarCheck,
  ArrowLeft,
  Copy,
  CheckCircle2,
  QrCode,
  Layers,
  Tag,
  Sparkles,
  ExternalLink,
  Wallet
} from 'lucide-react';

/* ── tiny reusable row ── */
const DetailRow: React.FC<{
  icon: React.ReactNode; label: string; value: string; accent?: boolean; mono?: boolean;
}> = ({ icon, label, value, accent, mono }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
    borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
      background: accent ? 'rgba(52,211,153,0.15)' : 'rgba(147, 51, 234, 0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: accent ? '#34d399' : '#d946ef'
    }}>
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>{label}</div>
      <div style={{
        fontSize: '0.88rem', fontWeight: 700, marginTop: 2,
        color: accent ? '#34d399' : '#e2e8f0',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        letterSpacing: mono ? '1px' : 'normal'
      }}>{value}</div>
    </div>
  </div>
);

export const TicketPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { success } = useToast();
  const { isCustomer, isApprovedStaff, isAdmin } = useAuth();

  // Live: re-renders when the booking changes on any device.
  useDbRevision();
  const booking: Booking | null = bookingId ? (dbService.getBookingById(bookingId) ?? null) : null;
  const [ticketQrUrl, setTicketQrUrl] = useState<string>('');
  const [slotQrUrl, setSlotQrUrl] = useState<string>('');
  const [showSignage, setShowSignage] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const ticketToken = booking?.ticketToken;
  const ticketAreaId = booking?.parkingAreaId;
  const ticketSlotNumber = booking?.slotNumber;

  useEffect(() => {
    const bk = ticketToken && ticketAreaId && ticketSlotNumber
      ? { ticketToken, parkingAreaId: ticketAreaId, slotNumber: ticketSlotNumber }
      : null;
    if (bk) {
      // Ticket QR — secure random token only
      QRCode.toDataURL(bk.ticketToken, {
        width: 300, margin: 2,
        color: { dark: '#120f26', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      }).then(setTicketQrUrl).catch(console.error);

      // Signage QR — blocked-car report link
      const sigUrl = `${window.location.origin}/blocked-car?area=${bk.parkingAreaId}&slot=${bk.slotNumber}`;
      QRCode.toDataURL(sigUrl, { width: 200, margin: 2, color: { dark: '#120f26', light: '#ffffff' } })
        .then(setSlotQrUrl).catch(console.error);
    }
  }, [ticketToken, ticketAreaId, ticketSlotNumber]);

  if (!booking) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', background: 'rgba(147, 51, 234, 0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
      }}>
        <QrCode size={30} style={{ color: '#9333ea' }} />
      </div>
      <h2 style={{ fontWeight: 800, color: '#f1f5f9' }}>Ticket Not Found</h2>
      <p style={{ color: '#475569', marginTop: 8, marginBottom: 24, fontSize: '0.9rem' }}>
        This reservation could not be located. It may have expired or been cancelled.
      </p>
      <Link to="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px',
        borderRadius: 12, background: 'linear-gradient(135deg,#9333ea,#a855f7)', color: '#fff',
        fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(147, 51, 234, 0.25) '
      }}>
        Back to Facilities
      </Link>
    </div>
  );

  const handleDownload = () => {
    if (!ticketQrUrl) return;
    const a = document.createElement('a');
    a.href = ticketQrUrl;
    a.download = `ParkSmart-Ticket-${booking.bookingNumber}.png`;
    a.click();
    success('Downloaded', 'QR pass saved to your device.');
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(booking.ticketToken).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    });
  };

  const statusCfg =
    booking.status === 'reserved' ? { label: 'RESERVED', dot: '#fbbf24', bg: 'rgba(217,119,6,0.18)', border: 'rgba(251,191,36,0.35)' } :
      booking.status === 'active_inside' ? { label: 'INSIDE NOW', dot: '#34d399', bg: 'rgba(5,150,105,0.18)', border: 'rgba(52,211,153,0.35)' } :
        {
          label: booking.status.replace(/_/g, ' ').toUpperCase(),
          dot: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)'
        };

  const startDate = new Date(booking.startTime);
  const endDate = new Date(booking.endTime);
  const backHref = isCustomer ? '/customer' : isAdmin ? '/admin' : isApprovedStaff ? '/staff' : '/';

  const fmtTime = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { dateStyle: 'medium' });

  return (
    <div style={{ maxWidth: 580, margin: '0 auto', padding: '0 16px 48px' }}>

      {/* Back */}
      <Link to={backHref} style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 20,
        color: '#475569', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none',
        padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)', transition: 'all 0.2s'
      }}>
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      {/* ════════════════════════════════
          BOARDING PASS CARD  (dark)
      ════════════════════════════════ */}
      <div style={{
        borderRadius: 22, overflow: 'hidden',
        background: '#0f0a22',
        border: '1px solid #241b3e',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)'
      }}>

        {/* ── Gradient header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0c0820 0%, #170f35 45%, #12092c 100%)',
          padding: '28px 28px 24px', position: 'relative', overflow: 'hidden'
        }}>
          {/* Decorative orbs */}
          <div style={{
            position: 'absolute', top: -50, right: -50, width: 200, height: 200,
            background: 'radial-gradient(circle, rgba(147, 51, 234, 0.25)  0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute', bottom: -60, left: '30%', width: 180, height: 180,
            background: 'radial-gradient(circle, rgba(232, 121, 249, 0.25)  0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none'
          }} />

          {/* Status + ref row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, position: 'relative' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
              color: statusCfg.dot, padding: '4px 12px', borderRadius: 20,
              fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusCfg.dot, display: 'inline-block' }} />
              {statusCfg.label}
            </span>
            <span style={{ color: '#334155', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
              #{booking.bookingNumber}
            </span>
          </div>

          {/* Facility name + title */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <MapPin size={13} style={{ color: '#e879f9' }} />
              <span style={{ color: '#e879f9', fontSize: '0.75rem', fontWeight: 700 }}>{booking.parkingAreaName}</span>
            </div>
            <h1 style={{ color: '#f1f5f9', fontSize: '1.55rem', fontWeight: 900, lineHeight: 1.1, marginBottom: 4 }}>
              Parking Entry Pass
            </h1>
            <p style={{ color: '#475569', fontSize: '0.82rem' }}>
              {booking.levelName} &nbsp;·&nbsp; {booking.zoneName}
            </p>
          </div>
        </div>

        {/* ── Perforated tear line ── */}
        <div style={{
          position: 'relative', height: 2,
          background: 'repeating-linear-gradient(to right, #241b3e 0, #241b3e 10px, transparent 10px, transparent 20px)'
        }}>
          {['left', 'right'].map(side => (
            <div key={side} style={{
              position: 'absolute', [side === 'left' ? 'left' : 'right']: -16,
              top: '50%', transform: 'translateY(-50%)',
              width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-app)'
            }} />
          ))}
        </div>

        {/* ── Bay hero + QR side by side ── */}
        <div style={{ padding: '24px 28px', display: 'flex', gap: 20, alignItems: 'stretch' }}>
          {/* Left: Bay info */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.12em', color: '#334155', marginBottom: 4
            }}>
              Reserved Bay
            </div>
            <div style={{
              fontSize: '4.8rem', fontWeight: 900, lineHeight: 1,
              background: 'linear-gradient(135deg, #9333ea, #e879f9)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
            }}>
              {booking.slotNumber}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {booking.isEVRequested && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem',
                  fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                  background: 'rgba(5,150,105,0.18)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)'
                }}>
                  <Zap size={11} /> EV Charging
                </span>
              )}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem',
                fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                background: 'rgba(147, 51, 234, 0.15)', color: '#d946ef', border: '1px solid rgba(217, 70, 239, 0.25) '
              }}>
                <Layers size={11} /> {booking.levelName.split('(')[0].trim()}
              </span>
            </div>

            {/* Plate */}
            <div style={{
              marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, #0c0820, #0f0a1e)',
              border: '2px solid #2d1a52', borderRadius: 10, padding: '8px 16px'
            }}>
              <Car size={15} style={{ color: '#475569' }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 800,
                color: '#e2e8f0', letterSpacing: '2px'
              }}>
                {booking.vehiclePlate}
              </span>
            </div>
          </div>

          {/* Right: QR Code */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              background: '#ffffff', padding: 10, borderRadius: 16,
              boxShadow: '0 0 0 1px #241b3e, 0 8px 24px rgba(0,0,0,0.4)'
            }}>
              {ticketQrUrl
                ? <img src={ticketQrUrl} alt="Entry QR" style={{ width: 136, height: 136, display: 'block' }} />
                : <div style={{
                  width: 136, height: 136, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#f8fafc'
                }}>
                  <div className="skeleton" style={{ width: 110, height: 110 }} />
                </div>
              }
            </div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em', color: '#334155' }}>
              SCAN AT GATE
            </span>
            <span style={{ fontSize: '0.55rem', color: '#2d1a52', fontWeight: 600 }}>
              One-use • Secure Token
            </span>
          </div>
        </div>

        {/* ── Details grid ── */}
        <div style={{ height: 1, background: '#170f30', margin: '0 28px' }} />
        <div style={{ padding: '20px 28px' }}>
          <div style={{
            fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: '#334155', marginBottom: 12
          }}>
            Booking Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <DetailRow icon={<CalendarCheck size={14} />} label="Entry From"
              value={`${fmtDate(startDate)}, ${fmtTime(startDate)}`} />
            <DetailRow icon={<Clock size={14} />} label="Valid Until"
              value={fmtTime(endDate)} />
            <DetailRow icon={<MapPin size={14} />} label="Zone"
              value={booking.zoneName.split('(')[0].trim()} />
            <DetailRow icon={<Car size={14} />} label="Bay Type"
              value={booking.slotType === 'ev' ? '⚡ EV Bay' : 'Standard Bay'} />
            <DetailRow icon={<Wallet size={14} />} label="Est. Total"
              value={`₹${booking.estimatedTotal}`} accent />
            <DetailRow icon={<Tag size={14} />} label="Booking Ref"
              value={`#${booking.bookingNumber}`} mono />
          </div>
        </div>

        {/* ── Add-on services ── */}
        {booking.servicesRequested && booking.servicesRequested.length > 0 && (
          <>
            <div style={{ height: 1, background: '#170f30', margin: '0 28px' }} />
            <div style={{ padding: '16px 28px' }}>
              <div style={{
                fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#334155', marginBottom: 10
              }}>
                Add-on Services
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {booking.servicesRequested.map((svc, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '9px 12px', borderRadius: 10,
                    background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Sparkles size={13} style={{ color: '#34d399' }} />
                      <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem' }}>{svc.serviceName}</span>
                    </div>
                    <span style={{ color: '#34d399', fontWeight: 800, fontSize: '0.9rem' }}>₹{svc.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Security token strip ── */}
        <div style={{ margin: '0 28px 24px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #09061a, #110a28)',
            border: '1px solid #221640', borderRadius: 12, padding: '13px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10
          }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <ShieldCheck size={11} style={{ color: '#34d399' }} />
                <span style={{ fontSize: '0.58rem', color: '#34d399', fontWeight: 800, letterSpacing: '0.12em' }}>
                  SECURE ENTRY TOKEN
                </span>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#475569',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}>
                {booking.ticketToken}
              </div>
            </div>
            <button onClick={handleCopyToken} style={{
              flexShrink: 0, padding: '7px 12px', borderRadius: 9, cursor: 'pointer',
              background: tokenCopied ? 'rgba(52,211,153,0.2)' : 'rgba(147, 51, 234, 0.15)',
              border: tokenCopied ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(217, 70, 239, 0.25) ',
              color: tokenCopied ? '#34d399' : '#d946ef',
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.2s'
            }}>
              {tokenCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              {tokenCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: 10, padding: '0 28px 20px', flexWrap: 'wrap' }}>
          <button onClick={handleDownload} style={{
            flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '11px 20px', borderRadius: 12, cursor: 'pointer',
            background: 'linear-gradient(135deg, #9333ea, #a855f7)',
            border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.88rem',
            boxShadow: '0 4px 16px rgba(147, 51, 234, 0.25) '
          }}>
            <Download size={16} /> Download QR
          </button>
          <button onClick={() => setShowSignage(true)} style={{
            flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '11px 20px', borderRadius: 12, cursor: 'pointer',
            background: 'rgba(232, 121, 249, 0.15)',
            border: '1px solid rgba(232, 121, 249, 0.25) ', color: '#e879f9', fontWeight: 700, fontSize: '0.88rem'
          }}>
            <Printer size={16} /> Bay Signage
          </button>
          <Link to={backHref} style={{
            flex: '1 1 100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 12,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#64748b', fontWeight: 600, fontSize: '0.86rem', textDecoration: 'none'
          }}>
            <ExternalLink size={14} /> Back to Dashboard
          </Link>
        </div>

        {/* ── Footer disclaimer ── */}
        <div style={{
          borderTop: '1px solid #110a28', padding: '14px 28px',
          background: 'rgba(0,0,0,0.2)', display: 'flex', gap: 8, alignItems: 'flex-start'
        }}>
          <ShieldCheck size={13} style={{ color: '#2d1a52', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.67rem', color: '#334155', margin: 0, lineHeight: 1.6 }}>
            Cryptographically secured pass. The QR contains only a one-time random token — no personal data is encoded.
            Present at the entry camera or type the token at the gate scanner.
          </p>
        </div>
      </div>

      {/* ════ Bay Signage Modal ════ */}
      {showSignage && (
        <div className="modal-overlay" onClick={() => setShowSignage(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}
            style={{ textAlign: 'center', maxWidth: 400, borderRadius: 20, padding: 0, overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{
              background: 'linear-gradient(135deg, #0c0820, #170f30)',
              padding: '18px 24px', borderBottom: '1px solid #241b3e'
            }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f1f5f9' }}>
                Bay Signage QR
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 2 }}>
                Print and affix to your reserved bay
              </div>
            </div>

            <div style={{ padding: '24px', background: '#0f0a22' }}>
              {/* Bay label */}
              <div style={{
                background: 'linear-gradient(135deg, #09061a, #110a28)',
                border: '1px solid #241b3e', borderRadius: 14, padding: '20px 16px', marginBottom: 16
              }}>
                <div style={{
                  fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: '#334155', marginBottom: 4
                }}>
                  Reserved Bay
                </div>
                <div style={{
                  fontSize: '3.5rem', fontWeight: 900, lineHeight: 1,
                  background: 'linear-gradient(135deg, #9333ea, #e879f9)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                }}>
                  {booking.slotNumber}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 6 }}>
                  {booking.parkingAreaName} · {booking.levelName}
                </div>
                {slotQrUrl && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{
                      background: '#fff', padding: 8, borderRadius: 12, display: 'inline-block',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
                    }}>
                      <img src={slotQrUrl} alt="Signage QR" style={{ width: 140, height: 140, display: 'block' }} />
                    </div>
                  </div>
                )}
                <div style={{
                  marginTop: 12, padding: '8px 12px', borderRadius: 10,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)'
                }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#f87171' }}>
                    SCAN TO REPORT BLOCKED VEHICLE
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#7f1d1d', marginTop: 2 }}>
                    Prefills Bay {booking.slotNumber} · 30-sec automated escalation
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => window.print()} style={{
                  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '11px', borderRadius: 12, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #9333ea, #a855f7)',
                  border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.86rem'
                }}>
                  <Printer size={15} /> Print Sign
                </button>
                <button onClick={() => setShowSignage(false)} style={{
                  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '11px', borderRadius: 12, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#64748b', fontWeight: 600, fontSize: '0.86rem'
                }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};