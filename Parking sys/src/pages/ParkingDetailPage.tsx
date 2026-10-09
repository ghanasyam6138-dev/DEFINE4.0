import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { useDbRevision } from '../hooks/useDbRevision';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Slot, ParkingLevel, LayoutElement, ParkingArea } from '../types';
import {
  MapPin,
  Car,
  Zap,
  Layers,
  LogIn,
  ShieldAlert,
  Clock,
  ChevronRight,
  DollarSign,
  Check,
  Bike
} from 'lucide-react';
import { renderCurvedRoadSvg } from '../components/builder/LayoutBuilder';

export const ParkingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isCustomer, isAdmin, isStaff } = useAuth();
  const { success } = useToast();

  // Live Firebase: re-render whenever slots/status change on any device.
  const dbRevision = useDbRevision();

  const area = id ? dbService.getParkingAreaById(id) : null;
  const [activeLevelId, setActiveLevelId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // When area arrives from Firebase (or levels change), pick a valid level.
  useEffect(() => {
    if (!area?.levels?.length) return;
    const stillValid = area.levels.some((l) => l.id === activeLevelId);
    if (!stillValid) {
      setActiveLevelId(area.levels[0].id);
    }
  }, [area, activeLevelId, dbRevision]);

  // Keep selected slot object in sync with live status updates.
  useEffect(() => {
    if (!selectedSlot) return;
    const fresh = dbService.getSlotById(selectedSlot.id);
    if (!fresh) {
      setSelectedSlot(null);
    } else if (fresh.status !== selectedSlot.status || fresh.isBookable !== selectedSlot.isBookable) {
      setSelectedSlot(fresh);
    }
  }, [dbRevision, selectedSlot]);

  // Admin Tariff Editing State
  const [isEditingTariffs, setIsEditingTariffs] = useState(false);
  const [tariffForm, setTariffForm] = useState({
    baseHourlyRate: area?.tariffs.baseHourlyRate ?? 40,
    evChargingRatePerHour: area?.tariffs.evChargingRatePerHour ?? 80,
    twoWheelerRatePerHour: area?.tariffs.twoWheelerRatePerHour ?? 20,
    twoWheelerEvRatePerHour: area?.tariffs.twoWheelerEvRatePerHour ?? 40,
    freePeriodMinutes: area?.tariffs.freePeriodMinutes ?? 15,
    minimumCharge: area?.tariffs.minimumCharge ?? 40,
    maxDailyFee: area?.tariffs.maxDailyFee ?? 400
  });

  if (!area) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', background: 'rgba(234, 88, 12, 0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
      }}>
        <MapPin size={28} style={{ color: '#ea580c' }} />
      </div>
      <h2 style={{ fontWeight: 800, color: '#f1f5f9' }}>Facility Not Found</h2>
      <p style={{ color: '#475569', marginTop: 8, marginBottom: 24, fontSize: '0.9rem' }}>
        This parking area doesn't exist or is unpublished.
      </p>
      <Link to="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px',
        borderRadius: 12, background: 'linear-gradient(135deg, #f97316, #ef4444)', color: '#fff',
        fontWeight: 700, textDecoration: 'none'
      }}>
        Back to Facilities
      </Link>
    </div>
  );

  const activeLevel = area.levels.find((l: ParkingLevel) => l.id === activeLevelId) || area.levels[0];
  const allSlots = dbService.getSlots(area.id);
  const levelSlots = allSlots.filter((s: Slot) => s.levelId === activeLevel?.id);
  const total = allSlots.length;
  const available = allSlots.filter((s: Slot) => s.status === 'available').length;
  const occupied = allSlots.filter((s: Slot) => s.status === 'occupied').length;
  const evSlots = allSlots.filter((s: Slot) => s.type === 'ev' || s.type === 'two_wheeler_ev');
  const evAvail = evSlots.filter((s: Slot) => s.status === 'available').length;
  const twoWheelers = allSlots.filter((s: Slot) => s.type === 'two_wheeler' || s.type === 'two_wheeler_ev');
  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const handleSaveTariffs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!area) return;

    const updatedArea: ParkingArea = {
      ...area,
      tariffs: {
        ...area.tariffs,
        baseHourlyRate: Number(tariffForm.baseHourlyRate),
        evChargingRatePerHour: Number(tariffForm.evChargingRatePerHour),
        twoWheelerRatePerHour: Number(tariffForm.twoWheelerRatePerHour),
        twoWheelerEvRatePerHour: Number(tariffForm.twoWheelerEvRatePerHour),
        freePeriodMinutes: Number(tariffForm.freePeriodMinutes),
        minimumCharge: Number(tariffForm.minimumCharge),
        maxDailyFee: Number(tariffForm.maxDailyFee)
      },
      updatedAt: new Date().toISOString()
    };

    dbService.saveParkingArea(updatedArea);
    success('Tariffs Updated', `Updated hourly rates for ${area.name} successfully.`);
    setIsEditingTariffs(false);
  };

  const statChips = [
    { label: 'Total Bays', val: total, color: '#f97316', bg: 'rgba(234, 88, 12, 0.15)', border: 'rgba(234, 88, 12, 0.3)' },
    { label: 'Available', val: available, color: '#34d399', bg: 'rgba(5,150,105,0.12)', border: 'rgba(52,211,153,0.25)' },
    { label: 'Occupied', val: occupied, color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(248,113,113,0.25)' },
    { label: 'EV Chargers', val: `${evAvail}/${evSlots.length}`, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
    { label: '2-Wheelers', val: twoWheelers.length, color: '#fb923c', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.25)' },
    { label: 'Car Rate', val: `₹${area.tariffs.baseHourlyRate}/hr`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
    { label: '2-Wheeler Rate', val: `₹${area.tariffs.twoWheelerRatePerHour || 20}/hr`, color: '#ea580c', bg: 'rgba(234,88,12,0.12)', border: 'rgba(234,88,12,0.3)' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ══ Venue Header ══ */}
      <div style={{
        borderRadius: 20, overflow: 'hidden',
        background: 'linear-gradient(135deg, #0e0907 0%, #160e0a 55%, #1f120c 100%)',
        border: '1px solid #2d180f', boxShadow: '0 16px 40px rgba(0,0,0,0.5)'
      }}>
        {/* Top gradient strip */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #ea580c, #f97316, #ef4444)' }} />

        <div style={{ padding: '24px 28px' }}>
          {/* Name + badges + CTA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1 }}>
                  {area.name}
                </h1>
                {!area.isPublished && (
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                    background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)',
                    textTransform: 'uppercase', letterSpacing: '0.08em'
                  }}>
                    Draft
                  </span>
                )}
              </div>
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: '0.88rem' }}>
                <MapPin size={14} style={{ color: '#ea580c', flexShrink: 0 }} />
                {area.address}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {isAdmin && (
                <>
                  <button
                    onClick={() => setIsEditingTariffs(!isEditingTariffs)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '10px 18px', borderRadius: 12,
                      background: isEditingTariffs ? 'rgba(234, 88, 12, 0.25)' : 'rgba(234, 88, 12, 0.12)',
                      border: '1px solid #ea580c',
                      color: '#f97316', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer'
                    }}
                  >
                    <DollarSign size={15} /> {isEditingTariffs ? 'Close Tariff Editor' : 'Edit Hourly Rates'}
                  </button>

                  <Link to={`/builder/${area.id}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '10px 18px', borderRadius: 12, textDecoration: 'none',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#f8fafc', fontWeight: 700, fontSize: '0.86rem'
                  }}>
                    <Layers size={15} /> Layout Editor
                  </Link>
                </>
              )}

              {isCustomer ? (
                <Link to={`/book/${area.id}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 20px', borderRadius: 12, textDecoration: 'none',
                  background: 'linear-gradient(135deg, #f97316, #ef4444)',
                  color: '#fff', fontWeight: 700, fontSize: '0.88rem',
                  boxShadow: '0 4px 16px rgba(234, 88, 12, 0.35)'
                }}>
                  <Car size={16} /> Book Parking <ChevronRight size={14} />
                </Link>
              ) : !user ? (
                <Link to="/login" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 20px', borderRadius: 12, textDecoration: 'none',
                  background: 'linear-gradient(135deg, #f97316, #ef4444)',
                  color: '#fff', fontWeight: 700, fontSize: '0.88rem'
                }}>
                  <LogIn size={16} /> Log In to Book
                </Link>
              ) : (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 14px', borderRadius: 12,
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(251,191,36,0.2)',
                  color: '#fbbf24', fontSize: '0.82rem', fontWeight: 600
                }}>
                  <ShieldAlert size={14} /> Staff/Admin: Booking Restricted
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {area.locationDescription && (
            <p style={{
              color: '#94a3b8', fontSize: '0.88rem', marginTop: 14, lineHeight: 1.6,
              borderTop: '1px solid #2d180f', paddingTop: 14
            }}>
              {area.locationDescription}
            </p>
          )}

          {/* Occupancy bar */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Occupancy
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: occupancyPct > 80 ? '#f87171' : occupancyPct > 50 ? '#fbbf24' : '#34d399' }}>
                {occupancyPct}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99, width: `${occupancyPct}%`,
                background: occupancyPct > 80
                  ? 'linear-gradient(90deg, #dc2626, #f87171)'
                  : occupancyPct > 50
                    ? 'linear-gradient(90deg, #ea580c, #f59e0b)'
                    : 'linear-gradient(90deg, #059669, #34d399)',
                transition: 'width 0.6s ease'
              }} />
            </div>
          </div>

          {/* Stat chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            {statChips.map(chip => (
              <div key={chip.label} style={{
                padding: '8px 14px', borderRadius: 10,
                background: chip.bg, border: `1px solid ${chip.border}`
              }}>
                <div style={{
                  fontSize: '0.58rem', color: chip.color, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2
                }}>
                  {chip.label}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: chip.color }}>{chip.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Admin Rate & Tariff Management Panel ══ */}
      {isAdmin && isEditingTariffs && (
        <div style={{
          background: 'linear-gradient(135deg, #160e0a 0%, #20130d 100%)',
          border: '1px solid #ea580c',
          borderRadius: 18,
          padding: '24px 28px',
          boxShadow: '0 8px 30px rgba(234, 88, 12, 0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(234, 88, 12, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={22} style={{ color: '#f97316' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                  Admin Hourly Rate & Tariff Configuration
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Update separate rates for Cars, EV Chargers, 2-Wheelers, and 2-Wheeler EVs at {area.name}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsEditingTariffs(false)}
              style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '6px 12px', border: '1px solid #2d180f', borderRadius: 8, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveTariffs} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f97316', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Car size={14} /> Car Hourly Rate (₹/hr)
              </label>
              <input
                type="number"
                min="0"
                value={tariffForm.baseHourlyRate}
                onChange={(e) => setTariffForm({ ...tariffForm, baseHourlyRate: Number(e.target.value) })}
                className="form-input"
                style={{ background: '#0a0604', borderColor: '#4a2414', color: '#f8fafc', fontWeight: 700 }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Zap size={14} /> Car EV Charging Rate (₹/hr)
              </label>
              <input
                type="number"
                min="0"
                value={tariffForm.evChargingRatePerHour}
                onChange={(e) => setTariffForm({ ...tariffForm, evChargingRatePerHour: Number(e.target.value) })}
                className="form-input"
                style={{ background: '#0a0604', borderColor: '#4a2414', color: '#f8fafc', fontWeight: 700 }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ea580c', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Bike size={14} /> 2-Wheeler Hourly Rate (₹/hr)
              </label>
              <input
                type="number"
                min="0"
                value={tariffForm.twoWheelerRatePerHour}
                onChange={(e) => setTariffForm({ ...tariffForm, twoWheelerRatePerHour: Number(e.target.value) })}
                className="form-input"
                style={{ background: '#0a0604', borderColor: '#4a2414', color: '#f8fafc', fontWeight: 700 }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Bike size={14} /><Zap size={12} /> 2W EV Charging Rate (₹/hr)
              </label>
              <input
                type="number"
                min="0"
                value={tariffForm.twoWheelerEvRatePerHour}
                onChange={(e) => setTariffForm({ ...tariffForm, twoWheelerEvRatePerHour: Number(e.target.value) })}
                className="form-input"
                style={{ background: '#0a0604', borderColor: '#4a2414', color: '#f8fafc', fontWeight: 700 }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Clock size={14} /> Free Grace Period (Minutes)
              </label>
              <input
                type="number"
                min="0"
                value={tariffForm.freePeriodMinutes}
                onChange={(e) => setTariffForm({ ...tariffForm, freePeriodMinutes: Number(e.target.value) })}
                className="form-input"
                style={{ background: '#0a0604', borderColor: '#4a2414', color: '#f8fafc' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: 6, display: 'block' }}>
                Minimum Charge (₹)
              </label>
              <input
                type="number"
                min="0"
                value={tariffForm.minimumCharge}
                onChange={(e) => setTariffForm({ ...tariffForm, minimumCharge: Number(e.target.value) })}
                className="form-input"
                style={{ background: '#0a0604', borderColor: '#4a2414', color: '#f8fafc' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: 6, display: 'block' }}>
                Max Daily Cap (₹)
              </label>
              <input
                type="number"
                min="0"
                value={tariffForm.maxDailyFee}
                onChange={(e) => setTariffForm({ ...tariffForm, maxDailyFee: Number(e.target.value) })}
                className="form-input"
                style={{ background: '#0a0604', borderColor: '#4a2414', color: '#f8fafc' }}
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: '42px', width: '100%', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              >
                <Check size={16} /> Save Tariff Policy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══ Interactive Bay Map ══ */}
      <div style={{
        borderRadius: 18, background: '#140c09', border: '1px solid #2d180f',
        overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
      }}>
        {/* Map header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #24140d',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
        }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9' }}>
              Live Bay Availability Map
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 3 }}>
              <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
              Click any available bay to view details and reserve · Real-time status
            </p>
          </div>

          {/* Level Switcher */}
          {area.levels.length > 1 && (
            <div style={{ display: 'flex', gap: 6, background: '#0a0604', padding: 4, borderRadius: 12, border: '1px solid #2d180f' }}>
              {area.levels.map((lvl: ParkingLevel) => (
                <button
                  key={lvl.id}
                  onClick={() => { setActiveLevelId(lvl.id); setSelectedSlot(null); }}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: activeLevel?.id === lvl.id ? 'linear-gradient(135deg, #f97316, #ef4444)' : 'transparent',
                    color: activeLevel?.id === lvl.id ? '#fff' : '#94a3b8',
                    border: activeLevel?.id === lvl.id ? '1px solid #ea580c' : '1px solid transparent',
                    boxShadow: activeLevel?.id === lvl.id ? '0 2px 12px rgba(234, 88, 12, 0.35)' : 'none'
                  }}
                >
                  {lvl.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map Canvas */}
        <div style={{ padding: 20, overflowX: 'auto' }}>
          <div style={{
            position: 'relative',
            width: `${activeLevel?.width || 800}px`,
            height: `${activeLevel?.height || 500}px`,
            background: '#0d0705',
            borderRadius: 14,
            border: '1px solid #2d180f',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)',
            overflow: 'hidden',
            margin: '0 auto'
          }}>
            {/* Architectural Elements */}
            {activeLevel?.elements?.map((elem: LayoutElement) => {
              const isRoad = elem.type === 'road';
              const isCurve = elem.curveCorner && elem.curveCorner !== 'none';
              const isH = elem.width >= elem.height;
              const isV = elem.height > elem.width;

              return (
                <div
                  key={elem.id}
                  style={{
                    position: 'absolute',
                    left: `${elem.x}px`,
                    top: `${elem.y}px`,
                    width: `${elem.width}px`,
                    height: `${elem.height}px`,
                    background: isCurve
                      ? 'transparent'
                      : isRoad
                        ? '#171412'
                        : elem.type === 'entry_gate'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : elem.type === 'exit_gate'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(255, 255, 255, 0.04)',
                    border: isCurve
                      ? 'none'
                      : isRoad
                        ? '1px solid #332018'
                        : elem.type === 'entry_gate'
                          ? '1px solid #10b981'
                          : elem.type === 'exit_gate'
                            ? '1px solid #ef4444'
                            : '1px solid #2d180f',
                    borderRadius: isRoad && !isCurve ? 4 : 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                  }}
                >
                  {isCurve && elem.curveCorner && elem.curveCorner !== 'none' ? (
                    renderCurvedRoadSvg(elem.curveCorner, elem.width, elem.height, 1)
                  ) : isRoad ? (
                    <>
                      {isH && (
                        <div style={{
                          position: 'absolute', top: '50%', left: 0, right: 0, height: 0,
                          borderTop: '2px dashed #f59e0b', transform: 'translateY(-50%)', opacity: 0.6
                        }} />
                      )}
                      {isV && (
                        <div style={{
                          position: 'absolute', left: '50%', top: 0, bottom: 0, width: 0,
                          borderLeft: '2px dashed #f59e0b', transform: 'translateX(-50%)', opacity: 0.6
                        }} />
                      )}
                      {elem.label && (
                        <div style={{
                          position: 'relative', zIndex: 2,
                          background: 'rgba(14, 9, 7, 0.85)', padding: '2px 8px',
                          borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)',
                          fontSize: '0.62rem', color: '#94a3b8',
                          display: 'flex', alignItems: 'center', gap: 3,
                          writingMode: isV ? 'vertical-rl' : 'horizontal-tb'
                        }}>
                          <span>{elem.label}</span>
                          {elem.direction === 'right' && <span>→</span>}
                          {elem.direction === 'left' && <span>←</span>}
                          {elem.direction === 'up' && <span>↑</span>}
                          {elem.direction === 'down' && <span>↓</span>}
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>{elem.label}</span>
                  )}
                </div>
              );
            })}

            {/* Slots */}
            {levelSlots.map((slot: Slot) => {
              const isSelected = selectedSlot?.id === slot.id;
              const isEV = slot.type === 'ev' || slot.type === 'two_wheeler_ev';
              const isTwoWheeler = slot.type === 'two_wheeler' || slot.type === 'two_wheeler_ev';

              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot)}
                  className={`slot-node slot-node-${slot.status} ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: `${slot.coordinates.x}px`, top: `${slot.coordinates.y}px`,
                    width: `${slot.coordinates.width}px`, height: `${slot.coordinates.height}px`,
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 2px #ea580c, 0 6px 16px rgba(234, 88, 12, 0.4)' : undefined
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {isTwoWheeler && <Bike size={11} style={{ color: isEV ? '#10b981' : '#f97316' }} />}
                    {isEV && <Zap size={11} style={{ color: '#10b981' }} />}
                    <span style={{ fontSize: isTwoWheeler ? '0.65rem' : '0.72rem' }}>{slot.number}</span>
                  </div>
                  <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', opacity: 0.85 }}>
                    {slot.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, padding: '14px 24px', flexWrap: 'wrap', borderTop: '1px solid #24140d', background: '#0d0705' }}>
          {[
            { label: 'Available', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
            { label: 'Occupied', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
            { label: 'Reserved', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
            { label: 'Car EV Bay', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
            { label: '2-Wheeler Bay', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
            { label: '2W EV Bay', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
          ].map(l => (
            <div key={l.label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600
            }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, border: `1px solid ${l.color}` }} />
              {l.label}
            </div>
          ))}
        </div>

        {/* Selected slot drawer */}
        {selectedSlot && (
          <div style={{
            margin: '16px 20px', padding: '18px 20px', borderRadius: 14,
            background: selectedSlot.status === 'available' ? 'rgba(5,150,105,0.08)' : 'rgba(255,255,255,0.02)',
            border: selectedSlot.status === 'available' ? '1px solid rgba(52,211,153,0.25)' : '1px solid #2d180f',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
            transition: 'all 0.3s'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f1f5f9' }}>Bay {selectedSlot.number}</span>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  background: selectedSlot.status === 'available' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                  color: selectedSlot.status === 'available' ? '#34d399' : '#f87171',
                  border: `1px solid ${selectedSlot.status === 'available' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`
                }}>
                  {selectedSlot.status.toUpperCase()}
                </span>

                {(selectedSlot.type === 'two_wheeler' || selectedSlot.type === 'two_wheeler_ev') && (
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                    background: 'rgba(234, 88, 12, 0.15)', color: '#f97316',
                    border: '1px solid rgba(234, 88, 12, 0.3)', textTransform: 'uppercase', letterSpacing: '0.08em'
                  }}>
                    <Bike size={10} style={{ display: 'inline', marginRight: 3 }} />
                    {selectedSlot.type === 'two_wheeler_ev' ? '2-Wheeler EV' : 'Two-Wheeler Bay'}
                  </span>
                )}

                {(selectedSlot.type === 'ev' || selectedSlot.type === 'two_wheeler_ev') && (
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                    background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)', textTransform: 'uppercase', letterSpacing: '0.08em'
                  }}>
                    <Zap size={9} style={{ display: 'inline', marginRight: 2 }} /> EV Charger
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {selectedSlot.directionalNotes || 'Parking Bay'} • Hourly Rate: ₹
                {selectedSlot.type === 'two_wheeler'
                  ? (area.tariffs.twoWheelerRatePerHour || 20)
                  : selectedSlot.type === 'two_wheeler_ev'
                    ? (area.tariffs.twoWheelerEvRatePerHour || 40)
                    : selectedSlot.type === 'ev'
                      ? (area.tariffs.evChargingRatePerHour || 80)
                      : area.tariffs.baseHourlyRate}/hr
              </p>
            </div>

            {selectedSlot.status === 'available' ? (
              isStaff || isAdmin ? (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', fontSize: '0.8rem', fontWeight: 600
                }}>
                  <ShieldAlert size={13} /> Staff/Admin: Booking Restricted
                </div>
              ) : !user ? (
                <Link to="/login" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #f97316, #ef4444)',
                  color: '#fff', fontWeight: 700, fontSize: '0.86rem', textDecoration: 'none'
                }}>
                  <LogIn size={15} /> Log In to Reserve
                </Link>
              ) : (
                <Link to={`/book/${area.id}?slot=${selectedSlot.id}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #f97316, #ef4444)',
                  color: '#fff', fontWeight: 700, fontSize: '0.86rem', textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)'
                }}>
                  Reserve Bay {selectedSlot.number} <ChevronRight size={14} />
                </Link>
              )
            ) : (
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                Currently Occupied / Unavailable
              </span>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
