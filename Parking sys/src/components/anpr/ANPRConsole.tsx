import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { anprService, type ANPRResult } from '../../services/anprService';
import { visitService } from '../../services/visitService';
import { dbService } from '../../services/dbService';
import { useDbRevision } from '../../hooks/useDbRevision';
import { useToast } from '../../context/ToastContext';
import {
  Camera,
  QrCode,
  Video,
  VideoOff,
  CheckCircle2,
  ScanLine
} from 'lucide-react';
import type { Booking } from '../../types';

interface ANPRConsoleProps {
  parkingAreaId: string;
  onEntrySuccess?: (booking: Booking) => void;
}

export const ANPRConsole: React.FC<ANPRConsoleProps> = ({ parkingAreaId, onEntrySuccess }) => {
  const { success, error, warning, info } = useToast();
  const dbRevision = useDbRevision(); // live updates from other devices

  const [mode, setMode] = useState<'anpr' | 'qr'>('anpr');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);

  const [inputPlate, setInputPlate] = useState<string>('KA 01 AB 1234');
  const [confidence, setConfidence] = useState<number>(96);
  const [anprResult, setAnprResult] = useState<ANPRResult | null>(null);

  const [qrTokenInput, setQrTokenInput] = useState<string>('');
  const [barrierState, setBarrierState] = useState<'closed' | 'opening' | 'opened'>('closed');
  const [activeReservations, setActiveReservations] = useState<Booking[]>([]);

  // QR Camera state (separate from ANPR camera)
  const [isQrCameraActive, setIsQrCameraActive] = useState<boolean>(false);
  const [qrCameraError, setQrCameraError] = useState<string | null>(null);
  const [qrScanStatus, setQrScanStatus] = useState<'idle' | 'scanning' | 'detected'>('idle');


  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const scanLoopRef = useRef<number | null>(null);

  const presets = anprService.getSimulationPresets();

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      info('Camera Active', 'Webcam stream initialized for plate capture.');
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Camera permission not granted or device unavailable. You can use simulated presets below.');
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Start QR Camera — store stream first, attach to video via useEffect after render
  const startQrCamera = async () => {
    setQrCameraError(null);
    setQrScanStatus('idle');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      qrStreamRef.current = stream;
      setIsQrCameraActive(true); // video element renders now
      // srcObject assigned in useEffect below after render
    } catch (err: any) {
      console.warn('QR camera error:', err);
      setQrCameraError('Camera permission denied or unavailable. Enter the ticket token manually below.');
      setQrScanStatus('idle');
    }
  };

  // Attach stream to video element once it becomes available in the DOM
  useEffect(() => {
    if (!isQrCameraActive || !qrVideoRef.current || !qrStreamRef.current) return;
    const video = qrVideoRef.current;
    video.srcObject = qrStreamRef.current;
    video.play().catch(() => { }); // autoplay policy — ignore if already playing

    // --- jsQR scan loop ---
    const canvas = qrCanvasRef.current!;

    const scanFrame = () => {
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(video, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code) {
        const raw = code.data;
        const token = raw.startsWith('TKT-') ? raw : (raw.split('#').pop() || raw);
        if (token.startsWith('TKT-')) {
          setQrScanStatus('detected');
          setQrTokenInput(token);
          stopQrCameraStream();
          return; // stop loop
        }
      }

      scanLoopRef.current = requestAnimationFrame(scanFrame);
    };

    setQrScanStatus('scanning');
    scanLoopRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (scanLoopRef.current !== null) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQrCameraActive]);

  // Internal: stop the camera stream & scan loop without clearing state
  const stopQrCameraStream = () => {
    if (scanLoopRef.current !== null) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((t) => t.stop());
      qrStreamRef.current = null;
    }
    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }
    setIsQrCameraActive(false);
  };

  // Stop QR Camera (user-triggered)
  const stopQrCamera = () => {
    stopQrCameraStream();
    setQrScanStatus('idle');
  };

  useEffect(() => {
    return () => {
      stopCamera();
      stopQrCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload active reservations when switching to QR mode
  useEffect(() => {
    if (mode !== 'qr') return;
    const bookings = dbService.getBookings(undefined, parkingAreaId)
      .filter(b => b.status === 'reserved' || b.status === 'active_inside');
    setActiveReservations(bookings);

    // Also check URL hash for deep-linked QR token (from TicketPage QR code)
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('TKT-')) {
      setQrTokenInput(hash);
    }
  }, [mode, parkingAreaId, dbRevision]);

  // Auto-verify as soon as the scan loop detects a token
  useEffect(() => {
    if (qrScanStatus === 'detected' && qrTokenInput) {
      // Small delay so token state is committed before verify reads it
      const t = setTimeout(() => handleVerifyQRToken(), 80);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrScanStatus, qrTokenInput]);

  // Capture Frame from Camera
  const captureFrame = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedFrame(dataUrl);
      }
    } catch (e) {
      console.warn('Frame capture notice:', e);
    }
  };

  // Process ANPR Recognition
  const handleProcessRecognition = (plateToUse?: string, confToUse?: number) => {
    const targetPlate = plateToUse || inputPlate;
    const targetConf = confToUse !== undefined ? confToUse : confidence;

    captureFrame();

    const result = anprService.processRecognition({
      rawPlate: targetPlate,
      confidence: targetConf,
      parkingAreaId,
      frameDataUrl: capturedFrame || undefined,
      isSimulated: true
    });

    setAnprResult(result);

    if (result.matchStatus === 'matched') {
      success('Plate Matched!', `Found active reservation for bay ${result.matchedBooking?.slotNumber}`);
    } else if (result.matchStatus === 'low_confidence') {
      warning('Low Confidence', 'Plate recognition confidence is below 70% threshold. Verify physically.');
    } else {
      error('No Booking Found', `No active reservation found for vehicle ${targetPlate} at this facility.`);
    }
  };

  // Confirm Entry & Trigger Barrier Event
  const handleConfirmEntry = () => {
    if (!anprResult?.matchedBooking) return;

    const res = anprService.authorizeANPREntry({
      bookingId: anprResult.matchedBooking.id,
      operatorId: 'operator-gate-1'
    });

    if (res.success) {
      // Simulate barrier opening
      setBarrierState('opening');
      setTimeout(() => setBarrierState('opened'), 600);
      setTimeout(() => setBarrierState('closed'), 4000);

      success('Entry Authorized', `Barrier raised! Vehicle entered. Bay ${anprResult.matchedBooking.slotNumber} is now Occupied.`);
      if (onEntrySuccess) onEntrySuccess(anprResult.matchedBooking);
      setAnprResult(null);
    } else {
      error('Entry Failed', res.error || 'Could not validate entry.');
    }
  };

  // QR Scan / Token Verification
  const handleVerifyQRToken = () => {
    if (!qrTokenInput.trim()) {
      error('QR Token Required', 'Please enter or scan a ticket token.');
      return;
    }

    const booking = dbService.getBookingByTicketToken(qrTokenInput.trim());
    if (!booking) {
      error('Invalid Ticket', 'No booking found matching this QR ticket token.');
      return;
    }

    if (booking.parkingAreaId !== parkingAreaId) {
      error('Wrong Facility', `This ticket belongs to another parking facility (${booking.parkingAreaName}).`);
      return;
    }

    const res = visitService.startVisit({
      bookingId: booking.id,
      entryMethod: 'qr_scan',
      operatorId: 'operator-gate-1'
    });

    if (res.success) {
      setBarrierState('opening');
      setTimeout(() => setBarrierState('opened'), 600);
      setTimeout(() => setBarrierState('closed'), 4000);

      success('QR Verified!', `Welcome ${booking.customerName}. Assigned to Bay ${booking.slotNumber}.`);
      if (onEntrySuccess) onEntrySuccess(booking);
      setQrTokenInput('');
    } else {
      error('Verification Failed', res.error);
    }
  };

  return (
    <div className="card" style={{ padding: '24px' }}>
      {/* Mode Selector Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#120f26' }}>
            Gate Entry Verification Console
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Scan customer QR tickets or perform optical plate recognition.
          </p>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-light)' }}>
          <button
            onClick={() => setMode('anpr')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: mode === 'anpr' ? 'var(--primary)' : 'transparent',
              color: mode === 'anpr' ? '#ffffff' : '#64748b'
            }}
          >
            <Camera size={16} />
            <span>CAMERA / ANPR</span>
          </button>
          <button
            onClick={() => setMode('qr')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: mode === 'qr' ? 'var(--primary)' : 'transparent',
              color: mode === 'qr' ? '#ffffff' : '#64748b'
            }}
          >
            <QrCode size={16} />
            <span>QR SCANNER</span>
          </button>
        </div>
      </div>

      {/* Simulated Barrier Event Status Banner */}
      <div
        style={{
          background: barrierState === 'closed' ? '#f8fafc' : '#ecfdf5',
          border: `1.5px solid ${barrierState === 'closed' ? '#e2e8f0' : '#10b981'}`,
          borderRadius: '10px',
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          transition: 'all 0.3s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: barrierState === 'closed' ? '#ef4444' : '#10b981'
            }}
          />
          <div>
            <strong style={{ fontSize: '0.88rem', color: '#120f26' }}>
              Barrier Gate 1 Event: {barrierState === 'closed' ? 'BARRIER LOWERED' : 'BARRIER OPENED (SIMULATED)'}
            </strong>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {barrierState === 'closed'
                ? 'Awaiting trusted backend validation before raising barrier.'
                : 'SIMULATED BARRIER EVENT — Gate raised. Vehicle passing through.'}
            </p>
          </div>
        </div>

        <span className="badge badge-maintenance" style={{ fontSize: '0.72rem' }}>
          DEMO GATE CONTROLLER
        </span>
      </div>

      {/* ANPR Mode View */}
      {mode === 'anpr' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Camera Feed / Preview Box */}
          <div>
            <div
              style={{
                background: '#120f26',
                borderRadius: '12px',
                height: '240px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #334155'
              }}
            >
              {isCameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : capturedFrame ? (
                <img src={capturedFrame} alt="Captured Plate" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>
                  <VideoOff size={36} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                  <p style={{ fontSize: '0.85rem' }}>Camera is currently idle.</p>
                  <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>Click Start Camera or test with simulated presets.</p>
                </div>
              )}

              {/* Scanning Target Reticle Overlay */}
              <div
                style={{
                  position: 'absolute',
                  width: '75%',
                  height: '45%',
                  border: '2px dashed #e879f9',
                  borderRadius: '8px',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ background: 'rgba(0,0,0,0.6)', color: '#e879f9', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px' }}>
                  PLATE DETECTION ZONE
                </span>
              </div>
            </div>

            {/* Camera Controls */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              {!isCameraActive ? (
                <button onClick={startCamera} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                  <Video size={15} />
                  <span>Start Camera</span>
                </button>
              ) : (
                <button onClick={stopCamera} className="btn btn-danger btn-sm" style={{ flex: 1 }}>
                  <VideoOff size={15} />
                  <span>Stop Camera</span>
                </button>
              )}
              <button
                onClick={() => handleProcessRecognition()}
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
              >
                <Camera size={15} />
                <span>Capture & Detect</span>
              </button>
            </div>

            {cameraError && (
              <p style={{ color: '#d97706', fontSize: '0.78rem', marginTop: '8px' }}>
                {cameraError}
              </p>
            )}
          </div>

          {/* Plate Input, Presets & Results */}
          <div>
            <div className="form-group">
              <label className="form-label">Vehicle Registration Plate</label>
              <input
                type="text"
                value={inputPlate}
                onChange={(e) => setInputPlate(e.target.value)}
                className="form-input plate-input"
                placeholder="KA 01 AB 1234"
              />
            </div>

            {/* Quick Simulation Presets */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Hackathon Test Presets:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {presets.map((preset) => (
                  <button
                    key={preset.plate}
                    onClick={() => {
                      setInputPlate(preset.plate);
                      setConfidence(preset.confidence);
                      handleProcessRecognition(preset.plate, preset.confidence);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    title={preset.note}
                  >
                    {preset.plate} ({preset.confidence}%)
                  </button>
                ))}
              </div>
            </div>

            {/* ANPR Result Review Box */}
            {anprResult && (
              <div
                style={{
                  background: anprResult.matchStatus === 'matched' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${anprResult.matchStatus === 'matched' ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '10px',
                  padding: '14px',
                  marginTop: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#120f26' }}>
                    {anprResult.normalizedPlate}
                  </span>
                  <span className={`badge ${anprResult.confidence >= 75 ? 'badge-available' : 'badge-reserved'}`}>
                    Confidence: {anprResult.confidence}%
                  </span>
                </div>

                {anprResult.matchedBooking ? (
                  <div style={{ marginTop: '10px', fontSize: '0.85rem' }}>
                    <div style={{ color: '#166534', fontWeight: 600 }}>
                      Active Reservation Matched: #{anprResult.matchedBooking.bookingNumber}
                    </div>
                    <div style={{ color: '#475569', marginTop: '4px' }}>
                      Driver: {anprResult.matchedBooking.customerName} • Assigned Bay: <strong style={{ color: '#7e22ce' }}>{anprResult.matchedBooking.slotNumber}</strong>
                    </div>

                    <button
                      onClick={handleConfirmEntry}
                      className="btn btn-success btn-sm"
                      style={{ width: '100%', marginTop: '12px' }}
                    >
                      <CheckCircle2 size={16} />
                      <span>Confirm Entry & Raise Barrier</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#991b1b' }}>
                    {anprResult.matchStatus === 'low_confidence'
                      ? 'Plate unreadable or confidence too low. Manual verification required.'
                      : 'No active reservation matches this registration number.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Mode View */}
      {mode === 'qr' && (
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>

          {/* ── Live Camera QR Scanner Preview ── always in DOM when mode=qr */}
          {/* Video & canvas always rendered so refs are stable */}
          <canvas ref={qrCanvasRef} style={{ display: 'none' }} />
          <video
            ref={qrVideoRef}
            autoPlay
            playsInline
            muted
            style={{ display: 'none' }}   /* shown via the card below */
          />

          <div style={{ display: isQrCameraActive ? 'block' : 'none', marginBottom: '16px' }}>
            <div style={{
              position: 'relative',
              background: '#000',
              borderRadius: '12px',
              overflow: 'hidden',
              border: `2px solid ${qrScanStatus === 'detected' ? '#10b981' : '#e879f9'}`,
              boxShadow: qrScanStatus === 'detected'
                ? '0 0 20px rgba(16,185,129,0.5)'
                : '0 0 12px rgba(232, 121, 249, 0.25) ',
              transition: 'border-color 0.3s, box-shadow 0.3s'
            }}>
              {/* Mirror the live feed visually — CSS trick: show same video feed */}
              <video
                autoPlay
                playsInline
                muted
                ref={(el) => {
                  // Keep the display video in sync with the scan video stream
                  if (el && qrStreamRef.current) {
                    el.srcObject = qrStreamRef.current;
                  }
                }}
                style={{ width: '100%', display: 'block', minHeight: '260px', maxHeight: '320px', objectFit: 'cover' }}
              />

              {/* Animated corner-bracket reticle */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{ position: 'relative', width: '180px', height: '180px' }}>
                  {/* Four corners */}
                  {([
                    { top: 0, left: 0, borderTop: '3px solid', borderLeft: '3px solid', borderRadius: '4px 0 0 0' },
                    { top: 0, right: 0, borderTop: '3px solid', borderRight: '3px solid', borderRadius: '0 4px 0 0' },
                    { bottom: 0, left: 0, borderBottom: '3px solid', borderLeft: '3px solid', borderRadius: '0 0 0 4px' },
                    { bottom: 0, right: 0, borderBottom: '3px solid', borderRight: '3px solid', borderRadius: '0 0 4px 0' },
                  ] as React.CSSProperties[]).map((s, i) => (
                    <div key={i} style={{
                      position: 'absolute', width: '28px', height: '28px',
                      borderColor: qrScanStatus === 'detected' ? '#10b981' : '#e879f9',
                      ...s
                    }} />
                  ))}

                  {/* Animated scan line */}
                  <div style={{
                    position: 'absolute', left: '4px', right: '4px', height: '2px',
                    background: qrScanStatus === 'detected' ? '#10b981' : '#e879f9',
                    animation: 'qrScanPulse 1.6s ease-in-out infinite',
                    opacity: 0.85,
                    borderRadius: '1px'
                  }} />
                </div>
              </div>

              {/* Status badge */}
              <div style={{
                position: 'absolute', bottom: '10px', left: 0, right: 0,
                display: 'flex', justifyContent: 'center'
              }}>
                <span style={{
                  background: qrScanStatus === 'detected' ? 'rgba(16,185,129,0.9)' : 'rgba(0,0,0,0.75)',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '4px 14px',
                  borderRadius: '20px',
                  letterSpacing: '0.06em',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  {qrScanStatus === 'detected' ? (
                    <><CheckCircle2 size={13} /> QR DETECTED — VERIFYING...</>
                  ) : (
                    <><ScanLine size={13} /> LIVE SCANNING — HOLD QR CODE STEADY</>
                  )}
                </span>
              </div>
            </div>

            {/* Stop button */}
            <button onClick={stopQrCamera} className="btn btn-danger btn-sm" style={{ width: '100%', marginTop: '8px' }}>
              <VideoOff size={15} />
              <span>Stop Camera</span>
            </button>
          </div>


          {qrCameraError && (
            <p style={{ color: '#d97706', fontSize: '0.78rem', marginBottom: '10px' }}>{qrCameraError}</p>
          )}

          <div className="form-group">
            <label className="form-label">Ticket Token or QR String</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={qrTokenInput}
                onChange={(e) => setQrTokenInput(e.target.value)}
                className="form-input"
                placeholder="e.g. TKT-DEMO-98234-A101-SEC"
                style={{ flex: 1 }}
              />
              {!isQrCameraActive && (
                <button
                  onClick={startQrCamera}
                  className="btn btn-secondary"
                  title="Scan QR with camera"
                  style={{ flexShrink: 0, padding: '0 14px' }}
                >
                  <Camera size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Active Reservations Quick-Select (gate agent can tap customer name) */}
          {activeReservations.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                Active Reservations at This Gate ({activeReservations.length}):
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                {activeReservations.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setQrTokenInput(b.ticketToken)}
                    className="btn btn-secondary btn-sm"
                    style={{ justifyContent: 'flex-start', fontSize: '0.78rem', textAlign: 'left' }}
                    title={`Token: ${b.ticketToken}`}
                  >
                    <QrCode size={12} style={{ flexShrink: 0 }} />
                    <span><strong>{b.vehiclePlate}</strong> — {b.customerName} — Bay {b.slotNumber}</span>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                ↑ Click a row or have the customer show their QR from the Ticket page
              </p>
            </div>
          )}

          <button onClick={handleVerifyQRToken} className="btn btn-primary" style={{ width: '100%' }}>
            <QrCode size={18} />
            <span>Verify Ticket & Authorize Entry</span>
          </button>
        </div>
      )}
    </div>
  );
};
