import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/dbService';
import { useDbRevision } from '../hooks/useDbRevision';
import { authService } from '../services/authService';
import { useToast } from '../context/ToastContext';
import { ParkSmartWalkthrough } from '../components/walkthrough/ParkSmartWalkthrough';
import type { ParkingArea, User, Slot } from '../types';
import {
  Layers,
  CheckCircle2,
  XCircle,
  Plus,
  Eye,
  ArrowRight,
  Trash2,
  AlertTriangle,
  MapPin
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user, isPlatformAdmin } = useAuth();
  const { success, error, info } = useToast();

  const [facilities, setFacilities] = useState<ParkingArea[]>([]);
  const [pendingStaffUsers, setPendingStaffUsers] = useState<User[]>([]);
  const [activeStaffUsers, setActiveStaffUsers] = useState<User[]>([]);
  const [assignedStaffIdMap, setAssignedStaffIdMap] = useState<Record<string, string>>({});
  const [staffAreaAssignMap, setStaffAreaAssignMap] = useState<Record<string, string>>({});
  const [facilityToDelete, setFacilityToDelete] = useState<ParkingArea | null>(null);

  const handleConfirmDeleteFacility = () => {
    if (!facilityToDelete) return;
    const facName = facilityToDelete.name;
    const ok = dbService.deleteParkingArea(facilityToDelete.id);
    if (ok) {
      success('Facility Deleted', `Facility "${facName}" and all associated layouts were deleted.`);
      refreshAdminData();
    } else {
      error('Deletion Failed', 'Unable to delete facility.');
    }
    setFacilityToDelete(null);
  };

  const refreshAdminData = () => {
    // If platform admin, view all facilities; else view managed facility
    const all = dbService.getParkingAreas(true, isPlatformAdmin ? undefined : user?.id);
    setFacilities(all);

    const allUsers = dbService.getUsers();
    const pendingStaff = allUsers.filter((u: User) => u.role === 'staff' && u.status === 'pending_approval');
    const activeStaff = allUsers.filter((u: User) => u.role === 'staff' && u.status === 'active');
    setPendingStaffUsers(pendingStaff);
    setActiveStaffUsers(activeStaff);

    // Initialize suggested Staff IDs for pending
    const idMap: Record<string, string> = {};
    pendingStaff.forEach((u: User) => {
      idMap[u.id] = `STF-${Math.floor(100 + Math.random() * 900)}`;
    });
    setAssignedStaffIdMap(idMap);

    // Initialize area assignment map for active staff
    const areaMap: Record<string, string> = {};
    activeStaff.forEach((u: User) => {
      areaMap[u.id] = u.assignedParkingAreaId || (all[0]?.id || '');
    });
    // Also include pending for pre-assignment
    pendingStaff.forEach((u: User) => {
      if (!areaMap[u.id]) areaMap[u.id] = u.assignedParkingAreaId || (all[0]?.id || '');
    });
    setStaffAreaAssignMap(areaMap);
  };

  const dbRevision = useDbRevision();
  useEffect(() => {
    refreshAdminData();
  }, [user, dbRevision]);

  // Admin approves staff request
  const handleApproveStaff = (applicant: User) => {
    if (!user) return;
    const staffId = assignedStaffIdMap[applicant.id] || `STF-201`;
    const areaId = staffAreaAssignMap[applicant.id] || applicant.assignedParkingAreaId;

    const res = authService.approveStaffRequest({
      adminId: user.id,
      adminName: user.name,
      targetUserId: applicant.id,
      assignedStaffId: staffId,
      assignedParkingAreaId: areaId,
      notes: 'Approved via Administrator Console'
    });

    if (res.success) {
      success('Staff Approved!', `Approved ${applicant.name} with unique Staff ID: ${staffId}`);
    } else {
      error('Approval Failed', res.error);
    }
  };

  // Admin assigns active staff to a parking lot
  const handleAssignStaffLot = (staffUser: User) => {
    const areaId = staffAreaAssignMap[staffUser.id];
    if (!areaId) { error('Select Lot', 'Please select a parking facility first.'); return; }
    const res = dbService.assignStaffToArea(staffUser.id, areaId);
    if (res.success) {
      const areaName = facilities.find(f => f.id === areaId)?.name || areaId;
      success('Lot Assigned', `${staffUser.name} is now assigned to ${areaName}.`);
    } else {
      error('Assignment Failed', res.error || 'Could not assign staff to lot.');
    }
  };

  // Admin rejects staff request
  const handleRejectStaff = (applicant: User) => {
    if (!user) return;
    const res = authService.rejectStaffRequest({
      adminId: user.id,
      adminName: user.name,
      targetUserId: applicant.id,
      reason: 'Application rejected by administration'
    });

    if (res.success) {
      info('Staff Rejected', `Access request for ${applicant.name} has been rejected.`);
    } else {
      error('Rejection Failed', res.error);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Admin Header */}
      <div className="page-header" style={{ marginBottom: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-parking_admin">ADMINISTRATION CONSOLE</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {isPlatformAdmin ? 'Platform-wide Governance' : 'Facility Management'}
            </span>
          </div>
          <h1 className="page-title">Parking Facility & Access Administration</h1>
          <p className="page-desc">
            Manage multi-tier venues, publish layout changes, and review pending staff access requests.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/admin/operations" className="btn btn-secondary">
            <span>View Live Operations</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* Facilities Management Grid */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#120f26' }}>
              Managed Facilities ({facilities.length})
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Create layout designs, edit slots, and toggle public visibility.
            </p>
          </div>

          <Link to="/" className="btn btn-primary btn-sm">
            <Plus size={15} />
            <span>Create New Venue</span>
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {facilities.map((fac) => {
            const slots = dbService.getSlots(fac.id);
            const total = slots.length;
            const available = slots.filter((s: Slot) => s.status === 'available').length;
            const ev = slots.filter((s: Slot) => s.type === 'ev').length;

            return (
              <div
                key={fac.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span className={`badge ${fac.isPublished ? 'badge-available' : 'badge-maintenance'}`}>
                      {fac.isPublished ? 'PUBLISHED LIVE' : 'PRIVATE DRAFT'}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {fac.levels.length} Level(s)
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#120f26' }}>
                    {fac.name}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                    {fac.address}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', margin: '14px 0', background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Capacity</span>
                      <div style={{ fontSize: '1rem', fontWeight: 800 }}>{total}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#059669' }}>Free</span>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>{available}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#7e22ce' }}>EV Bays</span>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#7e22ce' }}>{ev}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <Link
                    to={`/builder/${fac.id}`}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                  >
                    <Layers size={14} />
                    <span>Visual Builder</span>
                  </Link>
                  <Link
                    to={`/parking/${fac.id}`}
                    className="btn btn-secondary btn-sm"
                  >
                    <Eye size={14} />
                    <span>Preview</span>
                  </Link>
                  <button
                    onClick={() => setFacilityToDelete(fac)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#ef4444' }}
                    title="Delete Facility Layout"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Staff Access Approval Queue (Section B) */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#120f26' }}>
              Pending Staff Access Requests ({pendingStaffUsers.length})
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Review applicants, assign unique Staff IDs, and authorize operational privileges.
            </p>
          </div>
        </div>

        {pendingStaffUsers.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingStaffUsers.map((applicant) => (
              <div
                key={applicant.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #fde68a',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '1rem', color: '#120f26' }}>{applicant.name}</strong>
                    <span className="badge badge-reserved">Pending Review</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px' }}>
                    Registered Mobile: <strong>{applicant.mobile}</strong> • Applied: {new Date(applicant.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Staff ID:</label>
                    <input
                      type="text"
                      value={assignedStaffIdMap[applicant.id] || ''}
                      onChange={(e) =>
                        setAssignedStaffIdMap({ ...assignedStaffIdMap, [applicant.id]: e.target.value })
                      }
                      className="form-input"
                      style={{ width: '100px', padding: '6px 10px', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Assign Lot:</label>
                    <select
                      value={staffAreaAssignMap[applicant.id] || ''}
                      onChange={(e) => setStaffAreaAssignMap({ ...staffAreaAssignMap, [applicant.id]: e.target.value })}
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '0.85rem', minWidth: '160px' }}
                    >
                      <option value="">-- None --</option>
                      {facilities.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => handleApproveStaff(applicant)}
                    className="btn btn-success btn-sm"
                  >
                    <CheckCircle2 size={15} />
                    <span>Approve Access</span>
                  </button>

                  <button
                    onClick={() => handleRejectStaff(applicant)}
                    className="btn btn-danger btn-sm"
                  >
                    <XCircle size={15} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
            <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 8px' }} />
            <p style={{ fontWeight: 600 }}>No Pending Staff Applications</p>
            <p style={{ fontSize: '0.8rem' }}>All staff registration requests have been approved or resolved.</p>
          </div>
        )}
      </div>

      {/* Active Staff Lot Assignments */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#120f26' }}>
              Staff Lot Assignments ({activeStaffUsers.length})
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Assign active staff to parking facilities. Multiple assignments (same lot) allowed.
            </p>
          </div>
        </div>

        {activeStaffUsers.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeStaffUsers.map((staffMember) => (
              <div
                key={staffMember.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#120f26' }}>{staffMember.name}</strong>
                    <span className="badge badge-available" style={{ fontSize: '0.7rem' }}>ACTIVE</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                    ID: {staffMember.staffId || '—'} &nbsp;•&nbsp;
                    Current lot: <strong>{facilities.find(f => f.id === staffMember.assignedParkingAreaId)?.name || 'Unassigned'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={staffAreaAssignMap[staffMember.id] || staffMember.assignedParkingAreaId || ''}
                    onChange={(e) => setStaffAreaAssignMap({ ...staffAreaAssignMap, [staffMember.id]: e.target.value })}
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: '0.85rem', minWidth: '180px' }}
                  >
                    <option value="">-- Select Facility --</option>
                    {facilities.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssignStaffLot(staffMember)}
                    className="btn btn-primary btn-sm"
                  >
                    <MapPin size={14} />
                    <span>Assign</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
            <p style={{ fontWeight: 600 }}>No Active Staff</p>
            <p style={{ fontSize: '0.8rem' }}>Approve pending staff requests to start assigning lots.</p>
          </div>
        )}
      </div>

      <ParkSmartWalkthrough />

      {/* Facility Deletion Confirmation Modal */}
      {facilityToDelete && (
        <div className="modal-overlay" onClick={() => setFacilityToDelete(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', padding: '28px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Delete Venue Layout
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Permanent Action
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '20px' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-main)' }}>{facilityToDelete.name}</strong>?
              This will permanently delete all floor levels, parking bays, road markings, and layout elements configured for this facility.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setFacilityToDelete(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFacility}
                className="btn btn-danger"
              >
                <Trash2 size={15} />
                <span>Delete Facility</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
