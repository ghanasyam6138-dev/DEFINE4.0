import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/dbService';
import { useDbRevision } from '../hooks/useDbRevision';
import { useToast } from '../context/ToastContext';
import { normalizePlateNumber } from '../services/cryptoService';
import { DEMO_MALL_ID } from '../services/seedData';
import type { Slot, ParkingArea } from '../types';
import {
  Car,
  Zap,
  DollarSign,
  Printer,
  QrCode,
  CheckCircle2,
  Clock
} from 'lucide-react';

export const WalkInCashPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error, warning } = useToast();
  const navigate = useNavigate();

  const assignedAreaId = (user as any)?.assignedParkingAreaId || DEMO_MALL_ID;
  const [area, setArea] = useState<ParkingArea | undefined>(dbService.getParkingAreaById(assignedAreaId));
  const [slots, setSlots] = useState<Slot[]>([]);

  const [vehiclePlate, setVehiclePlate] = useState('');
  const [durationHours, setDurationHours] = useState(2);
  const [isEV, setIsEV] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [cashCollected, setCashCollected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  // Live slot availability from Firebase (multi-device safe)
  const dbRevision = useDbRevision();

  useEffect(() => {
    const all = dbService.getSlots(assignedAreaId);
    setSlots(all.filter(s => s.status === 'available' && s.isBookable));
    setArea(dbService.getParkingAreaById(assignedAreaId));
  }, [assignedAreaId, dbRevision]);

  const filteredSlots = slots.filter(s =>
    isEV ? s.type === 'ev' : (s.type === 'standard' || s.type === 'accessible')
  );

  // Auto-select first available slot when filter changes
  useEffect(() => {
    if (filteredSlots.length > 0 && !filteredSlots.find(s => s.id === selectedSlotId)) {
      setSelectedSlotId(filteredSlots[0].id);
    }
  }, [isEV, filteredSlots.length]);

  // Auto-calculate estimated cash based on tariff
  useEffect(() => {
    if (!area) return;
    const parkFee = durationHours * area.tariffs.baseHourlyRate;
    const evFee = isEV ? durationHours * (area.tariffs.evChargingRatePerHour || 80) : 0;
    setCashCollected(Math.max(area.tariffs.minimumCharge, parkFee + evFee));
  }, [durationHours, isEV, area]);

  const handleCreateWalkIn = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) { error('Login Required', 'Please log in as staff.'); return; }
    if (!vehiclePlate.trim()) { error('Plate Required', 'Enter the vehicle plate number.'); return; }

    const plateCheck = normalizePlateNumber(vehiclePlate);
    if (!plateCheck.isValid) {
      error('Invalid Plate', 'Please enter a valid vehicle license plate.');
      return;
    }

    if (!selectedSlotId) {
      error('No Slot', 'Please select an available parking bay.');
      return;
    }

    if (cashCollected <= 0) {
      warning('Cash Amount', 'Please set the cash amount collected.');
      return;
    }

    setLoading(true);

    const result = dbService.createWalkInBooking({
      vehiclePlate: plateCheck.display,
      vehiclePlateNormalized: plateCheck.normalized,
      parkingAreaId: assignedAreaId,
      slotId: selectedSlotId,
      isEV,
      cashAmountCollected: cashCollected,
      staffId: user.id,
      staffName: user.name,
      durationHours
    });

    setLoading(false);

    if (result.success && result.booking) {
      success(
        'Walk-in Booking Created!',
        `Bay ${result.booking.slotNumber} assigned to ${plateCheck.display}. QR ticket generated.`
      );
      setCreatedBookingId(result.booking.id);
    } else {
      error('Booking Failed', result.error || 'Could not create walk-in booking.');
    }
  };

  if (createdBookingId) {
    return (
      <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ width: '60px', height: '60px', background: 'rgba(16,185,129,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle2 size={32} style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#120f26', marginBottom: '8px' }}>
            Walk-in Booking Created
          </h2>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>
            Cash collected. QR ticket is ready. Hand the printed slip to the customer or scan at entry gate.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <a
              href={`/ticket/${createdBookingId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              <QrCode size={18} />
              <span>View &amp; Print QR Ticket</span>
            </a>
            <button
              onClick={() => {
                setCreatedBookingId(null);
                setVehiclePlate('');
                setDurationHours(2);
                setIsEV(false);
              }}
              className="btn btn-secondary"
            >
              <Car size={16} />
              <span>New Walk-in</span>
            </button>
            <button onClick={() => navigate('/staff')} className="btn btn-secondary">
              Back to Staff Console
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '0' }}>
        <div>
          <span className="badge badge-staff" style={{ marginBottom: '6px' }}>STAFF ONLY</span>
          <h1 className="page-title">Walk-in Cash Booking</h1>
          <p className="page-desc">
            Create a parking booking for a vehicle without an account. Collect cash and generate a functional QR entry ticket.
          </p>
        </div>
      </div>

      {/* Facility Info */}
      {area && (
        <div style={{ background: 'rgba(232, 121, 249, 0.15)', border: '1px solid rgba(232, 121, 249, 0.25) ', borderRadius: '10px', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Car size={18} style={{ color: '#e879f9' }} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#120f26' }}>
            Facility: <strong>{area.name}</strong> &nbsp;•&nbsp; Tariff: ₹{area.tariffs.baseHourlyRate}/hr
            {isEV && ` + ₹${area.tariffs.evChargingRatePerHour}/hr EV`}
          </span>
        </div>
      )}

      <form onSubmit={handleCreateWalkIn} className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Vehicle Plate */}
        <div className="form-group">
          <label className="form-label">Vehicle License Plate *</label>
          <input
            type="text"
            value={vehiclePlate}
            onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
            className="form-input"
            placeholder="e.g. KA 01 AB 1234"
            required
            autoFocus
          />
        </div>

        {/* Slot Type Toggle */}
        <div className="form-group">
          <label className="form-label">Slot Type</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsEV(false)}
              className={`btn ${!isEV ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              style={{ flex: 1 }}
            >
              <Car size={15} />
              <span>Standard</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEV(true)}
              className={`btn ${isEV ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              style={{ flex: 1, color: isEV ? '#fff' : '#f59e0b', borderColor: '#f59e0b' }}
            >
              <Zap size={15} />
              <span>EV Charging Bay</span>
            </button>
          </div>
        </div>

        {/* Slot Selector */}
        <div className="form-group">
          <label className="form-label">
            Select Bay &nbsp;
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>
              ({filteredSlots.length} available)
            </span>
          </label>
          {filteredSlots.length === 0 ? (
            <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#ef4444', fontSize: '0.88rem' }}>
              No {isEV ? 'EV' : 'standard'} slots available right now.
            </div>
          ) : (
            <select
              value={selectedSlotId}
              onChange={(e) => setSelectedSlotId(e.target.value)}
              className="form-input"
            >
              {filteredSlots.map(s => (
                <option key={s.id} value={s.id}>
                  Bay {s.number} {s.type === 'ev' ? '⚡ EV' : ''} — {s.directionalNotes || 'Available'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Duration */}
        <div className="form-group">
          <label className="form-label">
            <Clock size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Estimated Duration
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 6, 8].map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setDurationHours(h)}
                className={`btn btn-sm ${durationHours === h ? 'btn-primary' : 'btn-secondary'}`}
                style={{ minWidth: '60px' }}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {/* Cash Amount */}
        <div className="form-group">
          <label className="form-label">
            <DollarSign size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Cash Amount Collected (₹)
          </label>
          <input
            type="number"
            value={cashCollected}
            onChange={(e) => setCashCollected(Number(e.target.value))}
            className="form-input"
            min={0}
            step={10}
          />
          <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Estimated charge: ₹{area ? (durationHours * area.tariffs.baseHourlyRate + (isEV ? durationHours * (area.tariffs.evChargingRatePerHour || 80) : 0)) : 0}
            {area && ` (min ₹${area.tariffs.minimumCharge})`}
          </p>
        </div>

        {/* Summary */}
        {vehiclePlate && selectedSlotId && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '14px 18px' }}>
            <p style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem', marginBottom: '4px' }}>
              ✓ Booking Summary
            </p>
            <div style={{ fontSize: '0.84rem', color: '#166534', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>Plate: <strong>{vehiclePlate.toUpperCase()}</strong></span>
              <span>Bay: <strong>{filteredSlots.find(s => s.id === selectedSlotId)?.number || '—'}</strong>{isEV ? ' ⚡ EV' : ''}</span>
              <span>Duration: <strong>{durationHours}h</strong></span>
              <span>Cash: <strong>₹{cashCollected}</strong></span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || filteredSlots.length === 0}
          className="btn btn-primary"
          style={{ fontWeight: 700, fontSize: '1rem', padding: '14px' }}
        >
          <Printer size={18} />
          <span>{loading ? 'Creating...' : 'Collect Cash & Generate QR Ticket'}</span>
        </button>
      </form>
    </div>
  );
};
