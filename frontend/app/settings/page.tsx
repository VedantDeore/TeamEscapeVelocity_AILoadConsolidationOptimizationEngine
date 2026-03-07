"use client";

import { useState, useEffect } from "react";
import {
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
  ChevronRight,
  Shield,
  Gauge,
  Eye,
  EyeOff,
  CircleDot,
  Warehouse,
  X,
} from "lucide-react";
import {
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

type SettingsTab =
  | "fleet"
  | "depots"
  | "costs"
  | "emissions"
  | "api"
  | "engine";

const TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    id: "fleet",
    label: "Fleet",
    icon: Truck,
    description: "Vehicle management",
  },
  {
    id: "depots",
    label: "Depots",
    icon: Warehouse,
    description: "Warehouse locations",
  },
  {
    id: "costs",
    label: "Cost Model",
    icon: IndianRupee,
    description: "Pricing parameters",
  },
  {
    id: "emissions",
    label: "Emissions",
    icon: Leaf,
    description: "Carbon factors",
  },
  { id: "api", label: "API Keys", icon: Key, description: "Integrations" },
  {
    id: "engine",
    label: "Engine",
    icon: SlidersHorizontal,
    description: "Algorithm config",
  },
];

const VEHICLE_TYPE_COLORS: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  heavy: { bg: "rgba(99,91,255,0.08)", text: "#635BFF", dot: "#635BFF" },
  medium: { bg: "rgba(245,158,11,0.08)", text: "#D97706", dot: "#F59E0B" },
  light: { bg: "rgba(16,185,129,0.08)", text: "#059669", dot: "#10B981" },
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("fleet");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [depots, setDepots] = useState<DepotLocation[]>([]);
  const [costParams, setCostParams] = useState({
    fuelCostPerKm: 0,
    driverCostPerHr: 0,
    tollAvgPerTrip: 0,
    maintenanceCostPerKm: 0,
  });
  const [saved, setSaved] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddDepot, setShowAddDepot] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [addingDepot, setAddingDepot] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [newVehicle, setNewVehicle] = useState({
    name: "",
    type: "heavy",
    max_weight_kg: 0,
    max_volume_m3: 0,
    length_cm: 0,
    width_cm: 0,
    height_cm: 0,
    cost_per_km: 0,
    emission_factor: 0.062,
  });
  const [newDepot, setNewDepot] = useState({
    name: "",
    city: "",
    lat: 0,
    lng: 0,
  });
  const [toast, setToast] = useState<string | null>(null);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const refreshVehicles = () => {
    getVehicles()
      .then((data) => {
        if (data?.length) {
          setVehicles(
            data.map((v: any) => ({
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
            })),
          );
        } else {
          setVehicles([]);
        }
      })
      .catch(() => {
        setVehicles([]);
      });
  };

  const refreshDepots = () => {
    getDepots()
      .then((data) => {
        if (data?.length) setDepots(data);
      })
      .catch(() => {});
  };

  const handleAddVehicle = async () => {
    if (!newVehicle.name) return;
    setAddingVehicle(true);
    try {
      await createVehicle(newVehicle);
      showToastMsg("Vehicle added successfully!");
      setShowAddVehicle(false);
      setNewVehicle({
        name: "",
        type: "heavy",
        max_weight_kg: 0,
        max_volume_m3: 0,
        length_cm: 0,
        width_cm: 0,
        height_cm: 0,
        cost_per_km: 0,
        emission_factor: 0.062,
      });
      refreshVehicles();
    } catch {
      showToastMsg("Failed to add vehicle.");
    } finally {
      setAddingVehicle(false);
    }
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
    } catch {
      showToastMsg("Failed to add depot.");
    } finally {
      setAddingDepot(false);
    }
  };

  useEffect(() => {
    getVehicles()
      .then((data) => {
        if (data?.length) {
          setVehicles(
            data.map((v: any) => ({
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
            })),
          );
        }
      })
      .catch(() => {});
    getDepots()
      .then((data) => {
        if (data?.length) setDepots(data);
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
        } else {
          setCostParams({
            fuelCostPerKm: 0,
            driverCostPerHr: 0,
            tollAvgPerTrip: 0,
            maintenanceCostPerKm: 0,
          });
        }
      })
      .catch(() => {
        setCostParams({
          fuelCostPerKm: 0,
          driverCostPerHr: 0,
          tollAvgPerTrip: 0,
          maintenanceCostPerKm: 0,
        });
      });
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

  const toggleApiVisibility = (key: string) => {
    setShowApiKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fleetStats = {
    total: vehicles.length,
    available: vehicles.filter((v) => v.isAvailable).length,
    totalCapacity: vehicles.reduce((a, v) => a + v.maxWeightKg, 0),
  };

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Manage your fleet, locations, cost model, and system configuration
          </p>
        </div>
        <button
          className={`btn ${saved ? "btn-success" : "btn-primary"}`}
          onClick={handleSave}
        >
          {saved ? (
            <>
              <Check size={15} /> Saved
            </>
          ) : (
            <>
              <Save size={15} /> Save Changes
            </>
          )}
        </button>
      </div>

      <div className="page-body" style={{ padding: 0 }}>
        <div className="stg-layout">
          {/* ── Left: Tab Navigation ── */}
          <nav className="stg-nav">
            <div className="stg-nav-brand">
              <div className="stg-nav-brand-label">Configuration</div>
              <div className="stg-nav-brand-sub">System preferences</div>
            </div>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`stg-nav-item ${isActive ? "stg-nav-item--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <div
                    className={`stg-nav-icon ${isActive ? "stg-nav-icon--active" : ""}`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="stg-nav-text">
                    <span className="stg-nav-label">{tab.label}</span>
                    <span className="stg-nav-desc">{tab.description}</span>
                  </div>
                  <ChevronRight size={14} className="stg-nav-chevron" />
                </button>
              );
            })}
          </nav>

          {/* ── Right: Content ── */}
          <div className="stg-content">
            {/* ═══ Fleet Tab ═══ */}
            {activeTab === "fleet" && (
              <div className="stg-section animate-fade-in">
                {/* Fleet stats row */}
                <div className="stg-stats-row">
                  <div className="stg-stat-card">
                    <div
                      className="stg-stat-icon"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(99,91,255,0.10) 0%, rgba(129,140,248,0.14) 100%)",
                      }}
                    >
                      <Truck size={20} style={{ color: "#635BFF" }} />
                    </div>
                    <div>
                      <div className="stg-stat-value">{fleetStats.total}</div>
                      <div className="stg-stat-label">Total Vehicles</div>
                    </div>
                  </div>
                  <div className="stg-stat-card">
                    <div
                      className="stg-stat-icon"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(12,175,96,0.10) 0%, rgba(6,182,212,0.08) 100%)",
                      }}
                    >
                      <CircleDot size={20} style={{ color: "#0CAF60" }} />
                    </div>
                    <div>
                      <div className="stg-stat-value">
                        {fleetStats.available}
                      </div>
                      <div className="stg-stat-label">Available</div>
                    </div>
                  </div>
                  <div className="stg-stat-card">
                    <div
                      className="stg-stat-icon"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(239,68,68,0.06) 100%)",
                      }}
                    >
                      <Gauge size={20} style={{ color: "#D97706" }} />
                    </div>
                    <div>
                      <div className="stg-stat-value">
                        {(fleetStats.totalCapacity / 1000).toFixed(0)}t
                      </div>
                      <div className="stg-stat-label">Total Capacity</div>
                    </div>
                  </div>
                </div>

                {/* Fleet table */}
                <div className="stg-card">
                  <div className="stg-card-header">
                    <div>
                      <h3 className="stg-card-title">Vehicle Fleet</h3>
                      <p className="stg-card-desc">
                        Manage your registered trucks and transport vehicles
                      </p>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowAddVehicle(true)}
                    >
                      <Plus size={14} /> Add Vehicle
                    </button>
                  </div>
                  <div className="stg-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Vehicle</th>
                          <th>Type</th>
                          <th>Capacity</th>
                          <th>Dimensions</th>
                          <th>Cost</th>
                          <th>CO₂ Factor</th>
                          <th>Status</th>
                          <th style={{ width: 60 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicles.map((v) => {
                          const tc =
                            VEHICLE_TYPE_COLORS[v.type] ||
                            VEHICLE_TYPE_COLORS.heavy;
                          return (
                            <tr key={v.id}>
                              <td>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                  }}
                                >
                                  <div className="stg-vehicle-avatar">
                                    <Truck size={14} />
                                  </div>
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    {v.name}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span
                                  className="stg-type-badge"
                                  style={{ background: tc.bg, color: tc.text }}
                                >
                                  <span
                                    className="stg-type-dot"
                                    style={{ background: tc.dot }}
                                  />
                                  {v.type}
                                </span>
                              </td>
                              <td>
                                <div style={{ lineHeight: 1.5 }}>
                                  <div style={{ fontWeight: 500 }}>
                                    {v.maxWeightKg.toLocaleString()} kg
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "var(--text-tertiary)",
                                    }}
                                  >
                                    {v.maxVolumeM3} m³
                                  </div>
                                </div>
                              </td>
                              <td>
                                <code className="stg-dims">
                                  {v.lengthCm}×{v.widthCm}×{v.heightCm}
                                </code>
                              </td>
                              <td style={{ fontWeight: 500 }}>
                                ₹{v.costPerKm}/km
                              </td>
                              <td>
                                <span
                                  style={{
                                    fontFamily:
                                      "var(--font-geist-mono), monospace",
                                    fontSize: 12.5,
                                  }}
                                >
                                  {v.emissionFactor}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`stg-status ${v.isAvailable ? "stg-status--on" : "stg-status--off"}`}
                                >
                                  <span className="stg-status-dot" />
                                  {v.isAvailable ? "Online" : "Offline"}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 2 }}>
                                  <button
                                    className="btn btn-ghost btn-icon"
                                    style={{ width: 28, height: 28 }}
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-icon"
                                    style={{
                                      width: 28,
                                      height: 28,
                                      color: "var(--lorri-danger)",
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Depots Tab ═══ */}
            {activeTab === "depots" && (
              <div className="stg-section animate-fade-in">
                <div className="stg-card">
                  <div className="stg-card-header">
                    <div>
                      <h3 className="stg-card-title">Depot Locations</h3>
                      <p className="stg-card-desc">
                        Warehouses and dispatch centers across India
                      </p>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowAddDepot(true)}
                    >
                      <Plus size={14} /> Add Depot
                    </button>
                  </div>
                  <div className="stg-depot-grid">
                    {depots.map((depot) => (
                      <div className="stg-depot-card" key={depot.id}>
                        <div className="stg-depot-card-top">
                          <div className="stg-depot-icon">
                            <MapPin size={18} />
                          </div>
                          <button
                            className="btn btn-ghost btn-icon"
                            style={{ width: 28, height: 28 }}
                          >
                            <Edit size={13} />
                          </button>
                        </div>
                        <div className="stg-depot-name">{depot.name}</div>
                        <div className="stg-depot-city">{depot.city}</div>
                        <div className="stg-depot-coords">
                          <MapPin size={10} />
                          {depot.lat.toFixed(4)}, {depot.lng.toFixed(4)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Cost Model Tab ═══ */}
            {activeTab === "costs" && (
              <div className="stg-section animate-fade-in">
                <div className="stg-card">
                  <div className="stg-card-header">
                    <div>
                      <h3 className="stg-card-title">Cost Parameters</h3>
                      <p className="stg-card-desc">
                        Base cost rates used in optimization and reporting
                      </p>
                    </div>
                  </div>
                  <div className="stg-form-grid">
                    <div className="stg-field">
                      <label className="label">Fuel Cost</label>
                      <div className="stg-input-group">
                        <span className="stg-input-prefix">₹</span>
                        <input
                          className="input stg-input-with-prefix"
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
                        <span className="stg-input-suffix">per km</span>
                      </div>
                      <p className="stg-field-hint">
                        Average diesel cost factored into route pricing
                      </p>
                    </div>
                    <div className="stg-field">
                      <label className="label">Driver Cost</label>
                      <div className="stg-input-group">
                        <span className="stg-input-prefix">₹</span>
                        <input
                          className="input stg-input-with-prefix"
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
                        <span className="stg-input-suffix">per hr</span>
                      </div>
                      <p className="stg-field-hint">
                        Hourly driver wages including overtime
                      </p>
                    </div>
                    <div className="stg-field">
                      <label className="label">Toll Average</label>
                      <div className="stg-input-group">
                        <span className="stg-input-prefix">₹</span>
                        <input
                          className="input stg-input-with-prefix"
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
                        <span className="stg-input-suffix">per trip</span>
                      </div>
                      <p className="stg-field-hint">
                        Average toll fees across highways and expressways
                      </p>
                    </div>
                    <div className="stg-field">
                      <label className="label">Maintenance</label>
                      <div className="stg-input-group">
                        <span className="stg-input-prefix">₹</span>
                        <input
                          className="input stg-input-with-prefix"
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
                        <span className="stg-input-suffix">per km</span>
                      </div>
                      <p className="stg-field-hint">
                        Periodic maintenance prorated per kilometer
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Emissions Tab ═══ */}
            {activeTab === "emissions" && (
              <div className="stg-section animate-fade-in">
                <div className="stg-card">
                  <div className="stg-card-header">
                    <div>
                      <h3 className="stg-card-title">Emission Factors</h3>
                      <p className="stg-card-desc">
                        CO₂ output rates per vehicle type — kg CO₂ per ton-km
                      </p>
                    </div>
                  </div>
                  <div className="stg-emission-list">
                    {[
                      {
                        label: "Heavy Truck (loaded)",
                        value: "0.062",
                        color: "#635BFF",
                        pct: 69,
                      },
                      {
                        label: "Heavy Truck (empty)",
                        value: "0.031",
                        color: "#818CF8",
                        pct: 34,
                      },
                      {
                        label: "Medium Truck",
                        value: "0.075",
                        color: "#F59E0B",
                        pct: 83,
                      },
                      {
                        label: "Light Truck",
                        value: "0.090",
                        color: "#EF4444",
                        pct: 100,
                      },
                    ].map((item) => (
                      <div className="stg-emission-row" key={item.label}>
                        <div className="stg-emission-info">
                          <div
                            className="stg-emission-dot"
                            style={{ background: item.color }}
                          />
                          <span className="stg-emission-label">
                            {item.label}
                          </span>
                        </div>
                        <div className="stg-emission-bar-wrap">
                          <div
                            className="stg-emission-bar"
                            style={{
                              width: `${item.pct}%`,
                              background: item.color,
                            }}
                          />
                        </div>
                        <div className="stg-emission-input-wrap">
                          <input
                            className="input"
                            type="number"
                            step="0.001"
                            defaultValue={item.value}
                            style={{ width: 90, textAlign: "right" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ API Keys Tab ═══ */}
            {activeTab === "api" && (
              <div className="stg-section animate-fade-in">
                {/* Security notice */}
                <div className="stg-notice">
                  <Shield
                    size={16}
                    style={{ color: "#635BFF", flexShrink: 0 }}
                  />
                  <div>
                    <strong>Keys are stored server-side.</strong> Values shown
                    here are masked for security. Changes require a backend
                    restart.
                  </div>
                </div>
                <div className="stg-card">
                  <div className="stg-card-header">
                    <div>
                      <h3 className="stg-card-title">
                        API Keys & Integrations
                      </h3>
                      <p className="stg-card-desc">
                        Manage connections to external services
                      </p>
                    </div>
                  </div>
                  <div className="stg-api-list">
                    {[
                      {
                        id: "groq",
                        label: "Groq API Key",
                        desc: "Powers the AI Co-pilot (LLaMA 3.3 70B)",
                        value: "gsk_••••••••••••••••••••",
                        connected: true,
                      },
                      {
                        id: "ors",
                        label: "OpenRouteService",
                        desc: "Route optimization and distance matrix",
                        value: "5b3c••••••••••••••••••",
                        connected: false,
                      },
                      {
                        id: "supabase_url",
                        label: "Supabase URL",
                        desc: "PostgreSQL database endpoint",
                        value: "https://cuhsgq•••.supabase.co",
                        connected: true,
                        isUrl: true,
                      },
                      {
                        id: "supabase_key",
                        label: "Supabase Anon Key",
                        desc: "Public anonymous access key",
                        value: "eyJhbGci••••••••••••••",
                        connected: true,
                      },
                    ].map((api) => (
                      <div className="stg-api-row" key={api.id}>
                        <div className="stg-api-info">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span className="stg-api-label">{api.label}</span>
                            <span
                              className={`stg-api-badge ${api.connected ? "stg-api-badge--on" : "stg-api-badge--off"}`}
                            >
                              {api.connected ? "Connected" : "Not configured"}
                            </span>
                          </div>
                          <div className="stg-api-desc">{api.desc}</div>
                        </div>
                        <div className="stg-api-input-wrap">
                          <input
                            className="input"
                            type={showApiKeys[api.id] ? "text" : "password"}
                            defaultValue={api.value}
                            style={{
                              fontFamily: "var(--font-geist-mono), monospace",
                              fontSize: 12.5,
                            }}
                          />
                          <button
                            className="btn btn-ghost btn-icon stg-api-eye"
                            onClick={() => toggleApiVisibility(api.id)}
                            title={showApiKeys[api.id] ? "Hide" : "Reveal"}
                          >
                            {showApiKeys[api.id] ? (
                              <EyeOff size={14} />
                            ) : (
                              <Eye size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Engine Config Tab ═══ */}
            {activeTab === "engine" && (
              <div className="stg-section animate-fade-in">
                <div className="stg-card">
                  <div className="stg-card-header">
                    <div>
                      <h3 className="stg-card-title">Optimization Engine</h3>
                      <p className="stg-card-desc">
                        Fine-tune clustering, routing, and constraint parameters
                      </p>
                    </div>
                  </div>
                  <div className="stg-form-grid">
                    <div className="stg-field">
                      <label className="label">Clustering Algorithm</label>
                      <select className="input select" defaultValue="dbscan">
                        <option value="dbscan">DBSCAN (Density-Based)</option>
                        <option value="kmeans">K-Means</option>
                        <option value="hierarchical">Hierarchical</option>
                      </select>
                      <p className="stg-field-hint">
                        DBSCAN is recommended for geographic clustering with
                        noise tolerance
                      </p>
                    </div>
                    <div className="stg-field">
                      <label className="label">Max Detour Tolerance</label>
                      <select className="input select" defaultValue="15">
                        <option value="10">10% — Strict</option>
                        <option value="15">15% — Balanced</option>
                        <option value="20">20% — Relaxed</option>
                        <option value="30">30% — Flexible</option>
                      </select>
                      <p className="stg-field-hint">
                        Maximum additional distance allowed vs. direct route
                      </p>
                    </div>
                    <div className="stg-field">
                      <label className="label">DBSCAN Epsilon (km)</label>
                      <input
                        className="input"
                        type="number"
                        step="5"
                        defaultValue="50"
                      />
                      <p className="stg-field-hint">
                        Neighbourhood radius for point clustering — lower =
                        tighter groups
                      </p>
                    </div>
                    <div className="stg-field">
                      <label className="label">Min Cluster Size</label>
                      <input className="input" type="number" defaultValue="3" />
                      <p className="stg-field-hint">
                        Minimum shipments required to form a consolidation group
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Vehicle Modal ── */}
      {showAddVehicle && (
        <div className="stg-overlay" onClick={() => setShowAddVehicle(false)}>
          <div
            className="stg-modal animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stg-modal-header">
              <div>
                <h3 className="stg-card-title">Add Vehicle</h3>
                <p className="stg-card-desc">
                  Register a new fleet vehicle with capacity and cost specs
                </p>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowAddVehicle(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="stg-modal-body">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div className="stg-field">
                  <label className="label">Vehicle Name</label>
                  <input
                    className="input"
                    placeholder="e.g. Ashok Leyland 1612"
                    value={newVehicle.name}
                    onChange={(e) =>
                      setNewVehicle((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">Type</label>
                  <select
                    className="input"
                    value={newVehicle.type}
                    onChange={(e) =>
                      setNewVehicle((p) => ({ ...p, type: e.target.value }))
                    }
                  >
                    <option value="heavy">Heavy</option>
                    <option value="medium">Medium</option>
                    <option value="light">Light</option>
                  </select>
                </div>
                <div className="stg-field">
                  <label className="label">Max Weight (kg)</label>
                  <input
                    className="input"
                    type="number"
                    value={newVehicle.max_weight_kg}
                    onChange={(e) =>
                      setNewVehicle((p) => ({
                        ...p,
                        max_weight_kg: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">Max Volume (m³)</label>
                  <input
                    className="input"
                    type="number"
                    value={newVehicle.max_volume_m3}
                    onChange={(e) =>
                      setNewVehicle((p) => ({
                        ...p,
                        max_volume_m3: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">Length (cm)</label>
                  <input
                    className="input"
                    type="number"
                    value={newVehicle.length_cm}
                    onChange={(e) =>
                      setNewVehicle((p) => ({
                        ...p,
                        length_cm: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">Width (cm)</label>
                  <input
                    className="input"
                    type="number"
                    value={newVehicle.width_cm}
                    onChange={(e) =>
                      setNewVehicle((p) => ({
                        ...p,
                        width_cm: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">Height (cm)</label>
                  <input
                    className="input"
                    type="number"
                    value={newVehicle.height_cm}
                    onChange={(e) =>
                      setNewVehicle((p) => ({
                        ...p,
                        height_cm: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">Cost per km (₹)</label>
                  <input
                    className="input"
                    type="number"
                    value={newVehicle.cost_per_km}
                    onChange={(e) =>
                      setNewVehicle((p) => ({
                        ...p,
                        cost_per_km: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="stg-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="label">
                    Emission Factor (kg CO₂/ton-km)
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="0.001"
                    value={newVehicle.emission_factor}
                    onChange={(e) =>
                      setNewVehicle((p) => ({
                        ...p,
                        emission_factor: parseFloat(e.target.value) || 0,
                      }))
                    }
                    style={{ maxWidth: 200 }}
                  />
                </div>
              </div>
            </div>
            <div className="stg-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowAddVehicle(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddVehicle}
                disabled={addingVehicle || !newVehicle.name}
              >
                {addingVehicle ? (
                  <>
                    <div
                      className="loading-spinner"
                      style={{ width: 14, height: 14 }}
                    />{" "}
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Add Vehicle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Depot Modal ── */}
      {showAddDepot && (
        <div className="stg-overlay" onClick={() => setShowAddDepot(false)}>
          <div
            className="stg-modal animate-slide-up"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stg-modal-header">
              <div>
                <h3 className="stg-card-title">Add Depot</h3>
                <p className="stg-card-desc">
                  Register a new warehouse or dispatch center
                </p>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowAddDepot(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="stg-modal-body">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div className="stg-field">
                  <label className="label">Name</label>
                  <input
                    className="input"
                    placeholder="e.g. Mumbai Central Hub"
                    value={newDepot.name}
                    onChange={(e) =>
                      setNewDepot((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">City</label>
                  <input
                    className="input"
                    placeholder="e.g. Mumbai"
                    value={newDepot.city}
                    onChange={(e) =>
                      setNewDepot((p) => ({ ...p, city: e.target.value }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">Latitude</label>
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    value={newDepot.lat}
                    onChange={(e) =>
                      setNewDepot((p) => ({
                        ...p,
                        lat: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">Longitude</label>
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    value={newDepot.lng}
                    onChange={(e) =>
                      setNewDepot((p) => ({
                        ...p,
                        lng: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <div className="stg-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowAddDepot(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddDepot}
                disabled={addingDepot || !newDepot.name || !newDepot.city}
              >
                {addingDepot ? (
                  <>
                    <div
                      className="loading-spinner"
                      style={{ width: 14, height: 14 }}
                    />{" "}
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Add Depot
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="stg-toast animate-slide-up">
          <Check size={15} /> {toast}
        </div>
      )}
    </>
  );
}
