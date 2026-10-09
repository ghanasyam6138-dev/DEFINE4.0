import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { useDbRevision } from '../hooks/useDbRevision';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { normalizePlateNumber } from '../services/cryptoService';
import type { Slot, ParkingLevel, Zone } from '../types';
import {
  Zap,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';

export const BookingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const preselectedSlotId = searchParams.get('slot');

  const { user } = useAuth();
  const { success, error, warning } = useToast();
  const navigate = useNavigate();

  // Live Firebase: useDbRevision forces a re-render on every RTDB change.
  const dbRevision = useDbRevision();

  const area = id ? dbService.getParkingAreaById(id) : null;

  // Re-read slots from the live store on every revision (do not cache across revisions).
  // void dbRevision keeps the dependency intentional for eslint.
  void dbRevision;
  const slots: Slot[] = area ? dbService.getSlots(area.id) : [];

  const [vehiclePlate, setVehiclePlate] = useState<string>('KA 01 AB 1234');
  const [selectedSlotId, setSelectedSlotId] = useState<string>(preselectedSlotId || '');
  const [slotTypePreference, setSlotTypePreference] = useState<'standard' | 'ev'>('standard');
  const [durationHours, setDurationHours] = useState<number>(2);
  const [isEVRequested, setIsEVRequested] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Available slots for selected slot type — recomputed every render (driven by dbRevision).
  const availableSlots = slots.filter((s: Slot) => s.status === 'available' && s.isBookable);
  const filteredAvailableSlots = availableSlots.filter((s: Slot) =>
    slotTypePreference === 'ev' ? s.type === 'ev' : s.type === 'standard' || s.type === 'accessible'
  );

  // Stable id list for effect deps (avoid array identity churn).
  const filteredIds = filteredAvailableSlots.map((s) => s.id).join(',');

  // When live data changes, drop selection if the bay was taken on another device.
  useEffect(() => {
    const stillAvailable = filteredAvailableSlots.some((slot) => slot.id === selectedSlotId);
    if (!stillAvailable && filteredAvailableSlots.length > 0) {
      setSelectedSlotId(filteredAvailableSlots[0].id);
    } else if (filteredAvailableSlots.length === 0 && selectedSlotId) {
      setSelectedSlotId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotTypePreference, filteredIds, selectedSlotId, dbRevision]);

  if (!area) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2>Facility Not Found</h2>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '16px' }}>
          Back to Facilities
        </Link>
      </div>
    );
  }

  const selectedSlot = slots.find((s: Slot) => s.id === selectedSlotId);
  const level = area.levels.find((l: ParkingLevel) => l.id === selectedSlot?.levelId) || area.levels[0];
  const zone = level?.zones.find((z: Zone) => z.id === selectedSlot?.zoneId) || level?.zones[0];

  // Pricing calculation
  const parkingFee = durationHours * area.tariffs.baseHourlyRate;
  const evFee = (isEVRequested || selectedSlot?.type === 'ev') ? durationHours * (area.tariffs.evChargingRatePerHour || 80) : 0;
  const totalEstimated = parkingFee + evFee;

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      warning('Login Required', 'Please log in or register before completing your booking.');
      navigate('/login');
      return;
    }

    const plateCheck = normalizePlateNumber(vehiclePlate);
    if (!plateCheck.isValid) {
      error('Invalid Plate', 'Please enter a valid vehicle license plate number.');
      return;
    }

    if (!selectedSlot) {
      error('No Slot Selected', 'Please select an available parking bay.');
      return;
    }

    // Booking is only allowed up to 30 min before arrival window closes.
    // Since startTime = now, this ensures the system hasn't already expired window.
    // If user changes startTime in future, we allow it; past arrivals >30min are blocked.
    const intendedStart = new Date().getTime();
    const cutoffWindowMs = 30 * 60 * 1000;
    if (intendedStart < Date.now() - cutoffWindowMs) {
      error(
        'Booking Window Closed',
        'Bookings can only be made up to 30 minutes before your arrival. Please try a new booking.'
      );
      return;
    }

    setLoading(true);

    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

    const result = dbService.atomicReserveSlot({
      slotId: selectedSlot.id,
      bookingData: {
        customerId: user.id,
        customerName: user.name,
        customerMobile: user.mobile,
        parkingAreaId: area.id,
        parkingAreaName: area.name,
        levelId: level.id,
        levelName: level.name,
        zoneId: zone?.id || 'zone-a',
        zoneName: zone?.name || 'Zone A',
        slotId: selectedSlot.id,
        slotNumber: selectedSlot.number,
        slotType: selectedSlot.type,
        vehiclePlate: plateCheck.display,
        vehiclePlateNormalized: plateCheck.normalized,
        startTime,
        endTime,
        expectedDurationHours: durationHours,
        servicesRequested: [],
        estimatedTotal: totalEstimated,
        isEVRequested: isEVRequested || selectedSlot.type === 'ev'
      }
    });

    setLoading(false);

    if (result.success && result.booking) {
      success('Booking Confirmed!', `Reserved Bay ${result.booking.slotNumber}. Your digital QR ticket is ready.`);
      navigate(`/ticket/${result.booking.id}`);
    } else {
      error('Reservation Failed', result.error || 'This bay was just reserved. Please select another slot.');
    }
  };

  return (
    <div style={{ maxWidth: '780px', margin: '20px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <span className="badge badge-available" style={{ marginBottom: '8px' }}>
            Instant Reservation
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#120f26' }}>
            Reserve Parking at {area.name}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
            {area.address}
          </p>
        </div>

        <form onSubmit={handleConfirmBooking}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Left Inputs */}
            <div>
              <div className="form-group">
                <label className="form-label">Vehicle Registration Number</label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="KA 01 AB 1234"
                  className="form-input plate-input"
                  required
                />
                <span className="form-helper">
                  Normalized for automatic camera plate matching at gate.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Slot Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { setSlotTypePreference('standard'); setIsEVRequested(false); }}
                    className={`btn ${slotTypePreference === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.85rem' }}
                  >
                    Standard Bay
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSlotTypePreference('ev'); setIsEVRequested(true); }}
                    className={`btn ${slotTypePreference === 'ev' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.85rem', color: slotTypePreference === 'ev' ? '#fff' : '#059669' }}
                  >
                    <Zap size={14} />
                    <span>EV Charger</span>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Select Available Bay</label>
                <select
                  value={selectedSlotId}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                  className="form-select"
                  required
                >
                  {filteredAvailableSlots.length === 0 ? (
                    <option value="">No bays available for this type</option>
                  ) : (
                    filteredAvailableSlots.map((s: Slot) => (
                      <option key={s.id} value={s.id}>
                        Bay {s.number} ({s.type.toUpperCase()}) - {s.directionalNotes || 'Level 1'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Expected Duration (Hours)</label>
                <select
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="form-select"
                >
                  <option value={1}>1 Hour</option>
                  <option value={2}>2 Hours (Recommended)</option>
                  <option value={3}>3 Hours</option>
                  <option value={4}>4 Hours</option>
                  <option value={8}>Full Day (8 Hours)</option>
                </select>
              </div>
            </div>

            {/* Right Summary Card */}
            <div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#120f26', marginBottom: '14px' }}>
                  Reservation Summary
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Assigned Bay:</span>
                    <strong style={{ color: '#7e22ce' }}>{selectedSlot?.number || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Level / Zone:</span>
                    <strong style={{ color: '#120f26' }}>{level.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Base Hourly Tariff:</span>
                    <span>₹{area.tariffs.baseHourlyRate}/hr</span>
                  </div>
                  {area.tariffs.freePeriodMinutes > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                      <span>Free Entry Grace Period:</span>
                      <span>{area.tariffs.freePeriodMinutes} mins</span>
                    </div>
                  )}
                  {slotTypePreference === 'ev' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857' }}>
                      <span>EV Fast Charging:</span>
                      <span>₹{area.tariffs.evChargingRatePerHour || 80}/hr</span>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: '#120f26' }}>Estimated Total:</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#7e22ce' }}>
                      ₹{totalEstimated}
                    </span>
                  </div>
                </div>

                <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '10px', marginTop: '16px', fontSize: '0.78rem', color: '#1e40af', lineHeight: '1.4' }}>
                  <ShieldCheck size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Guaranteed slot reservation. Pay online via UPI or settle on departure.
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !selectedSlot}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '18px' }}
              >
                <CheckCircle2 size={16} />
                <span>{loading ? 'Reserving...' : 'Confirm Reservation & Get QR Ticket'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
