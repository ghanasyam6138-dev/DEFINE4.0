import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/dbService';
import { useDbRevision } from '../hooks/useDbRevision';
import { operationsService } from '../services/operationsService';
import { useToast } from '../context/ToastContext';
import { DEMO_MALL_ID } from '../services/seedData';
import type { ParkingArea, OperationsMetrics, StaffingRecommendation } from '../types';
import {
  BarChart3,
  TrendingUp,
  Users,
  Car,
  Zap,
  AlertTriangle,
  Clock,
  ArrowLeft,
  RefreshCw,
  Sliders,
  DollarSign
} from 'lucide-react';

export const OperationsDashboard: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const facilities = dbService.getParkingAreas(true);
  const [selectedAreaId, setSelectedAreaId] = useState<string>(
    user?.assignedParkingAreaId || DEMO_MALL_ID
  );

  const currentArea = facilities.find((f: ParkingArea) => f.id === selectedAreaId) || facilities[0];

  const [metrics, setMetrics] = useState<OperationsMetrics | null>(null);
  const [hourlyTrend, setHourlyTrend] = useState<
    { hour: string; actualArrivals: number; actualDepartures: number; forecastArrivals?: number; isForecast: boolean }[]
  >([]);
  const [staffingRecs, setStaffingRecs] = useState<StaffingRecommendation[]>([]);
  const [overflowCountInput, setOverflowCountInput] = useState<number>(0);

  const refreshMetrics = () => {
    if (!currentArea) return;
    const m = operationsService.getMetrics(currentArea.id);
    setMetrics(m);
    setHourlyTrend(operationsService.getHourlyTrendAndForecast(currentArea.id));
    setStaffingRecs(operationsService.getStaffingRecommendations(currentArea));
    setOverflowCountInput(currentArea.overflowCount || 0);
  };

  const dbRevision = useDbRevision();
  useEffect(() => {
    refreshMetrics();
  }, [selectedAreaId, currentArea?.id, dbRevision]);

  const handleUpdateOverflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentArea) return;

    const res = operationsService.updateOverflowCount({
      parkingAreaId: currentArea.id,
      newCount: overflowCountInput,
      staffId: user?.id || 'admin',
      staffName: user?.name || 'Administrator'
    });

    if (res.success) {
      success('Overflow Lot Updated', `Updated overflow tally to ${overflowCountInput} vehicles.`);
    } else {
      error('Update Failed', res.error || 'Failed to update overflow lot.');
    }
  };

  if (!currentArea) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2>No Facilities Configured</h2>
        <Link to="/admin" className="btn btn-primary" style={{ marginTop: '16px' }}>
          Back to Admin Console
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '4px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Link to="/admin" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
              <ArrowLeft size={15} /> Back to Facilities
            </Link>
          </div>
          <h1 className="page-title">Operations & Capacity Intelligence</h1>
          <p className="page-desc">
            Live occupancy metrics, peak-hour throughput forecast, and algorithmic staffing models (25 cars/attendant/hr).
          </p>
        </div>

        {/* Facility Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={selectedAreaId}
            onChange={(e) => setSelectedAreaId(e.target.value)}
            className="form-select"
            style={{ minWidth: '220px', fontWeight: 600 }}
          >
            {facilities.map((fac: ParkingArea) => (
              <option key={fac.id} value={fac.id}>
                {fac.name}
              </option>
            ))}
          </select>
          <button onClick={refreshMetrics} className="btn btn-secondary">
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>OCCUPANCY RATE</span>
              <TrendingUp size={18} style={{ color: metrics.occupancyRatePercent > 80 ? '#ef4444' : '#10b981' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: metrics.occupancyRatePercent > 80 ? '#dc2626' : '#120f26', marginTop: '6px' }}>
              {metrics.occupancyRatePercent}%
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
              {metrics.occupiedSlots + metrics.reservedSlots} of {metrics.totalSlots} bays utilized
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>ACTIVE SESSIONS</span>
              <Car size={18} style={{ color: '#7e22ce' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#120f26', marginTop: '6px' }}>
              {metrics.activeSessionsCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
              Avg. Duration: {metrics.averageDurationMinutes} mins
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>EV BAYS FREE</span>
              <Zap size={18} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#059669', marginTop: '6px' }}>
              {metrics.evSlotsAvailable} / {metrics.evSlotsTotal}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
              Fast charging stations ready
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>TODAY REVENUE</span>
              <DollarSign size={18} style={{ color: '#059669' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#120f26', marginTop: '6px' }}>
              ₹{metrics.todayRevenueINR}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
              Settled via UPI / Exit Pass
            </div>
          </div>
        </div>
      )}

      {/* Hourly Trend & Evening Peak Forecast Chart/Table */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#120f26', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={20} style={{ color: '#7e22ce' }} />
              Hourly Traffic Volume & Peak Forecast
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '2px' }}>
              Historical throughput from ANPR entry/exit cameras alongside predictive machine learning projections.
            </p>
          </div>
          <span className="badge badge-ev" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> PEAK WINDOW: 18:00 - 21:00
          </span>
        </div>

        {/* CSS Bar Chart Simulation */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '170px', padding: '16px 8px 30px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
          {hourlyTrend.map((t, idx) => {
            const heightArrival = t.isForecast ? (t.forecastArrivals || 0) * 3 : t.actualArrivals * 3;
            const heightDeparture = t.actualDepartures * 3;

            return (
              <div key={idx} style={{ flex: '1 0 46px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
                  {/* Arrival Bar */}
                  <div
                    title={`Arrivals: ${t.isForecast ? t.forecastArrivals : t.actualArrivals}`}
                    style={{
                      width: '16px',
                      height: `${Math.min(120, heightArrival)}px`,
                      background: t.isForecast ? 'repeating-linear-gradient(45deg, #9333ea, #9333ea 4px, #c084fc 4px, #c084fc 8px)' : '#7e22ce',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s'
                    }}
                  />
                  {/* Departure Bar */}
                  {!t.isForecast && (
                    <div
                      title={`Departures: ${t.actualDepartures}`}
                      style={{
                        width: '16px',
                        height: `${Math.min(120, heightDeparture)}px`,
                        background: '#94a3b8',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s'
                      }}
                    />
                  )}
                </div>
                <span style={{ fontSize: '0.68rem', color: t.isForecast ? '#7e22ce' : '#64748b', fontWeight: t.isForecast ? 700 : 500, whiteSpace: 'nowrap' }}>
                  {t.hour}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '18px', marginTop: '12px', fontSize: '0.78rem', color: '#64748b', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: '#7e22ce', borderRadius: '3px' }}></span>
            <span>Recorded Arrivals</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: '#94a3b8', borderRadius: '3px' }}></span>
            <span>Recorded Departures</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: 'repeating-linear-gradient(45deg, #9333ea, #9333ea 3px, #c084fc 3px, #c084fc 6px)', borderRadius: '3px' }}></span>
            <span>Forecasted Inflow (Next 4h)</span>
          </div>
        </div>
      </div>

      {/* Staffing Recommendations (25 cars/attendant/hr capacity) & Overflow Lot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Algorithmic Staffing Recommendations */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#120f26', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: '#7e22ce' }} />
                Dynamic Staffing Allocation
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>
                Formula: Max capacity = 25 vehicles / attendant / hour
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {staffingRecs.map((rec, i) => (
              <div
                key={i}
                style={{
                  padding: '14px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#120f26' }}>
                    {rec.zoneName}
                  </h4>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px' }}>
                    Projected Inflow: <strong>{rec.expectedCarsPerHour} cars/hr</strong>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                    {rec.assumptions}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-available" style={{ fontSize: '0.82rem', padding: '5px 10px' }}>
                    {rec.recommendedStaffCount} Marshalls
                  </span>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                    Active: {rec.currentStaffCount} on-duty
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manual Overflow Yard Management */}
        <div className="card" style={{ padding: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#120f26', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} style={{ color: '#f59e0b' }} />
              Surface Overflow Yard Tally
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>
              Staffed attendants manually increment un-metered auxiliary spillover ground.
            </p>
          </div>

          <form onSubmit={handleUpdateOverflow} style={{ marginTop: '20px' }}>
            <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                  Vehicles Currently in Overflow Yard:
                </span>
                <span className="badge badge-warning">
                  Max: {currentArea.overflowCapacity} Bays
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                <input
                  type="number"
                  min="0"
                  max={currentArea.overflowCapacity}
                  value={overflowCountInput}
                  onChange={(e) => setOverflowCountInput(Number(e.target.value))}
                  className="form-input"
                  style={{ fontSize: '1.3rem', fontWeight: 800, textAlign: 'center', width: '120px' }}
                />
                <button
                  type="button"
                  onClick={() => setOverflowCountInput(prev => Math.min(currentArea.overflowCapacity, prev + 1))}
                  className="btn btn-secondary"
                >
                  +1 Car
                </button>
                <button
                  type="button"
                  onClick={() => setOverflowCountInput(prev => Math.max(0, prev - 1))}
                  className="btn btn-secondary"
                >
                  -1 Car
                </button>
              </div>

              {currentArea.overflowLastUpdatedAt && (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '12px' }}>
                  Last counted by {currentArea.overflowLastUpdatedBy || 'Attendant'} at {new Date(currentArea.overflowLastUpdatedAt).toLocaleTimeString()}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px' }}
            >
              <span>Save & Broadcast Overflow Count</span>
            </button>
          </form>

          {/* Incident Callout */}
          {metrics && metrics.blockedCarIncidentsCount > 0 && (
            <div style={{ marginTop: '20px', padding: '14px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
              <div style={{ fontSize: '0.82rem', color: '#991b1b' }}>
                <strong>{metrics.blockedCarIncidentsCount} Blocked Vehicle Incident(s)</strong> require marshall intervention.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
