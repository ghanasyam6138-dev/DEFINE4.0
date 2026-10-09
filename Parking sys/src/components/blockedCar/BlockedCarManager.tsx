import React, { useState } from 'react';
import type { IncidentStage } from '../../types';
import { blockedCarService } from '../../services/blockedCarService';
import { dbService } from '../../services/dbService';
import { useDbRevision } from '../../hooks/useDbRevision';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  AlertTriangle,
  Send,
  PhoneCall,
  MessageSquare,
  Users,
  CheckCircle2,
  ArrowRight,
  Zap,
  Play
} from 'lucide-react';

interface BlockedCarManagerProps {
  initialParkingAreaId?: string;
  initialSlotNumber?: string;
}

export const BlockedCarManager: React.FC<BlockedCarManagerProps> = ({
  initialParkingAreaId,
  initialSlotNumber
}) => {
  const { user } = useAuth();
  const { success, error, warning, info } = useToast();
  useDbRevision(); // live updates from other devices

  const parkingAreas = dbService.getParkingAreas(true);
  const [selectedAreaId, setSelectedAreaId] = useState<string>(
    initialParkingAreaId || parkingAreas[0]?.id || ''
  );
  const [slotNumber, setSlotNumber] = useState<string>(initialSlotNumber || 'A-102');
  const [blockingPlate, setBlockingPlate] = useState<string>('MH 12 CD 5678');
  const [description, setDescription] = useState<string>('Vehicle parked across the lane blocking driver access');

  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(() => {
    const list = dbService.getIncidents(selectedAreaId);
    return list[0]?.id || null;
  });

  const activeIncident = activeIncidentId ? dbService.getIncidentById(activeIncidentId) : null;

  // Submit New Report
  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();

    const res = blockedCarService.reportBlockedCar({
      parkingAreaId: selectedAreaId,
      slotNumber: slotNumber.trim().toUpperCase(),
      blockingPlate: blockingPlate.trim(),
      reportedByCustomerId: user?.id || 'guest-reporter',
      reportedByCustomerMobile: user?.mobile || '+919876543214',
      description
    });

    if (res.success && res.incident) {
      setActiveIncidentId(res.incident.id);
      success('Incident Created', `Report registered for vehicle ${res.incident.blockingPlate}. Stage 1 Push sent.`);
    } else {
      error('Report Failed', res.error || 'Could not register incident.');
    }
  };

  // Advance Escalation
  const handleAdvanceStage = () => {
    if (!activeIncidentId) return;
    const res = blockedCarService.advanceEscalation(activeIncidentId);
    if (res.success && res.incident) {
      info('Escalation Advanced', `Transitioned to ${res.incident.currentStage.replace(/_/g, ' ')}`);
    } else {
      warning('Cannot Advance', 'Incident is already acknowledged or resolved.');
    }
  };

  // Demo: Directly jump to stage
  const handleJumpStage = (stage: IncidentStage) => {
    if (!activeIncidentId) return;
    const res = blockedCarService.jumpToStage(activeIncidentId, stage);
    if (res.success && res.incident) {
      success('Stage Escalated (Demo)', `Jumped directly to ${stage.replace(/_/g, ' ').toUpperCase()}`);
    } else {
      error('Escalation Error', res.error || 'Failed to update stage');
    }
  };

  // Demo: Seed sample incident
  const handleSeedSampleIncident = () => {
    const inc = blockedCarService.seedDemoIncident(selectedAreaId, slotNumber);
    setActiveIncidentId(inc.id);
    success('Demo Incident Seeded', `Sample blocked vehicle reported at Bay ${slotNumber}. Incident #${inc.incidentNumber}`);
  };

  // Demo: Automated full cycle
  const [isRunningAutoDemo, setIsRunningAutoDemo] = useState(false);
  const handleAutoEscalateDemo = async () => {
    let incId = activeIncidentId;
    if (!incId) {
      const inc = blockedCarService.seedDemoIncident(selectedAreaId, slotNumber);
      incId = inc.id;
      setActiveIncidentId(inc.id);
    }
    setIsRunningAutoDemo(true);
    info('Auto Escalation Demo', 'Starting automated sequential escalation demo...');

    try {
      // Stage 1
      blockedCarService.jumpToStage(incId, 'push_notified');
      await new Promise(r => setTimeout(r, 900));

      // Stage 2
      blockedCarService.jumpToStage(incId, 'sms_sent');
      await new Promise(r => setTimeout(r, 900));

      // Stage 3
      blockedCarService.jumpToStage(incId, 'voice_call_initiated');
      await new Promise(r => setTimeout(r, 900));

      // Stage 4
      blockedCarService.jumpToStage(incId, 'staff_dispatched');
      success('Escalation Completed', 'Automated demo reached Stage 4: Staff marshall dispatched.');
    } finally {
      setIsRunningAutoDemo(false);
    }
  };

  // Driver Simulated Action
  const handleDriverAction = (action: 'moving_now' | 'need_5_mins' | 'not_my_vehicle') => {
    if (!activeIncidentId) return;
    const res = blockedCarService.driverRespond({
      incidentId: activeIncidentId,
      response: action
    });

    if (res.success) {
      success('Driver Acknowledged', `Response recorded: "${action.replace(/_/g, ' ')}". Escalation paused.`);
    } else {
      error('Action Failed', res.error);
    }
  };

  // Staff / Admin Resolution
  const handleResolve = (resolution: 'driver_moved' | 'staff_cleared' | 'false_alarm') => {
    if (!activeIncidentId) return;
    const res = blockedCarService.resolveIncident({
      incidentId: activeIncidentId,
      resolution,
      actorId: user?.id || 'staff-hero',
      actorName: user?.name || 'On-Duty Attendant',
      notes: 'Inspected on-site and clear to park.'
    });

    if (res.success) {
      success('Incident Resolved', `Marked as ${resolution}.`);
    }
  };

  const getStageStep = (stage: IncidentStage) => {
    switch (stage) {
      case 'initial_search': return 1;
      case 'push_notified': return 1;
      case 'sms_sent': return 2;
      case 'voice_call_initiated': return 3;
      case 'staff_dispatched': return 4;
      case 'acknowledged': return 3;
      case 'resolved': return 5;
      default: return 1;
    }
  };

  const currentStep = activeIncident ? getStageStep(activeIncident.currentStage) : 1;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
      {/* Left: Report Form */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#120f26' }}>
              Report a Blocked Vehicle
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Triggers automated 4-stage driver notification & staff dispatch
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmitReport}>
          <div className="form-group">
            <label className="form-label">Parking Facility</label>
            <select
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
              className="form-select"
            >
              {parkingAreas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Blocked Bay / Location</label>
            <input
              type="text"
              value={slotNumber}
              onChange={(e) => setSlotNumber(e.target.value)}
              className="form-input"
              placeholder="e.g. A-102"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Blocking Vehicle License Plate</label>
            <input
              type="text"
              value={blockingPlate}
              onChange={(e) => setBlockingPlate(e.target.value)}
              className="form-input plate-input"
              placeholder="MH 12 CD 5678"
              required
            />
            <span className="form-helper">
              Normalized on server. Searches active facility bookings.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Situation Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
              rows={2}
              placeholder="e.g. Car is parked too close to driver side door..."
            />
          </div>

          <button type="submit" className="btn btn-danger" style={{ width: '100%' }}>
            <Send size={16} />
            <span>Submit Report & Start Escalation</span>
          </button>
        </form>
      </div>

      {/* Right: Active Incident Escalation Engine */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#120f26' }}>
              Automated Staged Escalation
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Incident: {activeIncident ? `#${activeIncident.incidentNumber}` : 'No active incident'}
            </span>
          </div>

          {activeIncident && (
            <span className={`badge ${activeIncident.currentStage === 'resolved' ? 'badge-available' : 'badge-reserved'}`}>
              Stage: {activeIncident.currentStage.replace(/_/g, ' ').toUpperCase()}
            </span>
          )}
        </div>

        {activeIncident ? (
          <div>
            {/* 4-Stage Visual Progress Rail */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', margin: '16px 0 24px' }}>
              <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: '8px', background: currentStep >= 1 ? '#eff6ff' : '#f8fafc', border: `1px solid ${currentStep >= 1 ? '#9333ea' : '#e2e8f0'}` }}>
                <Send size={18} style={{ color: currentStep >= 1 ? '#7e22ce' : '#94a3b8', margin: '0 auto 4px' }} />
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#120f26' }}>Stage 1</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>App Push (30s)</div>
              </div>

              <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: '8px', background: currentStep >= 2 ? '#eff6ff' : '#f8fafc', border: `1px solid ${currentStep >= 2 ? '#9333ea' : '#e2e8f0'}` }}>
                <MessageSquare size={18} style={{ color: currentStep >= 2 ? '#7e22ce' : '#94a3b8', margin: '0 auto 4px' }} />
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#120f26' }}>Stage 2</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>SMS Action Link</div>
              </div>

              <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: '8px', background: currentStep >= 3 ? '#eff6ff' : '#f8fafc', border: `1px solid ${currentStep >= 3 ? '#9333ea' : '#e2e8f0'}` }}>
                <PhoneCall size={18} style={{ color: currentStep >= 3 ? '#7e22ce' : '#94a3b8', margin: '0 auto 4px' }} />
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#120f26' }}>Stage 3</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Masked Call</div>
              </div>

              <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: '8px', background: currentStep >= 4 ? '#fee2e2' : '#f8fafc', border: `1px solid ${currentStep >= 4 ? '#ef4444' : '#e2e8f0'}` }}>
                <Users size={18} style={{ color: currentStep >= 4 ? '#dc2626' : '#94a3b8', margin: '0 auto 4px' }} />
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#120f26' }}>Stage 4</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Staff Dispatch</div>
              </div>
            </div>

            {/* Test Simulation Controls */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.82rem', color: '#120f26', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} style={{ color: '#f59e0b' }} /> Evaluation Escalation Controls (Demo)
                </strong>
                <button
                  onClick={handleAutoEscalateDemo}
                  disabled={isRunningAutoDemo || activeIncident.currentStage === 'resolved'}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  <Play size={12} />
                  <span>{isRunningAutoDemo ? 'Escalating...' : 'Auto-Run All Stages'}</span>
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', marginBottom: '10px' }}>
                Step through stages or jump immediately for evaluator demonstrations:
              </p>

              {/* Direct Stage Jump Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <button
                  onClick={handleAdvanceStage}
                  disabled={activeIncident.currentStage === 'resolved'}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem' }}
                >
                  <ArrowRight size={13} />
                  <span>+1 Stage</span>
                </button>
                <button
                  onClick={() => handleJumpStage('push_notified')}
                  disabled={activeIncident.currentStage === 'resolved'}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem' }}
                >
                  Stage 1: Push
                </button>
                <button
                  onClick={() => handleJumpStage('sms_sent')}
                  disabled={activeIncident.currentStage === 'resolved'}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem' }}
                >
                  Stage 2: SMS
                </button>
                <button
                  onClick={() => handleJumpStage('voice_call_initiated')}
                  disabled={activeIncident.currentStage === 'resolved'}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem' }}
                >
                  Stage 3: Voice
                </button>
                <button
                  onClick={() => handleJumpStage('staff_dispatched')}
                  disabled={activeIncident.currentStage === 'resolved'}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', color: '#dc2626', borderColor: '#fca5a5' }}
                >
                  Stage 4: Dispatch
                </button>
              </div>

              {/* Driver Response Test Buttons */}
              <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
                  Simulate Driver Response:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <button
                    onClick={() => handleDriverAction('moving_now')}
                    disabled={activeIncident.currentStage === 'resolved'}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '0.75rem' }}
                  >
                    "I'm moving now"
                  </button>
                  <button
                    onClick={() => handleDriverAction('need_5_mins')}
                    disabled={activeIncident.currentStage === 'resolved' || activeIncident.gracePeriodUsed}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', color: '#d97706' }}
                  >
                    "Need 5 minutes"
                  </button>
                  <button
                    onClick={() => handleDriverAction('not_my_vehicle')}
                    disabled={activeIncident.currentStage === 'resolved'}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', color: '#dc2626' }}
                  >
                    "Not my vehicle"
                  </button>
                </div>
              </div>
            </div>

            {/* Resolution Buttons */}
            {activeIncident.currentStage !== 'resolved' && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                <button onClick={() => handleResolve('driver_moved')} className="btn btn-success btn-sm" style={{ flex: 1 }}>
                  <CheckCircle2 size={15} />
                  <span>Mark Driver Moved</span>
                </button>
                <button onClick={() => handleResolve('staff_cleared')} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                  <span>Staff Verified Cleared</span>
                </button>
              </div>
            )}

            {/* Append-Only Audit Trail Log */}
            <div>
              <strong style={{ fontSize: '0.82rem', color: '#120f26' }}>Incident Audit Log:</strong>
              <div style={{ maxHeight: '160px', overflowY: 'auto', background: '#120f26', borderRadius: '8px', padding: '10px', marginTop: '6px', fontSize: '0.75rem', color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>
                {activeIncident.auditTrail.map((log, idx) => (
                  <div key={idx} style={{ marginBottom: '6px', borderBottom: '1px solid #1c1338', paddingBottom: '4px' }}>
                    <span style={{ color: '#e879f9' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                    <strong style={{ color: '#fde68a' }}>{log.action}</strong>: {log.details}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            <AlertTriangle size={32} style={{ margin: '0 auto 10px', color: '#f59e0b', opacity: 0.8 }} />
            <p style={{ fontWeight: 600, color: '#334155' }}>No active blocked car incident selected.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px', marginBottom: '16px' }}>
              Submit a report on the left or seed an incident instantly for evaluation:
            </p>
            <button onClick={handleSeedSampleIncident} className="btn btn-primary btn-sm">
              <Zap size={14} />
              <span>⚡ Quick Demo: Seed Blocked Car Incident</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
