import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { dbService } from '../services/dbService';
import { visitService } from '../services/visitService';
import { useDbRevision } from '../hooks/useDbRevision';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import type { Visit, RequestedService } from '../types';
import {
  CreditCard,
  CheckCircle2
} from 'lucide-react';

export const PaymentPage: React.FC = () => {
  const { visitId } = useParams<{ visitId: string }>();
  const { success, error } = useToast();
  const { isCustomer, isApprovedStaff, isAdmin } = useAuth();

  const [method, setMethod] = useState<'UPI' | 'Card' | 'Fastag'>('UPI');
  const [upiVpa, setUpiVpa] = useState<string>('customer@okaxis');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [exitPassQrUrl, setExitPassQrUrl] = useState<string>('');

  // Live: re-renders when this visit changes on any device.
  useDbRevision();
  const visit: Visit | null = visitId ? (dbService.getVisitById(visitId) ?? null) : null;

  const exitPassToken = visit?.exitPass?.passToken;
  useEffect(() => {
    if (!exitPassToken) return;
    QRCode.toDataURL(exitPassToken, { width: 220, margin: 2 })
      .then((url) => setExitPassQrUrl(url))
      .catch((err) => console.error(err));
  }, [exitPassToken]);

  if (!visit) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2>Visit Record Not Found</h2>
        {isCustomer ? (
          <Link to="/customer" className="btn btn-primary" style={{ marginTop: '16px' }}>
            Back to Customer Hub
          </Link>
        ) : isAdmin ? (
          <Link to="/admin" className="btn btn-primary" style={{ marginTop: '16px' }}>
            Back to Admin Console
          </Link>
        ) : isApprovedStaff ? (
          <Link to="/staff" className="btn btn-primary" style={{ marginTop: '16px' }}>
            Back to Staff Console
          </Link>
        ) : (
          <Link to="/" className="btn btn-primary" style={{ marginTop: '16px' }}>
            Back to Facilities
          </Link>
        )}
      </div>
    );
  }

  const booking = dbService.getBookingById(visit.bookingId);
  const isEV = booking?.slotType === 'ev' || booking?.isEVRequested;
  const servicesTotal = visit.services.reduce((acc: number, s: RequestedService) => acc + (s.status !== 'cancelled' ? s.price : 0), 0);

  const feeBreakdown = visitService.calculateFee({
    entryTimestamp: visit.entryTimestamp,
    tariff: visit.tariffSnapshot,
    isEVCharging: isEV,
    servicesTotal
  });

  const handleProcessPayment = () => {
    setIsProcessing(true);

    // Simulate safe server-side payment processing
    setTimeout(() => {
      const res = visitService.processPaymentAndIssueExitPass({
        visitId: visit.id,
        method,
        isSimulated: true,
        upiVpa
      });

      setIsProcessing(false);

      if (res.success && res.visit && res.exitPass) {
        QRCode.toDataURL(res.exitPass.passToken, { width: 220, margin: 2 })
          .then((url) => setExitPassQrUrl(url));
        success('Payment Successful (SIMULATED)', 'Your 20-minute digital Exit Pass is generated.');
      } else {
        error('Payment Failed', res.error || 'Could not process transaction.');
      }
    }, 1000);
  };

  const handleCompleteExitNow = () => {
    if (!visit || !visit.exitPass) return;
    const res = visitService.completeExit({
      passTokenOrPlate: visit.exitPass.passToken,
      exitMethod: 'qr_scan',
      parkingAreaId: visit.parkingAreaId
    });

    if (res.success && res.visit) {
      success('Exit Barrier Raised!', `Vehicle ${res.visit.vehiclePlate} exit confirmed. Bay ${res.visit.slotNumber} is now released.`);
    } else {
      error('Exit Processing Failed', res.error || 'Could not validate exit pass.');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: '32px' }}>
        {/* Banner */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef3c7', color: '#b45309', padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '10px' }}>
            {visit.status === 'completed' ? 'VISIT COMPLETED' : 'SIMULATED PAYMENT GATEWAY'}
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#120f26' }}>
            {visit.status === 'completed' ? 'Departure Confirmed' : 'Checkout & Exit Pass'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '2px' }}>
            {visit.parkingAreaName} • Bay {visit.slotNumber}
          </p>
        </div>

        {/* If Visit Completed */}
        {visit.status === 'completed' ? (
          <div style={{ textAlign: 'center', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <CheckCircle2 size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534' }}>
              Barrier Opened • Visit Completed
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#15803d', marginTop: '6px' }}>
              Exit pass verified. Vehicle <strong>{visit.vehiclePlate}</strong> has left the facility. Bay <strong>{visit.slotNumber}</strong> has been released to Available.
            </p>
            <div style={{ marginTop: '20px' }}>
              {isCustomer ? (
                <Link to="/customer" className="btn btn-primary btn-sm">
                  Return to Customer Hub
                </Link>
              ) : isAdmin ? (
                <Link to="/admin" className="btn btn-primary btn-sm">
                  Return to Admin Console
                </Link>
              ) : isApprovedStaff ? (
                <Link to="/staff" className="btn btn-primary btn-sm">
                  Return to Staff Console
                </Link>
              ) : (
                <Link to="/" className="btn btn-primary btn-sm">
                  Return to Facilities
                </Link>
              )}
            </div>
          </div>
        ) : visit.exitPass ? (
          /* If Exit Pass Active (Not Yet Completed) */
          <div style={{ textAlign: 'center', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <CheckCircle2 size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534' }}>
              Exit Pass Active
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#15803d', marginTop: '4px' }}>
              Valid until {new Date(visit.exitPass.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (20-minute grace window)
            </p>

            {exitPassQrUrl && (
              <div style={{ margin: '16px auto', display: 'inline-block', background: 'white', padding: '10px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <img src={exitPassQrUrl} alt="Exit Pass QR" style={{ width: '180px', height: '180px', display: 'block' }} />
              </div>
            )}

            <div style={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'var(--font-mono)' }}>
              PASS TOKEN: {visit.exitPass.passToken}
            </div>

            {/* Pay Early and Leave Trigger Button */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #bbf7d0', paddingTop: '16px' }}>
              <button
                onClick={handleCompleteExitNow}
                className="btn btn-success"
                style={{ width: '100%', padding: '12px', fontSize: '0.95rem', background: '#16a34a', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)' }}
              >
                <CheckCircle2 size={18} />
                <span>🚗 Open Barrier & Leave Facility Now</span>
              </button>
              <p style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '6px' }}>
                Simulates gate barrier opening: consumes exit pass, raises exit boom, and releases Bay {visit.slotNumber}.
              </p>
            </div>

            <div style={{ marginTop: '16px' }}>
              {isCustomer ? (
                <Link to="/customer" className="btn btn-secondary btn-sm">
                  Return to Customer Hub
                </Link>
              ) : (
                <Link to="/" className="btn btn-secondary btn-sm">
                  Return to Facilities
                </Link>
              )}
            </div>
          </div>
        ) : null}

        {/* Itemized Bill Breakdown */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#120f26', marginBottom: '14px' }}>
            Itemized Bill Breakdown
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>
                Parking Fee ({feeBreakdown.durationMinutes} mins • {feeBreakdown.billableHours} hrs):
              </span>
              <strong style={{ color: '#120f26' }}>₹{feeBreakdown.parkingFee}</strong>
            </div>

            {feeBreakdown.evChargingFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                <span>EV Fast Charging Fee:</span>
                <strong>₹{feeBreakdown.evChargingFee}</strong>
              </div>
            )}

            {visit.services.map((srv: RequestedService, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>{srv.serviceName}:</span>
                <strong>₹{srv.price}</strong>
              </div>
            ))}

            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '12px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#120f26' }}>Total Due:</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7e22ce' }}>
                ₹{feeBreakdown.totalAmount}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        {!visit.exitPass && (
          <div>
            <div className="form-group">
              <label className="form-label">Payment Option</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setMethod('UPI')}
                  className={`btn ${method === 'UPI' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.85rem' }}
                >
                  UPI (GPay / PhonePe)
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('Card')}
                  className={`btn ${method === 'Card' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.85rem' }}
                >
                  Credit / Debit Card
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('Fastag')}
                  className={`btn ${method === 'Fastag' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.85rem' }}
                >
                  FASTag Auto-Debit
                </button>
              </div>
            </div>

            {method === 'UPI' && (
              <div className="form-group">
                <label className="form-label">UPI VPA Handle</label>
                <input
                  type="text"
                  value={upiVpa}
                  onChange={(e) => setUpiVpa(e.target.value)}
                  className="form-input"
                  placeholder="username@okhdfcbank"
                />
              </div>
            )}

            <button
              onClick={handleProcessPayment}
              disabled={isProcessing}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '12px' }}
            >
              <CreditCard size={17} />
              <span>
                {isProcessing ? 'Processing Transaction...' : `Pay ₹${feeBreakdown.totalAmount} (Simulated)`}
              </span>
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: '12px' }}>
              Safe Sandbox Environment • No real money is transferred.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
