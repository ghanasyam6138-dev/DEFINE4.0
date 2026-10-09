import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { useDbRevision } from '../hooks/useDbRevision';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ParkingArea, ParkingLevel, Zone, Slot } from '../types';
import { DEFAULT_TARIFF } from '../services/seedData';
import {
  MapPin,
  Clock,
  Zap,
  Plus,
  ArrowRight,
  Search,
  Sparkles
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user, isCustomer, isAdmin } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  useDbRevision(); // live slot availability / facility list

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterEVOnly, setFilterEVOnly] = useState<boolean>(false);
  const [showAddProfileModal, setShowAddProfileModal] = useState<boolean>(false);

  // New facility profile form state
  const [newFacilityName, setNewFacilityName] = useState<string>('');
  const [newFacilityAddress, setNewFacilityAddress] = useState<string>('');
  const [newFacilityDesc, setNewFacilityDesc] = useState<string>('');

  // Load published parking facilities (or include drafts if admin)
  const areas = dbService.getParkingAreas(isAdmin, user?.id);

  // Filter facilities
  const filteredAreas = areas.filter((area: ParkingArea) => {
    const matchesSearch =
      area.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      area.address.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterEVOnly) {
      const hasEVSlot = area.levels.some((l: ParkingLevel) =>
        l.zones.some((z: Zone) => z.id.includes('ev') || z.name.toLowerCase().includes('ev'))
      );
      return matchesSearch && hasEVSlot;
    }

    return matchesSearch;
  });

  const handleCreateFacility = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacilityName.trim()) {
      error('Name Required', 'Please enter a facility name.');
      return;
    }

    const newAreaId = `area-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const newArea: ParkingArea = {
      id: newAreaId,
      name: newFacilityName.trim(),
      address: newFacilityAddress.trim() || 'Central Business District, Bengaluru',
      locationDescription: newFacilityDesc.trim() || 'Newly configured smart parking facility',
      operatingHours: { open: '08:00', close: '23:00', is24x7: false },
      ownerAdminId: user?.id || 'usr-mall-admin-01',
      isPublished: false, // Created as a private draft
      levels: [
        {
          id: `lvl-${Date.now()}-1`,
          name: 'Level 1 (Ground Floor)',
          levelNumber: 1,
          width: 800,
          height: 520,
          zones: [
            { id: 'zone-a', name: 'Zone A (Standard)', color: '#9333ea', slotCount: 6 },
            { id: 'zone-ev', name: 'Zone EV (Chargers)', color: '#10b981', slotCount: 2 }
          ],
          elements: [
            { id: `el-${Date.now()}-1`, type: 'entry_gate', label: 'Main Entry Gate', x: 50, y: 30, width: 120, height: 40 }
          ]
        }
      ],
      tariffs: DEFAULT_TARIFF,
      overflowCount: 0,
      overflowCapacity: 40,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    dbService.saveParkingArea(newArea);

    dbService.addAuditLog({
      actorId: user?.id || 'admin',
      actorName: user?.name || 'Facility Admin',
      actorRole: 'parking_admin',
      action: 'FACILITY_PROFILE_CREATED',
      parkingAreaId: newArea.id,
      targetResource: newArea.name,
      details: 'Created draft facility profile. Ready for layout builder configuration.'
    });

    setShowAddProfileModal(false);
    success('Draft Created!', `Created ${newArea.name}. Now configure slots in the Visual Builder.`);
    navigate(`/builder/${newArea.id}`);
  };

  return (
    <div>
      {/* Hero Welcome Banner */}
      <section style={{ marginBottom: '36px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#eff6ff', color: '#6b21a8', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '16px' }}>
          <Sparkles size={16} /> Real-Time Smart Parking & Venue Operations
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#120f26', letterSpacing: '-0.8px', maxWidth: '800px', margin: '0 auto 12px' }}>
          Reserve, Navigate & Park with Total Confidence
        </h1>
        <p style={{ color: '#475569', fontSize: '1.05rem', maxWidth: '650px', margin: '0 auto 24px' }}>
          Real-time slot availability, fast EV charging bays, automated ANPR/QR verification, and intelligent blocked-car resolution.
        </p>

        {/* Search & Filter Toolbar */}
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by venue name, location, or landmark..."
              className="form-input"
              style={{ paddingLeft: '40px' }}
            />
          </div>

          <button
            onClick={() => setFilterEVOnly(!filterEVOnly)}
            className={`btn ${filterEVOnly ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Zap size={16} />
            <span>EV Charging Only</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowAddProfileModal(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Add Profile</span>
            </button>
          )}
        </div>
      </section>

      {/* Facilities Cards Grid */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#120f26' }}>
            Available Parking Facilities ({filteredAreas.length})
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Showing published venues
          </span>
        </div>

        <div className="grid-2">
          {filteredAreas.map((area: ParkingArea) => {
            const slots = dbService.getSlots(area.id);
            const total = slots.length;
            const available = slots.filter((s: Slot) => s.status === 'available').length;
            const occupied = slots.filter((s: Slot) => s.status === 'occupied').length;
            const reserved = slots.filter((s: Slot) => s.status === 'reserved').length;
            const evSlots = slots.filter((s: Slot) => s.type === 'ev');
            const evAvailable = evSlots.filter((s: Slot) => s.status === 'available').length;

            return (
              <div key={area.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#120f26' }}>
                        {area.name}
                      </h3>
                      {!area.isPublished && (
                        <span className="badge badge-maintenance">Private Draft</span>
                      )}
                    </div>
                    <p style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
                      <MapPin size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                      <span>{area.address}</span>
                    </p>
                  </div>

                  <span className="badge badge-available" style={{ fontSize: '0.8rem' }}>
                    {available} Slots Free
                  </span>
                </div>

                <p style={{ color: '#475569', fontSize: '0.88rem', marginBottom: '16px', lineHeight: '1.5' }}>
                  {area.locationDescription}
                </p>

                {/* Live Availability Chips */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px', textAlign: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Capacity</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#120f26' }}>{total}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Available</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>{available}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 600 }}>Reserved</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b45309' }}>{reserved}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>Occupied</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626' }}>{occupied}</div>
                  </div>
                </div>

                {/* Details & Pricing */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#64748b', marginBottom: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={15} />
                    <span>{area.operatingHours.open} - {area.operatingHours.close}</span>
                  </div>
                  <div>
                    Tariff: <strong style={{ color: '#120f26' }}>₹{area.tariffs.baseHourlyRate}/hr</strong>
                    {area.tariffs.freePeriodMinutes > 0 && (
                      <span style={{ color: '#059669', marginLeft: '6px' }}>({area.tariffs.freePeriodMinutes}m free)</span>
                    )}
                  </div>
                  {evSlots.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#047857', fontWeight: 700 }}>
                      <Zap size={14} />
                      <span>{evAvailable} EV bays</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                  <Link
                    to={`/parking/${area.id}`}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    View Details
                  </Link>
                  {isCustomer ? (
                    <Link
                      to={`/book/${area.id}`}
                      className="btn btn-primary"
                      style={{ flex: 1.2 }}
                    >
                      <span>Book Parking</span>
                      <ArrowRight size={15} />
                    </Link>
                  ) : !user ? (
                    <Link
                      to="/login"
                      className="btn btn-primary"
                      style={{ flex: 1.2 }}
                    >
                      <span>Log In to Book</span>
                      <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <span
                      className="badge badge-warning"
                      style={{ flex: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem' }}
                    >
                      Booking Restricted
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add Profile Modal Dialog */}
      {showAddProfileModal && (
        <div className="modal-overlay" onClick={() => setShowAddProfileModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#120f26' }}>
                Add Parking Facility Profile
              </h3>
              <button onClick={() => setShowAddProfileModal(false)} className="toast-close-btn">
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
              Creates a new private draft facility. You can configure floors, zones, and slots in the Visual Builder before publishing.
            </p>

            <form onSubmit={handleCreateFacility}>
              <div className="form-group">
                <label className="form-label">Facility Name</label>
                <input
                  type="text"
                  value={newFacilityName}
                  onChange={(e) => setNewFacilityName(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Phoenix Marketcity South Wing"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Physical Address</label>
                <input
                  type="text"
                  value={newFacilityAddress}
                  onChange={(e) => setNewFacilityAddress(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Whitefield Main Road, Mahadevapura, Bengaluru"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Location / Landmark Description</label>
                <textarea
                  value={newFacilityDesc}
                  onChange={(e) => setNewFacilityDesc(e.target.value)}
                  className="form-textarea"
                  rows={2}
                  placeholder="Multi-tier covered parking with EV fast chargers and direct mall skywalk access."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddProfileModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  <Plus size={16} />
                  <span>Create & Launch Builder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
