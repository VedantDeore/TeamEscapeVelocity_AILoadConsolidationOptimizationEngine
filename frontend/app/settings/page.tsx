'use client';

import { useState } from 'react';
import {
  Settings, Truck, MapPin, IndianRupee, Leaf, Key,
  SlidersHorizontal, Plus, Edit, Trash2, Save, Check
} from 'lucide-react';
import { mockVehicles, mockDepots, mockCostParams, type Vehicle, type DepotLocation } from '@/lib/mock-data';

export default function SettingsPage() {
  const [vehicles] = useState<Vehicle[]>(mockVehicles);
  const [depots] = useState<DepotLocation[]>(mockDepots);
  const [costParams, setCostParams] = useState(mockCostParams);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings & Configuration</h1>
          <p className="page-subtitle">Manage fleet, depots, cost parameters, and system preferences</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <><Check size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
        </button>
      </div>

      <div className="page-body">
        <div className="settings-grid">
          {/* Vehicle Fleet */}
          <div className="settings-section" style={{ gridColumn: '1 / -1' }}>
            <div className="settings-section-title">
              <Truck size={18} style={{ color: 'var(--lorri-primary)' }} />
              Vehicle Fleet Management
              <button className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }}>
                <Plus size={13} /> Add Vehicle
              </button>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Type</th>
                    <th>Max Weight</th>
                    <th>Max Volume</th>
                    <th>Dimensions (L×W×H)</th>
                    <th>Cost/km</th>
                    <th>Emission Factor</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.name}</td>
                      <td><span className="badge badge-ghost">{v.type}</span></td>
                      <td>{v.maxWeightKg.toLocaleString()} kg</td>
                      <td>{v.maxVolumeM3} m³</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        {v.lengthCm}×{v.widthCm}×{v.heightCm} cm
                      </td>
                      <td>₹{v.costPerKm}</td>
                      <td>{v.emissionFactor}</td>
                      <td>
                        <span className={`badge ${v.isAvailable ? 'badge-success' : 'badge-danger'}`}>
                          {v.isAvailable ? 'Available' : 'Offline'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-ghost btn-icon" style={{ width: '28px', height: '28px' }}>
                            <Edit size={13} />
                          </button>
                          <button className="btn btn-ghost btn-icon" style={{ width: '28px', height: '28px', color: 'var(--lorri-danger)' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Depot Locations */}
          <div className="settings-section">
            <div className="settings-section-title">
              <MapPin size={18} style={{ color: '#f59e0b' }} />
              Depot Locations
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {depots.map((depot) => (
                <div
                  key={depot.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-secondary)',
                  }}
                >
                  <div style={{
                    width: '36px', height: '36px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(245, 158, 11, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MapPin size={16} style={{ color: '#fbbf24' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{depot.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {depot.city} · {depot.lat.toFixed(4)}, {depot.lng.toFixed(4)}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon" style={{ width: '28px', height: '28px' }}>
                    <Edit size={13} />
                  </button>
                </div>
              ))}
              <button className="btn btn-sm btn-secondary" style={{ alignSelf: 'flex-start' }}>
                <Plus size={13} /> Add Depot
              </button>
            </div>
          </div>

          {/* Cost Parameters */}
          <div className="settings-section">
            <div className="settings-section-title">
              <IndianRupee size={18} style={{ color: '#10b981' }} />
              Cost Parameters
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Fuel Cost (₹/km)</label>
                <input
                  className="input"
                  type="number"
                  step="0.5"
                  value={costParams.fuelCostPerKm}
                  onChange={(e) => setCostParams(p => ({ ...p, fuelCostPerKm: parseFloat(e.target.value) }))}
                />
              </div>
              <div>
                <label className="label">Driver Cost (₹/hr)</label>
                <input
                  className="input"
                  type="number"
                  step="10"
                  value={costParams.driverCostPerHr}
                  onChange={(e) => setCostParams(p => ({ ...p, driverCostPerHr: parseFloat(e.target.value) }))}
                />
              </div>
              <div>
                <label className="label">Avg Toll per Trip (₹)</label>
                <input
                  className="input"
                  type="number"
                  step="100"
                  value={costParams.tollAvgPerTrip}
                  onChange={(e) => setCostParams(p => ({ ...p, tollAvgPerTrip: parseFloat(e.target.value) }))}
                />
              </div>
              <div>
                <label className="label">Maintenance (₹/km)</label>
                <input
                  className="input"
                  type="number"
                  step="0.5"
                  value={costParams.maintenanceCostPerKm}
                  onChange={(e) => setCostParams(p => ({ ...p, maintenanceCostPerKm: parseFloat(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Emission Factors */}
          <div className="settings-section">
            <div className="settings-section-title">
              <Leaf size={18} style={{ color: '#06b6d4' }} />
              Emission Factors
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Heavy Truck (full) — kg CO₂/ton-km</label>
                <input className="input" type="number" step="0.001" defaultValue="0.062" />
              </div>
              <div>
                <label className="label">Heavy Truck (empty) — kg CO₂/ton-km</label>
                <input className="input" type="number" step="0.001" defaultValue="0.031" />
              </div>
              <div>
                <label className="label">Light Truck — kg CO₂/ton-km</label>
                <input className="input" type="number" step="0.001" defaultValue="0.090" />
              </div>
              <div>
                <label className="label">Medium Truck — kg CO₂/ton-km</label>
                <input className="input" type="number" step="0.001" defaultValue="0.075" />
              </div>
            </div>
          </div>

          {/* API Keys */}
          <div className="settings-section">
            <div className="settings-section-title">
              <Key size={18} style={{ color: '#8b5cf6' }} />
              API Key Management
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Groq API Key</label>
                <input className="input" type="password" defaultValue="gsk_••••••••••••••••••••" />
              </div>
              <div>
                <label className="label">OpenRouteService API Key</label>
                <input className="input" type="password" defaultValue="5b••••••••••••••••••••••" />
              </div>
              <div>
                <label className="label">Supabase URL</label>
                <input className="input" defaultValue="https://your-project.supabase.co" />
              </div>
              <div>
                <label className="label">Supabase Anon Key</label>
                <input className="input" type="password" defaultValue="eyJhbGci••••••••••••••••" />
              </div>
            </div>
          </div>

          {/* Default Constraints */}
          <div className="settings-section">
            <div className="settings-section-title">
              <SlidersHorizontal size={18} style={{ color: '#f59e0b' }} />
              Default Constraints
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Max Detour (%)</label>
                <select className="input select" defaultValue="15">
                  <option value="10">10%</option>
                  <option value="15">15%</option>
                  <option value="20">20%</option>
                  <option value="30">30%</option>
                </select>
              </div>
              <div>
                <label className="label">Clustering Algorithm</label>
                <select className="input select" defaultValue="dbscan">
                  <option value="dbscan">DBSCAN</option>
                  <option value="kmeans">K-Means</option>
                  <option value="hierarchical">Hierarchical</option>
                </select>
              </div>
              <div>
                <label className="label">DBSCAN Epsilon (km)</label>
                <input className="input" type="number" step="5" defaultValue="50" />
              </div>
              <div>
                <label className="label">Min Samples per Cluster</label>
                <input className="input" type="number" defaultValue="3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
