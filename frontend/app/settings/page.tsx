"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Truck,
  MapPin,
  IndianRupee,
  Leaf,
  Key,
  SlidersHorizontal,
  Plus,
  Edit,
  Trash2,
  Save,
  Check,
} from "lucide-react";
import {
  mockVehicles,
  mockDepots,
  mockCostParams,
  type Vehicle,
  type DepotLocation,
} from "@/lib/mock-data";
import {
  getVehicles,
  getDepots,
  getCostParams,
  updateCostParams,
  createVehicle,
  createDepot,
} from "@/lib/api";

export default function SettingsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [depots, setDepots] = useState<DepotLocation[]>(mockDepots);
  const [costParams, setCostParams] = useState(mockCostParams);
  const [saved, setSaved] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddDepot, setShowAddDepot] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [addingDepot, setAddingDepot] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    name: "", type: "heavy", max_weight_kg: 0, max_volume_m3: 0,
    length_cm: 0, width_cm: 0, height_cm: 0, cost_per_km: 0, emission_factor: 0.062,
  });
  const [newDepot, setNewDepot] = useState({ name: "", city: "", lat: 0, lng: 0 });
  const [toast, setToast] = useState<string | null>(null);

  const showToastMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const refreshVehicles = () => {
    getVehicles().then((data) => {
      if (data?.length) {
        setVehicles(data.map((v: any) => ({
          id: v.id, name: v.name, type: v.type, maxWeightKg: v.max_weight_kg,
          maxVolumeM3: v.max_volume_m3, lengthCm: v.length_cm, widthCm: v.width_cm,
          heightCm: v.height_cm, costPerKm: v.cost_per_km, emissionFactor: v.emission_factor,
          isAvailable: v.is_available,
        })));
      }
    }).catch(() => {});
  };

  const refreshDepots = () => {
    getDepots().then((data) => { if (data?.length) setDepots(data); }).catch(() => {});
  };

  const handleAddVehicle = async () => {
    if (!newVehicle.name) return;
    setAddingVehicle(true);
    try {
      await createVehicle(newVehicle);
      showToastMsg("Vehicle added successfully!");
      setShowAddVehicle(false);
      setNewVehicle({ name: "", type: "heavy", max_weight_kg: 0, max_volume_m3: 0, length_cm: 0, width_cm: 0, height_cm: 0, cost_per_km: 0, emission_factor: 0.062 });
      refreshVehicles();
    } catch { showToastMsg("Failed to add vehicle."); }
    finally { setAddingVehicle(false); }
  };

  const handleAddDepot = async () => {
    if (!newDepot.name || !newDepot.city) return;
    setAddingDepot(true);
    try {
      await createDepot(newDepot);
      showToastMsg("Depot added successfully!");
      setShowAddDepot(false);
      setNewDepot({ name: "", city: "", lat: 0, lng: 0 });
      refreshDepots();
    } catch { showToastMsg("Failed to add depot."); }
    finally { setAddingDepot(false); }
  };

  useEffect(() => {
    getVehicles()
      .then((data) => {
        if (data?.length) {
          const mapped = data.map((v: any) => ({
            id: v.id,
            name: v.name,
            type: v.type,
            maxWeightKg: v.max_weight_kg,
            maxVolumeM3: v.max_volume_m3,
            lengthCm: v.length_cm,
            widthCm: v.width_cm,
            heightCm: v.height_cm,
            costPerKm: v.cost_per_km,
            emissionFactor: v.emission_factor,
            isAvailable: v.is_available,
          }));
          setVehicles(mapped);
        }
      })
      .catch(() => {});
    getDepots()
      .then((data) => {
        if (data?.length) {
          setDepots(data);
        }
      })
      .catch(() => {});
    getCostParams()
      .then((data) => {
        if (data && data.fuel_cost_per_km !== undefined) {
          setCostParams({
            fuelCostPerKm: data.fuel_cost_per_km,
            driverCostPerHr: data.driver_cost_per_hr,
            tollAvgPerTrip: data.toll_avg_per_trip,
            maintenanceCostPerKm: data.maintenance_cost_per_km,
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = () => {
    updateCostParams({
      fuel_cost_per_km: costParams.fuelCostPerKm,
      driver_cost_per_hr: costParams.driverCostPerHr,
      toll_avg_per_trip: costParams.tollAvgPerTrip,
      maintenance_cost_per_km: costParams.maintenanceCostPerKm,
    })
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .catch(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings & Configuration</h1>
          <p className="page-subtitle">
            Manage fleet, depots, cost parameters, and system preferences
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? (
            <>
              <Check size={16} /> Saved!
            </>
          ) : (
            <>
              <Save size={16} /> Save Changes
            </>
          )}
        </button>
      </div>

      <div className="page-body">
        <div className="settings-grid">
          {/* Vehicle Fleet */}
          <div className="settings-section" style={{ gridColumn: "1 / -1" }}>
            <div className="settings-section-title">
              <Truck size={18} style={{ color: "var(--lorri-primary)" }} />
              Vehicle Fleet Management
              <button
                className="btn btn-sm btn-primary"
                style={{ marginLeft: "auto" }}
                onClick={() => setShowAddVehicle(true)}
              >
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
                      <td>
                        <span className="badge badge-ghost">{v.type}</span>
                      </td>
                      <td>{v.maxWeightKg.toLocaleString()} kg</td>
                      <td>{v.maxVolumeM3} m³</td>
                      <td style={{ fontFamily: "monospace", fontSize: "12px" }}>
                        {v.lengthCm}×{v.widthCm}×{v.heightCm} cm
                      </td>
                      <td>₹{v.costPerKm}</td>
                      <td>{v.emissionFactor}</td>
                      <td>
                        <span
                          className={`badge ${v.isAvailable ? "badge-success" : "badge-danger"}`}
                        >
                          {v.isAvailable ? "Available" : "Offline"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            className="btn btn-ghost btn-icon"
                            style={{ width: "28px", height: "28px" }}
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon"
                            style={{
                              width: "28px",
                              height: "28px",
                              color: "var(--lorri-danger)",
                            }}
                          >
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
              <MapPin size={18} style={{ color: "#f59e0b" }} />
              Depot Locations
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {depots.map((depot) => (
                <div
                  key={depot.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-secondary)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(245, 158, 11, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MapPin size={16} style={{ color: "#fbbf24" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>
                      {depot.name}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {depot.city} · {depot.lat.toFixed(4)},{" "}
                      {depot.lng.toFixed(4)}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-icon"
                    style={{ width: "28px", height: "28px" }}
                  >
                    <Edit size={13} />
                  </button>
                </div>
              ))}
              <button
                className="btn btn-sm btn-secondary"
                style={{ alignSelf: "flex-start" }}
                onClick={() => setShowAddDepot(true)}
              >
                <Plus size={13} /> Add Depot
              </button>
            </div>
          </div>

          {/* Cost Parameters */}
          <div className="settings-section">
            <div className="settings-section-title">
              <IndianRupee size={18} style={{ color: "#10b981" }} />
              Cost Parameters
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label className="label">Fuel Cost (₹/km)</label>
                <input
                  className="input"
                  type="number"
                  step="0.5"
                  value={costParams.fuelCostPerKm}
                  onChange={(e) =>
                    setCostParams((p) => ({
                      ...p,
                      fuelCostPerKm: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="label">Driver Cost (₹/hr)</label>
                <input
                  className="input"
                  type="number"
                  step="10"
                  value={costParams.driverCostPerHr}
                  onChange={(e) =>
                    setCostParams((p) => ({
                      ...p,
                      driverCostPerHr: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="label">Avg Toll per Trip (₹)</label>
                <input
                  className="input"
                  type="number"
                  step="100"
                  value={costParams.tollAvgPerTrip}
                  onChange={(e) =>
                    setCostParams((p) => ({
                      ...p,
                      tollAvgPerTrip: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="label">Maintenance (₹/km)</label>
                <input
                  className="input"
                  type="number"
                  step="0.5"
                  value={costParams.maintenanceCostPerKm}
                  onChange={(e) =>
                    setCostParams((p) => ({
                      ...p,
                      maintenanceCostPerKm: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Emission Factors */}
          <div className="settings-section">
            <div className="settings-section-title">
              <Leaf size={18} style={{ color: "#06b6d4" }} />
              Emission Factors
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label className="label">
                  Heavy Truck (full) — kg CO₂/ton-km
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.001"
                  defaultValue="0.062"
                />
              </div>
              <div>
                <label className="label">
                  Heavy Truck (empty) — kg CO₂/ton-km
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.001"
                  defaultValue="0.031"
                />
              </div>
              <div>
                <label className="label">Light Truck — kg CO₂/ton-km</label>
                <input
                  className="input"
                  type="number"
                  step="0.001"
                  defaultValue="0.090"
                />
              </div>
              <div>
                <label className="label">Medium Truck — kg CO₂/ton-km</label>
                <input
                  className="input"
                  type="number"
                  step="0.001"
                  defaultValue="0.075"
                />
              </div>
            </div>
          </div>

          {/* API Keys */}
          <div className="settings-section">
            <div className="settings-section-title">
              <Key size={18} style={{ color: "#8b5cf6" }} />
              API Key Management
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label className="label">Groq API Key</label>
                <input
                  className="input"
                  type="password"
                  defaultValue="gsk_••••••••••••••••••••"
                />
              </div>
              <div>
                <label className="label">OpenRouteService API Key</label>
                <input
                  className="input"
                  type="password"
                  defaultValue="5b••••••••••••••••••••••"
                />
              </div>
              <div>
                <label className="label">Supabase URL</label>
                <input
                  className="input"
                  defaultValue="https://your-project.supabase.co"
                />
              </div>
              <div>
                <label className="label">Supabase Anon Key</label>
                <input
                  className="input"
                  type="password"
                  defaultValue="eyJhbGci••••••••••••••••"
                />
              </div>
            </div>
          </div>

          {/* Default Constraints */}
          <div className="settings-section">
            <div className="settings-section-title">
              <SlidersHorizontal size={18} style={{ color: "#f59e0b" }} />
              Default Constraints
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
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
                <input
                  className="input"
                  type="number"
                  step="5"
                  defaultValue="50"
                />
              </div>
              <div>
                <label className="label">Min Samples per Cluster</label>
                <input className="input" type="number" defaultValue="3" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {showAddVehicle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setShowAddVehicle(false)}>
          <div className="card animate-slide-up" style={{ width: "580px", maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <div><div className="card-title">Add New Vehicle</div><div className="card-description">Register a new fleet vehicle</div></div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddVehicle(false)}><span style={{ fontSize: "18px" }}>×</span></button>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div><label className="label">Vehicle Name</label><input className="input" placeholder="e.g. Ashok Leyland 1612" value={newVehicle.name} onChange={(e) => setNewVehicle((p) => ({ ...p, name: e.target.value }))} /></div>
                <div><label className="label">Type</label><select className="input" value={newVehicle.type} onChange={(e) => setNewVehicle((p) => ({ ...p, type: e.target.value }))}><option value="heavy">Heavy</option><option value="medium">Medium</option><option value="light">Light</option></select></div>
                <div><label className="label">Max Weight (kg)</label><input className="input" type="number" value={newVehicle.max_weight_kg} onChange={(e) => setNewVehicle((p) => ({ ...p, max_weight_kg: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="label">Max Volume (m³)</label><input className="input" type="number" value={newVehicle.max_volume_m3} onChange={(e) => setNewVehicle((p) => ({ ...p, max_volume_m3: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="label">Length (cm)</label><input className="input" type="number" value={newVehicle.length_cm} onChange={(e) => setNewVehicle((p) => ({ ...p, length_cm: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="label">Width (cm)</label><input className="input" type="number" value={newVehicle.width_cm} onChange={(e) => setNewVehicle((p) => ({ ...p, width_cm: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="label">Height (cm)</label><input className="input" type="number" value={newVehicle.height_cm} onChange={(e) => setNewVehicle((p) => ({ ...p, height_cm: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="label">Cost per km (₹)</label><input className="input" type="number" value={newVehicle.cost_per_km} onChange={(e) => setNewVehicle((p) => ({ ...p, cost_per_km: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="label">Emission Factor</label><input className="input" type="number" step="0.001" value={newVehicle.emission_factor} onChange={(e) => setNewVehicle((p) => ({ ...p, emission_factor: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
            </div>
            <div className="card-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="btn btn-secondary" onClick={() => setShowAddVehicle(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddVehicle} disabled={addingVehicle || !newVehicle.name}>
                {addingVehicle ? <><div className="loading-spinner" style={{ width: "14px", height: "14px" }} /> Adding...</> : <><Plus size={14} /> Add Vehicle</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Depot Modal */}
      {showAddDepot && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setShowAddDepot(false)}>
          <div className="card animate-slide-up" style={{ width: "480px", maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <div><div className="card-title">Add New Depot</div><div className="card-description">Register a depot location</div></div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddDepot(false)}><span style={{ fontSize: "18px" }}>×</span></button>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div><label className="label">Depot Name</label><input className="input" placeholder="e.g. Mumbai Central Hub" value={newDepot.name} onChange={(e) => setNewDepot((p) => ({ ...p, name: e.target.value }))} /></div>
                <div><label className="label">City</label><input className="input" placeholder="e.g. Mumbai" value={newDepot.city} onChange={(e) => setNewDepot((p) => ({ ...p, city: e.target.value }))} /></div>
                <div><label className="label">Latitude</label><input className="input" type="number" step="0.0001" value={newDepot.lat} onChange={(e) => setNewDepot((p) => ({ ...p, lat: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="label">Longitude</label><input className="input" type="number" step="0.0001" value={newDepot.lng} onChange={(e) => setNewDepot((p) => ({ ...p, lng: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
            </div>
            <div className="card-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="btn btn-secondary" onClick={() => setShowAddDepot(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddDepot} disabled={addingDepot || !newDepot.name || !newDepot.city}>
                {addingDepot ? <><div className="loading-spinner" style={{ width: "14px", height: "14px" }} /> Adding...</> : <><Plus size={14} /> Add Depot</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", padding: "14px 20px", borderRadius: "10px", background: "#0CAF60", color: "white", fontSize: "13px", fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 100, display: "flex", alignItems: "center", gap: "8px", animation: "slide-up 0.3s ease" }}>
          <Check size={16} /> {toast}
        </div>
      )}
    </>
  );
}
