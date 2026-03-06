'use client';

import { useState } from 'react';
import {
  Layers, Zap, ChevronDown, ChevronUp, Truck,
  TrendingDown, TrendingUp, Check, X, Edit,
  ArrowRight, Loader2, Settings2, Package
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { mockConsolidationPlan, type Cluster } from '@/lib/mock-data';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      fontSize: '12px',
    }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.fill, fontWeight: 600 }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
};

export default function ConsolidationPage() {
  const plan = mockConsolidationPlan;
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [clusterStatuses, setClusterStatuses] = useState<Record<string, string>>({});

  const handleRunConsolidation = () => {
    setIsRunning(true);
    setShowResults(false);
    setTimeout(() => {
      setIsRunning(false);
      setShowResults(true);
    }, 3000);
  };

  const handleClusterAction = (clusterId: string, action: string) => {
    setClusterStatuses(prev => ({ ...prev, [clusterId]: action }));
  };

  const getUtilColor = (pct: number) => {
    if (pct >= 80) return '#10b981';
    if (pct >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const beforeAfterData = [
    { metric: 'Trips', before: plan.tripsBefore, after: plan.tripsAfter },
    { metric: 'Cost (₹K)', before: plan.totalCostBefore / 1000, after: plan.totalCostAfter / 1000 },
    { metric: 'CO₂ (kg)', before: plan.co2Before, after: plan.co2After },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Consolidation Engine</h1>
          <p className="page-subtitle">AI-powered shipment clustering & vehicle assignment</p>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleRunConsolidation}
          disabled={isRunning}
        >
          {isRunning ? (
            <><Loader2 size={18} className="loading-spinner" style={{ border: 'none', borderTop: 'none' }} /> Running Engine...</>
          ) : (
            <><Zap size={18} /> Run Consolidation</>
          )}
        </button>
      </div>

      <div className="page-body">
        {/* Constraints */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings2 size={16} style={{ color: 'var(--text-secondary)' }} />
              <span className="card-title">Engine Parameters</span>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div>
                <label className="label">Date Range</label>
                <input className="input" type="date" defaultValue="2026-03-07" />
              </div>
              <div>
                <label className="label">Max Detour %</label>
                <select className="input select" defaultValue="15">
                  <option value="10">10%</option>
                  <option value="15">15%</option>
                  <option value="20">20%</option>
                  <option value="30">30%</option>
                </select>
              </div>
              <div>
                <label className="label">Vehicle Types</label>
                <select className="input select" defaultValue="all">
                  <option value="all">All Available</option>
                  <option value="heavy">Heavy Trucks Only</option>
                  <option value="medium">Medium Trucks Only</option>
                </select>
              </div>
              <div>
                <label className="label">Priority Handling</label>
                <select className="input select" defaultValue="preserve">
                  <option value="preserve">Preserve Priority</option>
                  <option value="relax">Relax (cost-optimized)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Animation */}
        {isRunning && (
          <div style={{
            textAlign: 'center',
            padding: '80px 24px',
          }}>
            <div style={{
              width: '80px', height: '80px', margin: '0 auto 24px',
              borderRadius: '50%',
              background: 'rgba(14, 165, 233, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse-glow 1.5s ease infinite',
            }}>
              <Zap size={36} style={{ color: 'var(--lorri-primary)' }} />
            </div>
            <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Running DBSCAN Clustering + 3D Bin Packing...
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Analyzing 150 shipments across 15 cities • Optimizing vehicle assignments
            </p>
            <div className="progress-bar" style={{ maxWidth: '400px', margin: '24px auto 0' }}>
              <div className="progress-bar-fill green" style={{
                width: '65%',
                animation: 'shimmer 2s ease infinite',
              }} />
            </div>
          </div>
        )}

        {/* Results */}
        {showResults && !isRunning && (
          <div className="animate-slide-up">
            {/* Before vs After */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '24px',
              marginBottom: '24px',
              alignItems: 'center',
            }}>
              {/* Before */}
              <div className="card" style={{ textAlign: 'center', padding: '28px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                  Before Consolidation
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--lorri-danger)' }}>{plan.tripsBefore}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Trips</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--lorri-danger)' }}>58%</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Utilization</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--lorri-danger)' }}>₹4.5L</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Cost</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--lorri-danger)' }}>{plan.co2Before}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CO₂ (kg)</div>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <ArrowRight size={28} style={{ color: 'var(--lorri-primary)' }} />
                <span className="badge badge-success">Optimized</span>
              </div>

              {/* After */}
              <div className="card" style={{ textAlign: 'center', padding: '28px', borderColor: 'var(--border-accent)', boxShadow: 'var(--shadow-glow)' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--lorri-primary)', marginBottom: '16px' }}>
                  After Consolidation
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--lorri-success)' }}>
                      {plan.tripsAfter}
                      <span style={{ fontSize: '12px', fontWeight: 600, marginLeft: '6px' }}>▼34%</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Trips</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--lorri-success)' }}>
                      87%
                      <span style={{ fontSize: '12px', fontWeight: 600, marginLeft: '6px' }}>▲29%</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Utilization</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--lorri-success)' }}>
                      ₹3.1L
                      <span style={{ fontSize: '12px', fontWeight: 600, marginLeft: '6px' }}>▼31%</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Cost</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--lorri-success)' }}>
                      {plan.co2After}
                      <span style={{ fontSize: '12px', fontWeight: 600, marginLeft: '6px' }}>▼33%</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CO₂ (kg)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison Chart */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card-header">
                <div className="card-title">Before vs After Comparison</div>
              </div>
              <div className="card-body" style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={beforeAfterData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                    <XAxis dataKey="metric" tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="before" name="Before" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={32} />
                    <Bar dataKey="after" name="After" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cluster Cards */}
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
              Consolidated Clusters ({plan.clusters.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
              {plan.clusters.map((cluster) => {
                const status = clusterStatuses[cluster.id] || cluster.status;
                const isExpanded = expandedCluster === cluster.id;
                return (
                  <div
                    key={cluster.id}
                    className="card"
                    style={{
                      borderColor: status === 'accepted' ? 'rgba(16, 185, 129, 0.3)' : status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : undefined,
                    }}
                  >
                    <div className="card-body" style={{ padding: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Cluster {cluster.id.split('-')[1]}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            <Truck size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                            {cluster.vehicleName}
                          </div>
                        </div>
                        <span className={`badge ${status === 'accepted' ? 'badge-success' : status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                          {status}
                        </span>
                      </div>

                      {/* Utilization Bar */}
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Utilization</span>
                          <span style={{ fontWeight: 700, color: getUtilColor(cluster.utilizationPct) }}>{cluster.utilizationPct}%</span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className={`progress-bar-fill ${cluster.utilizationPct >= 80 ? 'green' : cluster.utilizationPct >= 60 ? 'yellow' : 'red'}`}
                            style={{ width: `${cluster.utilizationPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>Shipments</span>
                          <div style={{ fontWeight: 600 }}>{cluster.shipmentIds.length}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>Weight</span>
                          <div style={{ fontWeight: 600 }}>{cluster.totalWeight.toLocaleString()} kg</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>Distance</span>
                          <div style={{ fontWeight: 600 }}>{cluster.routeDistanceKm} km</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>Cost</span>
                          <div style={{ fontWeight: 600 }}>₹{cluster.estimatedCost.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Expandable Shipments */}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: '100%', justifyContent: 'center', marginBottom: '10px' }}
                        onClick={() => setExpandedCluster(isExpanded ? null : cluster.id)}
                      >
                        <Package size={13} /> View Shipments
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      {isExpanded && (
                        <div style={{
                          background: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px',
                          marginBottom: '10px',
                          fontSize: '12px',
                        }}>
                          {cluster.shipmentIds.map((sid) => (
                            <div key={sid} style={{
                              padding: '6px 8px',
                              borderBottom: '1px solid var(--border-secondary)',
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}>
                              <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{sid.toUpperCase()}</span>
                              <span className="badge badge-ghost" style={{ fontSize: '10px' }}>pending</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {status === 'pending' && (
                        <div className="cluster-actions">
                          <button className="btn btn-sm btn-success" style={{ flex: 1 }} onClick={() => handleClusterAction(cluster.id, 'accepted')}>
                            <Check size={13} /> Accept
                          </button>
                          <button className="btn btn-sm btn-secondary" style={{ flex: 1 }}>
                            <Edit size={13} /> Modify
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleClusterAction(cluster.id, 'rejected')}>
                            <X size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
