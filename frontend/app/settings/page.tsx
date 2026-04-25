"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ShieldCheck,
  ShieldX,
  Gauge,
  Eye,
  EyeOff,
  CircleDot,
  Warehouse,
  X,
  Users,
  Phone,
  Mail,
  FileCheck,
  Loader2,
  RefreshCw,
  Calendar,
  BadgeCheck,
  ToggleLeft,
  ToggleRight,
  ZoomIn,
} from "lucide-react";
import { type Vehicle, type DepotLocation } from "@/lib/mock-data";
import {
  getVehicles,
  getDepots,
  getCostParams,
  updateCostParams,
  createVehicle,
  createDepot,
  updateDepot,
  deleteVehicle,
  deleteDepot,
  geocodeAddress,
  updateVehicle,
  getVehicleAvailability,
  releaseDeliveredClusters,
  listDrivers,
  clearDriverTasks,
  freeAllDrivers,
  freeDriver,
  updateDriverProfile,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";

type SettingsTab =
  | "fleet"
  | "drivers"
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
      id: "drivers",
      label: "Drivers",
      icon: Users,
      description: "Driver management",
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
  const [showEditDepot, setShowEditDepot] = useState(false);
  const [editDepot, setEditDepot] = useState({
    id: "",
    name: "",
    city: "",
    lat: 0,
    lng: 0,
  });
  const [savingDepot, setSavingDepot] = useState(false);
  const [releasingClusters, setReleasingClusters] = useState(false);
  const [vehicleAvailability, setVehicleAvailability] = useState<{
    vehicles: Array<{ id: string; name: string; status: string; busy_since?: string | null; busy_until?: string | null; plan_name?: string | null }>;
    available_count: number;
    busy_count: number;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showEditVehicle, setShowEditVehicle] = useState(false);
  const [editVehicle, setEditVehicle] = useState({
    id: "",
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
  const [savingVehicle, setSavingVehicle] = useState(false);

  const [allDrivers, setAllDrivers] = useState<any[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [driverPhotoZoom, setDriverPhotoZoom] = useState(false);
  const [togglingVerify, setTogglingVerify] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const driverFetchRef = useRef(false);

  const refreshDrivers = useCallback(async () => {
    if (driverFetchRef.current) return;
    driverFetchRef.current = true;
    setDriversLoading(true);
    try {
      let loaded = false;
      try {
        const { data, error } = await supabase
          .from("drivers")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && data && data.length > 0) {
          setAllDrivers(data);
          loaded = true;
        }
      } catch { /* fall back to API */ }
      if (!loaded) {
        try {
          const data = await listDrivers();
          setAllDrivers(data || []);
        } catch {
          setAllDrivers([]);
        }
      }
    } finally {
      setDriversLoading(false);
      driverFetchRef.current = false;
    }
  }, []);

  const toggleDriverVerified = async (driver: any) => {
    setTogglingVerify(true);
    try {
      const newVal = !driver.is_verified;
      const { error } = await supabase
        .from("drivers")
        .update({ is_verified: newVal })
        .eq("id", driver.id);
      if (error) throw error;
      setAllDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? { ...d, is_verified: newVal } : d))
      );
      if (selectedDriver?.id === driver.id)
        setSelectedDriver((p: any) => p ? { ...p, is_verified: newVal } : p);
      showToastMsg(newVal ? "Driver verified" : "Verification removed");
    } catch {
      showToastMsg("Failed to update verification");
    } finally {
      setTogglingVerify(false);
    }
  };

  const toggleDriverOnlineAdmin = async (driver: any) => {
    setTogglingOnline(true);
    try {
      const newVal = !driver.is_online;
      const { error } = await supabase
        .from("drivers")
        .update({ is_online: newVal })
        .eq("id", driver.id);
      if (error) throw error;
      setAllDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? { ...d, is_online: newVal } : d))
      );
      if (selectedDriver?.id === driver.id)
        setSelectedDriver((p: any) => p ? { ...p, is_online: newVal } : p);
      showToastMsg(newVal ? "Driver set online" : "Driver set offline");
    } catch {
      showToastMsg("Failed to update status");
    } finally {
      setTogglingOnline(false);
    }
  };

  const deleteDriver = async (driver: any) => {
    if (!confirm(`Remove driver "${driver.name}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from("drivers").delete().eq("id", driver.id);
      if (error) throw error;
      setAllDrivers((prev) => prev.filter((d) => d.id !== driver.id));
      setSelectedDriver(null);
      showToastMsg("Driver removed");
    } catch {
      showToastMsg("Failed to remove driver");
    }
  };

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
      .catch(() => { });
  };

  const refreshVehicleAvailability = () => {
    getVehicleAvailability()
      .then((data) => setVehicleAvailability(data))
      .catch(() => setVehicleAvailability(null));
  };

  const handleAddVehicle = async () => {
    if (!newVehicle.name) return;
    setAddingVehicle(true);
    try {
      await createVehicle(newVehicle);
      showToastMsg("Vehicle added successfully!");
      setShowAddVehicle(false);
      refreshVehicleAvailability();
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

  const openEditVehicle = (v: Vehicle) => {
    setEditVehicle({
      id: v.id,
      name: v.name,
      type: v.type,
      max_weight_kg: v.maxWeightKg,
      max_volume_m3: v.maxVolumeM3,
      length_cm: v.lengthCm,
      width_cm: v.widthCm,
      height_cm: v.heightCm,
      cost_per_km: v.costPerKm,
      emission_factor: v.emissionFactor,
    });
    setShowEditVehicle(true);
  };

  const handleSaveVehicle = async () => {
    if (!editVehicle.name) return;
    setSavingVehicle(true);
    try {
      const { id, ...data } = editVehicle;
      await updateVehicle(id, data);
      showToastMsg("Vehicle updated successfully!");
      setShowEditVehicle(false);
      refreshVehicles();
      refreshVehicleAvailability();
    } catch {
      showToastMsg("Failed to update vehicle.");
    } finally {
      setSavingVehicle(false);
    }
  };

  const openEditDepot = (depot: DepotLocation) => {
    setEditDepot({
      id: depot.id,
      name: depot.name,
      city: depot.city,
      lat: depot.lat ?? 0,
      lng: depot.lng ?? 0,
    });
    setShowEditDepot(true);
  };

  const handleAddDepot = async () => {
    if (!newDepot.name || !newDepot.city) return;
    setAddingDepot(true);
    try {
      // Auto-geocode if lat/lng not set
      let depotData = { ...newDepot };
      if ((!depotData.lat || !depotData.lng) && depotData.city) {
        try {
          const geo = await geocodeAddress(depotData.city);
          if (geo) {
            depotData.lat = geo.lat;
            depotData.lng = geo.lng;
          }
        } catch {
          // Geocoding failed, backend will try again
        }
      }
      await createDepot(depotData);
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

  const handleSaveDepot = async () => {
    if (!editDepot.name || !editDepot.city) return;
    setSavingDepot(true);
    try {
      let depotData = { name: editDepot.name, city: editDepot.city, lat: editDepot.lat, lng: editDepot.lng };
      if ((!depotData.lat || !depotData.lng) && depotData.city) {
        try {
          const geo = await geocodeAddress(depotData.city);
          if (geo) {
            depotData.lat = geo.lat;
            depotData.lng = geo.lng;
          }
        } catch {
          // Geocoding failed, backend will try again
        }
      }
      await updateDepot(editDepot.id, depotData);
      showToastMsg("Depot updated successfully!");
      setShowEditDepot(false);
      refreshDepots();
    } catch {
      showToastMsg("Failed to update depot.");
    } finally {
      setSavingDepot(false);
    }
  };

  useEffect(() => {
    if (activeTab === "fleet") refreshVehicleAvailability();
    if (activeTab === "drivers") refreshDrivers();
  }, [activeTab]);

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
      .catch(() => { });
    getDepots()
      .then((data) => {
        if (data?.length) setDepots(data);
      })
      .catch(() => { });
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

                {/* Truck Availability — dynamic available vs busy */}
                {vehicleAvailability && (
                  <div
                    className="stg-card"
                    style={{
                      marginBottom: 20,
                      background: "linear-gradient(135deg, rgba(14,165,233,0.03) 0%, rgba(6,182,212,0.05) 100%)",
                      border: "1px solid rgba(14,165,233,0.12)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 16,
                      }}
                    >
                      <div>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                          Truck availability
                        </h4>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                          Available for consolidation vs busy on routes (with dates)
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                          <strong>{vehicleAvailability.available_count}</strong> available
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                          <strong>{vehicleAvailability.busy_count}</strong> busy
                        </span>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 12, padding: "6px 12px" }}
                          disabled={releasingClusters || vehicleAvailability.busy_count === 0}
                          onClick={async () => {
                            setReleasingClusters(true);
                            try {
                              const r = await releaseDeliveredClusters(false);
                              showToastMsg(r?.message || `${r?.released ?? 0} trucks released`);
                              refreshVehicleAvailability();
                            } catch (e: any) {
                              showToastMsg(e?.message || "Failed to release clusters");
                            } finally {
                              setReleasingClusters(false);
                            }
                          }}
                        >
                          {releasingClusters ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <div className="loading-spinner" style={{ width: 12, height: 12 }} />
                              Releasing...
                            </span>
                          ) : (
                            "Release delivered clusters"
                          )}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: "6px 10px", opacity: 0.9 }}
                          disabled={releasingClusters || vehicleAvailability.busy_count === 0}
                          title="Mark all busy clusters as delivered without checking shipment status (use when you know all shipments are done)"
                          onClick={async () => {
                            if (!confirm("Force release all busy trucks? This marks all busy clusters as delivered without checking shipment status. Use only when you know all shipments are done.")) return;
                            setReleasingClusters(true);
                            try {
                              const r = await releaseDeliveredClusters(true);
                              showToastMsg(r?.message || `${r?.released ?? 0} trucks released`);
                              refreshVehicleAvailability();
                            } catch (e: any) {
                              showToastMsg(e?.message || "Failed to force-release clusters");
                            } finally {
                              setReleasingClusters(false);
                            }
                          }}
                        >
                          Force release all
                        </button>
                      </div>
                    </div>
                    {vehicleAvailability.busy_count > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(14,165,233,0.1)" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                          Busy trucks (from → until)
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                          {vehicleAvailability.vehicles
                            .filter((v) => v.status === "busy")
                            .map((v) => (
                              <div
                                key={v.id}
                                style={{
                                  padding: "8px 12px",
                                  background: "rgba(245,158,11,0.08)",
                                  borderRadius: "var(--radius-md)",
                                  border: "1px solid rgba(245,158,11,0.15)",
                                  fontSize: 12,
                                }}
                              >
                                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{v.name}</div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                  From: {v.busy_since || "—"} → {v.busy_until || "In progress"}
                                </div>
                                {v.plan_name && (
                                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                                    Plan: {v.plan_name}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                        <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>
                          Add more trucks if availability is low during peak consolidation runs.
                        </p>
                      </div>
                    )}
                    {vehicleAvailability.available_count > 0 && vehicleAvailability.busy_count === 0 && (
                      <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                        All trucks are available for consolidation.
                      </p>
                    )}
                  </div>
                )}

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
                          const archived = v.isAvailable === false;
                          return (
                            <tr
                              key={v.id}
                              style={archived ? { opacity: 0.5 } : undefined}
                            >
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
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        color: "var(--text-primary)",
                                        textDecoration: archived
                                          ? "line-through"
                                          : undefined,
                                      }}
                                    >
                                      {v.name}
                                    </span>
                                    {archived && (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          color: "var(--lorri-danger)",
                                          fontWeight: 700,
                                          letterSpacing: "0.5px",
                                        }}
                                      >
                                        ARCHIVED
                                      </span>
                                    )}
                                  </div>
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
                                  className={`stg-status ${archived ? "stg-status--off" : v.isAvailable ? "stg-status--on" : "stg-status--off"}`}
                                >
                                  <span className="stg-status-dot" />
                                  {archived
                                    ? "Archived"
                                    : v.isAvailable
                                      ? "Online"
                                      : "Offline"}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 2 }}>
                                  <button
                                    className="btn btn-ghost btn-icon"
                                    style={{ width: 28, height: 28 }}
                                    title="Edit vehicle"
                                    onClick={() => openEditVehicle(v)}
                                  >
                                    <Edit size={13} />
                                  </button>
                                  {!archived ? (
                                    <button
                                      className="btn btn-ghost btn-icon"
                                      style={{
                                        width: 28,
                                        height: 28,
                                        color: "var(--lorri-danger)",
                                      }}
                                      title="Archive vehicle"
                                      onClick={async () => {
                                        if (
                                          !confirm(
                                            `Archive vehicle "${v.name}"? It will be marked as archived but kept in history.`,
                                          )
                                        )
                                          return;
                                        try {
                                          await deleteVehicle(v.id);
                                          showToastMsg("Vehicle archived");
                                          refreshVehicles();
                                        } catch {
                                          showToastMsg(
                                            "Failed to archive vehicle",
                                          );
                                        }
                                      }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  ) : (
                                    <button
                                      className="btn btn-ghost btn-icon"
                                      style={{
                                        width: 28,
                                        height: 28,
                                        color: "var(--lorri-success, #10b981)",
                                      }}
                                      title="Restore vehicle"
                                      onClick={async () => {
                                        try {
                                          await updateVehicle(v.id, {
                                            is_available: true,
                                          });
                                          showToastMsg("Vehicle restored");
                                          refreshVehicles();
                                          refreshVehicleAvailability();
                                        } catch {
                                          showToastMsg(
                                            "Failed to restore vehicle",
                                          );
                                        }
                                      }}
                                    >
                                      <Check size={13} />
                                    </button>
                                  )}
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

            {/* ═══ Drivers Tab ═══ */}
            {activeTab === "drivers" && (
              <div className="stg-section animate-fade-in">
                {/* Stats row */}
                <div className="stg-stats-row">
                  <div className="stg-stat-card">
                    <div className="stg-stat-icon" style={{ background: "linear-gradient(135deg, rgba(99,91,255,0.12), rgba(129,140,248,0.08))", color: "#635BFF" }}>
                      <Users size={22} />
                    </div>
                    <div>
                      <div className="stg-stat-value">{allDrivers.length}</div>
                      <div className="stg-stat-label">Total Drivers</div>
                    </div>
                  </div>
                  <div className="stg-stat-card">
                    <div className="stg-stat-icon" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.08))", color: "#10b981" }}>
                      <CircleDot size={22} />
                    </div>
                    <div>
                      <div className="stg-stat-value">{allDrivers.filter(d => d.is_online).length}</div>
                      <div className="stg-stat-label">Online Now</div>
                    </div>
                  </div>
                  <div className="stg-stat-card">
                    <div className="stg-stat-icon" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(239,68,68,0.08))", color: "#f59e0b" }}>
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <div className="stg-stat-value">{allDrivers.filter(d => d.is_verified).length}</div>
                      <div className="stg-stat-label">Verified</div>
                    </div>
                  </div>
                </div>

                {/* Header bar */}
                <div className="stg-card" style={{ marginBottom: 20 }}>
                  <div className="stg-card-header">
                    <div>
                      <h3 className="stg-card-title">Registered Drivers</h3>
                      <p className="stg-card-desc">
                        {allDrivers.length} driver{allDrivers.length !== 1 ? "s" : ""} synced from Supabase &middot; Click a card to manage
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => {
                          clearDriverTasks(true).then(() => showToastMsg("Old tasks cleared")).catch(() => {});
                        }}
                        className="btn btn-sm"
                        style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#ef4444" }}
                      >
                        <Trash2 size={13} /> Clear Tasks
                      </button>
                      <button
                        onClick={() => {
                          freeAllDrivers().then((res) => {
                            showToastMsg(`${res.freed} driver(s) freed to home`);
                            refreshDrivers();
                          }).catch(() => {});
                        }}
                        className="btn btn-sm"
                        style={{ border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.06)", color: "#10b981" }}
                      >
                        <MapPin size={13} /> Free All Drivers
                      </button>
                      <button onClick={refreshDrivers} className="btn btn-secondary btn-sm">
                        <RefreshCw size={13} className={driversLoading ? "spin" : ""} /> Refresh
                      </button>
                    </div>
                  </div>
                </div>

                {driversLoading ? (
                  <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
                    <Loader2 size={28} style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
                    <p style={{ fontSize: 13, fontWeight: 500 }}>Loading drivers from Supabase...</p>
                  </div>
                ) : allDrivers.length === 0 ? (
                  <div className="stg-card" style={{ textAlign: "center", padding: "60px 24px" }}>
                    <Users size={44} style={{ margin: "0 auto 14px", opacity: 0.15, color: "var(--lorri-primary)" }} />
                    <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>No Drivers Registered</p>
                    <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                      Drivers can sign up at <span style={{ color: "#635BFF", fontWeight: 600 }}>/driver/register</span>
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                      gap: 20,
                    }}
                  >
                    {allDrivers.map((driver) => (
                      <div
                        key={driver.id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDriver(driver); } }}
                        onClick={() => setSelectedDriver(driver)}
                        style={{
                          background: "var(--bg-card, #fff)",
                          border: "1px solid var(--border-primary)",
                          borderRadius: 16,
                          overflow: "hidden",
                          cursor: "pointer",
                          transition: "box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
                          display: "flex",
                          flexDirection: "column",
                          boxShadow: "var(--shadow-sm)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = "0 8px 28px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)";
                          e.currentTarget.style.borderColor = "rgba(99, 91, 255, 0.18)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "";
                          e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                          e.currentTarget.style.borderColor = "var(--border-primary)";
                        }}
                      >
                        <div
                          style={{
                            height: 3,
                            background: driver.is_verified
                              ? "linear-gradient(90deg, #635BFF, #7c3aed, #0ea5e9)"
                              : "linear-gradient(90deg, #e2e8f0, #f1f5f9)",
                          }}
                        />

                        <div style={{ padding: "20px 20px 0", display: "flex", gap: 16, alignItems: "flex-start" }}>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            {driver.avatar_url ? (
                              <img
                                src={driver.avatar_url}
                                alt=""
                                style={{
                                  width: 64,
                                  height: 64,
                                  borderRadius: 16,
                                  objectFit: "cover",
                                  border: "1px solid var(--border-primary)",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 64,
                                  height: 64,
                                  borderRadius: 16,
                                  background: "linear-gradient(145deg, #635BFF 0%, #8b5cf6 100%)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 24,
                                  fontWeight: 800,
                                  color: "#fff",
                                }}
                              >
                                {driver.name?.charAt(0)?.toUpperCase() || "D"}
                              </div>
                            )}
                            <span
                              style={{
                                position: "absolute",
                                bottom: 2,
                                right: 2,
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                background: driver.is_online ? "#10b981" : "#94a3b8",
                                border: "2px solid var(--bg-card, #fff)",
                                boxShadow: driver.is_online ? "0 0 0 1px rgba(16, 185, 129, 0.35)" : "none",
                              }}
                            />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                              <span
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: "var(--text-primary)",
                                  letterSpacing: "-0.02em",
                                }}
                              >
                                {driver.name}
                              </span>
                              {driver.is_verified && <BadgeCheck size={18} style={{ color: "#6366f1", flexShrink: 0 }} />}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                                <Phone size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0, opacity: 0.85 }} />
                                <span style={{ fontWeight: 500 }}>{driver.phone}</span>
                              </div>
                              {driver.email && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-tertiary)" }}>
                                  <Mail size={13} style={{ flexShrink: 0, opacity: 0.8 }} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{driver.email}</span>
                                </div>
                              )}
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "4px 10px",
                                  borderRadius: 999,
                                  background: driver.is_verified ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                                  color: driver.is_verified ? "#047857" : "#b45309",
                                  border: `1px solid ${driver.is_verified ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)"}`,
                                }}
                              >
                                {driver.is_verified ? "Verified" : "Pending review"}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "4px 10px",
                                  borderRadius: 999,
                                  background: driver.is_online ? "rgba(16, 185, 129, 0.08)" : "rgba(100, 116, 139, 0.08)",
                                  color: driver.is_online ? "#047857" : "#64748b",
                                  border: `1px solid ${driver.is_online ? "rgba(16, 185, 129, 0.16)" : "rgba(100, 116, 139, 0.12)"}`,
                                }}
                              >
                                {driver.is_online ? "Online" : "Offline"}
                              </span>
                              {driver.driver_status && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    background: driver.driver_status === "idle_at_home" ? "rgba(16,185,129,0.08)" :
                                      driver.driver_status === "idle_at_depot" ? "rgba(245,158,11,0.08)" :
                                      driver.driver_status === "assigned" ? "rgba(99,91,255,0.08)" :
                                      "rgba(14,165,233,0.08)",
                                    color: driver.driver_status === "idle_at_home" ? "#047857" :
                                      driver.driver_status === "idle_at_depot" ? "#b45309" :
                                      driver.driver_status === "assigned" ? "#635BFF" :
                                      "#0ea5e9",
                                    border: `1px solid ${driver.driver_status === "idle_at_home" ? "rgba(16,185,129,0.16)" :
                                      driver.driver_status === "idle_at_depot" ? "rgba(245,158,11,0.16)" :
                                      "rgba(99,91,255,0.16)"}`,
                                  }}
                                >
                                  {driver.driver_status === "idle_at_home" ? "At Home" :
                                   driver.driver_status === "idle_at_depot" ? `At Depot${driver.current_city ? ` (${driver.current_city})` : ""}` :
                                   driver.driver_status === "assigned" ? "Assigned" :
                                   driver.driver_status === "en_route" ? "En Route" : driver.driver_status}
                                </span>
                              )}
                              {driver.driver_status === "idle_at_depot" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    freeDriver(driver.id).then(() => {
                                      showToastMsg(`${driver.name} freed to home`);
                                      refreshDrivers();
                                    }).catch(() => {});
                                  }}
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                    border: "1px solid rgba(16,185,129,0.3)",
                                    background: "rgba(16,185,129,0.06)",
                                    color: "#10b981",
                                    cursor: "pointer",
                                  }}
                                >
                                  Free
                                </button>
                              )}
                              {driver.license_number && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    padding: "4px 10px",
                                    borderRadius: 8,
                                    background: "var(--bg-secondary)",
                                    color: "var(--text-secondary)",
                                    border: "1px solid var(--border-secondary)",
                                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                                    maxWidth: "100%",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                  title={driver.license_number}
                                >
                                  {driver.license_number}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "16px 20px 18px",
                            marginTop: 4,
                          }}
                        >
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                            <ChevronRight size={14} style={{ opacity: 0.5 }} />
                            Open profile
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleDriverVerified(driver); }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "8px 14px",
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 600,
                              border: "none",
                              cursor: "pointer",
                              background: driver.is_verified
                                ? "var(--bg-secondary)"
                                : "linear-gradient(135deg, #635BFF, #7c3aed)",
                              color: driver.is_verified ? "var(--text-secondary)" : "#fff",
                              boxShadow: driver.is_verified ? "none" : "0 2px 8px rgba(99, 91, 255, 0.25)",
                            }}
                          >
                            {driver.is_verified ? <ShieldX size={14} /> : <ShieldCheck size={14} />}
                            {driver.is_verified ? "Revoke" : "Verify"}
                          </button>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "12px 20px",
                            borderTop: "1px solid var(--border-secondary)",
                            background: "var(--bg-secondary)",
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                          }}
                        >
                          <code
                            style={{
                              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                              fontSize: 11,
                              background: "var(--bg-tertiary)",
                              padding: "2px 8px",
                              borderRadius: 6,
                              color: "var(--text-tertiary)",
                            }}
                          >
                            {driver.id?.slice(0, 8)}…
                          </code>
                          {driver.created_at && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Calendar size={11} style={{ opacity: 0.7 }} />
                              {new Date(driver.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ═══ Driver Detail Modal ═══ */}
                {selectedDriver && (
                  <div
                    className="stg-overlay"
                    onClick={() => { setSelectedDriver(null); setDriverPhotoZoom(false); }}
                  >
                    <div
                      className="stg-modal"
                      style={{
                        width: 480,
                        maxWidth: "min(94vw, 480px)",
                        maxHeight: "min(90vh, 720px)",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        borderRadius: 16,
                        padding: 0,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          flexShrink: 0,
                          minHeight: 100,
                          background: selectedDriver.is_online
                            ? "linear-gradient(160deg, #4f46e5 0%, #6366f1 45%, #22d3ee 100%)"
                            : "linear-gradient(160deg, #64748b 0%, #94a3b8 100%)",
                          position: "relative",
                        }}
                      >
                        <button
                          type="button"
                          aria-label="Close"
                          onClick={() => { setSelectedDriver(null); setDriverPhotoZoom(false); }}
                          style={{
                            position: "absolute",
                            top: 12,
                            right: 12,
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: "rgba(255,255,255,0.2)",
                            backdropFilter: "blur(6px)",
                            border: "1px solid rgba(255,255,255,0.25)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                          }}
                        >
                          <X size={16} />
                        </button>
                        <div
                          style={{
                            position: "absolute",
                            top: 14,
                            left: 16,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 12px",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.2)",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#fff",
                            letterSpacing: "0.02em",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: selectedDriver.is_online ? "#4ade80" : "rgba(255,255,255,0.55)",
                            }}
                          />
                          {selectedDriver.is_online ? "Active" : "Inactive"}
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "center", marginTop: -40, position: "relative", zIndex: 2, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => { if (selectedDriver.avatar_url) setDriverPhotoZoom(true); }}
                          style={{
                            position: "relative",
                            padding: 0,
                            border: "none",
                            background: "none",
                            cursor: selectedDriver.avatar_url ? "zoom-in" : "default",
                            borderRadius: "50%",
                          }}
                        >
                          {selectedDriver.avatar_url ? (
                            <img
                              src={selectedDriver.avatar_url}
                              alt=""
                              style={{
                                width: 88,
                                height: 88,
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: "4px solid #fff",
                                boxShadow: "0 4px 20px rgba(15, 23, 42, 0.12)",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 88,
                                height: 88,
                                borderRadius: "50%",
                                background: "linear-gradient(145deg, #6366f1, #8b5cf6)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 32,
                                fontWeight: 800,
                                color: "#fff",
                                border: "4px solid #fff",
                                boxShadow: "0 4px 20px rgba(99, 102, 241, 0.25)",
                              }}
                            >
                              {selectedDriver.name?.charAt(0)?.toUpperCase() || "D"}
                            </div>
                          )}
                          {selectedDriver.avatar_url && (
                            <span
                              style={{
                                position: "absolute",
                                bottom: 2,
                                right: 2,
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: "#fff",
                                border: "1px solid var(--border-primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--text-secondary)",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                              }}
                            >
                              <ZoomIn size={14} />
                            </span>
                          )}
                        </button>
                      </div>

                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          overflowY: "auto",
                          padding: "4px 24px 24px",
                        }}
                      >
                        <div style={{ textAlign: "center", marginBottom: 20, paddingTop: 4 }}>
                          <h2
                            style={{
                              fontSize: 20,
                              fontWeight: 800,
                              color: "var(--text-primary)",
                              letterSpacing: "-0.02em",
                              margin: "0 0 6px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                            }}
                          >
                            {selectedDriver.name}
                            {selectedDriver.is_verified && <BadgeCheck size={22} style={{ color: "#6366f1" }} />}
                          </h2>
                          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, lineHeight: 1.5 }}>
                            Tap the photo to view full size
                            {selectedDriver.avatar_url ? "" : " (no photo uploaded)"}
                          </p>
                        </div>

                        <div
                          style={{
                            background: "var(--bg-primary)",
                            borderRadius: 12,
                            border: "1px solid var(--border-secondary)",
                            marginBottom: 20,
                            overflow: "hidden",
                          }}
                        >
                          {[
                            { label: "System ID", value: selectedDriver.id, mono: true },
                            { label: "Phone", value: selectedDriver.phone || "—" },
                            { label: "Email", value: selectedDriver.email || "—" },
                            { label: "License", value: selectedDriver.license_number || "—", mono: true },
                            { label: "Home Address", value: selectedDriver.home_address || "—" },
                            { label: "Home City", value: selectedDriver.home_city || "—" },
                            { label: "Driver Status", value:
                              selectedDriver.driver_status === "idle_at_home" ? "At Home" :
                              selectedDriver.driver_status === "idle_at_depot" ? `At Depot${selectedDriver.current_city ? ` (${selectedDriver.current_city})` : ""}` :
                              selectedDriver.driver_status === "assigned" ? "Assigned" :
                              selectedDriver.driver_status === "en_route" ? "En Route" :
                              selectedDriver.driver_status || "—"
                            },
                            { label: "Current City", value: selectedDriver.current_city || "—" },
                            { label: "Home Coords", value: selectedDriver.home_lat && selectedDriver.home_lng ? `${selectedDriver.home_lat.toFixed(4)}, ${selectedDriver.home_lng.toFixed(4)}` : "—", mono: true },
                            { label: "Current Coords", value: selectedDriver.current_lat && selectedDriver.current_lng ? `${selectedDriver.current_lat.toFixed(4)}, ${selectedDriver.current_lng.toFixed(4)}` : "—", mono: true },
                            {
                              label: "Registered",
                              value: selectedDriver.created_at
                                ? new Date(selectedDriver.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                                : "—",
                            },
                            {
                              label: "Last updated",
                              value: selectedDriver.updated_at
                                ? new Date(selectedDriver.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
                                : "—",
                            },
                          ].map((row, i, arr) => (
                            <div
                              key={row.label}
                              style={{
                                padding: "12px 16px",
                                borderBottom: i < arr.length - 1 ? "1px solid var(--border-secondary)" : "none",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  color: "var(--text-tertiary)",
                                  marginBottom: 4,
                                }}
                              >
                                {row.label}
                              </div>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 500,
                                  color: "var(--text-primary)",
                                  wordBreak: row.mono ? "break-all" : "break-word",
                                  fontFamily: row.mono
                                    ? "var(--font-geist-mono), ui-monospace, monospace"
                                    : "inherit",
                                  lineHeight: 1.45,
                                }}
                              >
                                {row.value}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              padding: "16px 18px",
                              borderRadius: 12,
                              background: "var(--bg-secondary)",
                              border: "1px solid var(--border-primary)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
                              {selectedDriver.is_verified ? (
                                <ShieldCheck size={20} style={{ color: "#059669", marginTop: 2, flexShrink: 0 }} />
                              ) : (
                                <ShieldX size={20} style={{ color: "#d97706", marginTop: 2, flexShrink: 0 }} />
                              )}
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 650, color: "var(--text-primary)" }}>
                                  {selectedDriver.is_verified ? "Verified" : "Verification pending"}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, lineHeight: 1.4 }}>
                                  {selectedDriver.is_verified
                                    ? "Identity confirmed. You can revoke if documents change."
                                    : "Approve this driver after checking ID and license."}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleDriverVerified(selectedDriver)}
                              disabled={togglingVerify}
                              className="btn btn-sm"
                              style={{
                                flexShrink: 0,
                                marginLeft: "auto",
                                minWidth: 100,
                                justifyContent: "center",
                                background: selectedDriver.is_verified ? "var(--bg-primary)" : "linear-gradient(135deg, #635BFF, #7c3aed)",
                                color: selectedDriver.is_verified ? "var(--text-secondary)" : "#fff",
                                border: selectedDriver.is_verified ? "1px solid var(--border-primary)" : "none",
                                boxShadow: selectedDriver.is_verified ? "none" : "0 2px 8px rgba(99, 91, 255, 0.2)",
                                opacity: togglingVerify ? 0.6 : 1,
                              }}
                            >
                              {togglingVerify ? <Loader2 size={14} className="spin" /> : selectedDriver.is_verified ? <ShieldX size={14} /> : <ShieldCheck size={14} />}
                              {selectedDriver.is_verified ? "Revoke" : "Verify"}
                            </button>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              padding: "16px 18px",
                              borderRadius: 12,
                              background: "var(--bg-primary)",
                              border: "1px solid var(--border-secondary)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
                              {selectedDriver.is_online ? (
                                <ToggleRight size={20} style={{ color: "#059669", flexShrink: 0, marginTop: 2 }} />
                              ) : (
                                <ToggleLeft size={20} style={{ color: "var(--text-tertiary)", flexShrink: 0, marginTop: 2 }} />
                              )}
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 650, color: "var(--text-primary)" }}>Presence</div>
                                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                                  {selectedDriver.is_online ? "Shown as available for dispatch" : "Shown as not on duty"}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleDriverOnlineAdmin(selectedDriver)}
                              disabled={togglingOnline}
                              className="btn btn-secondary btn-sm"
                              style={{ flexShrink: 0, marginLeft: "auto", minWidth: 120, justifyContent: "center", opacity: togglingOnline ? 0.6 : 1 }}
                            >
                              {togglingOnline ? <Loader2 size={14} className="spin" /> : selectedDriver.is_online ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                              {selectedDriver.is_online ? "Set offline" : "Set online"}
                            </button>
                          </div>
                        </div>

                        {/* ─── Admin Edit Section ─── */}
                        <div
                          style={{
                            padding: "16px 18px",
                            borderRadius: 12,
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--border-primary)",
                          }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                            <Edit size={14} style={{ color: "#635BFF" }} /> Edit Driver Details
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div>
                              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" }}>Name</label>
                              <input
                                defaultValue={selectedDriver.name || ""}
                                id="admin-edit-name"
                                className="input"
                                style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" }}>Email</label>
                              <input
                                defaultValue={selectedDriver.email || ""}
                                id="admin-edit-email"
                                className="input"
                                style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" }}>License Number</label>
                              <input
                                defaultValue={selectedDriver.license_number || ""}
                                id="admin-edit-license"
                                className="input"
                                style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" }}>Home Address</label>
                              <input
                                defaultValue={selectedDriver.home_address || ""}
                                id="admin-edit-home-address"
                                placeholder="e.g. Andheri East, Mumbai, Maharashtra"
                                className="input"
                                style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                              />
                              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3 }}>
                                Changing this will re-geocode and update home city/coordinates
                              </div>
                            </div>
                            <div>
                              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" }}>Driver Status</label>
                              <select
                                defaultValue={selectedDriver.driver_status || "idle_at_home"}
                                id="admin-edit-status"
                                className="input"
                                style={{ width: "100%", fontSize: 13, padding: "8px 12px", cursor: "pointer" }}
                              >
                                <option value="idle_at_home">Idle at Home</option>
                                <option value="idle_at_depot">Idle at Depot</option>
                                <option value="assigned">Assigned</option>
                                <option value="en_route">En Route</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" }}>Current City (manual override)</label>
                              <input
                                defaultValue={selectedDriver.current_city || ""}
                                id="admin-edit-current-city"
                                placeholder="e.g. Pune"
                                className="input"
                                style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const name = (document.getElementById("admin-edit-name") as HTMLInputElement)?.value?.trim();
                                const email = (document.getElementById("admin-edit-email") as HTMLInputElement)?.value?.trim();
                                const license = (document.getElementById("admin-edit-license") as HTMLInputElement)?.value?.trim();
                                const homeAddr = (document.getElementById("admin-edit-home-address") as HTMLInputElement)?.value?.trim();
                                const status = (document.getElementById("admin-edit-status") as HTMLSelectElement)?.value;
                                const currentCity = (document.getElementById("admin-edit-current-city") as HTMLInputElement)?.value?.trim();
                                const payload: Record<string, any> = {};
                                if (name && name !== selectedDriver.name) payload.name = name;
                                if (email !== (selectedDriver.email || "")) payload.email = email;
                                if (license !== (selectedDriver.license_number || "")) payload.license_number = license;
                                if (homeAddr && homeAddr !== (selectedDriver.home_address || "")) payload.home_address = homeAddr;
                                if (status && status !== selectedDriver.driver_status) payload.driver_status = status;
                                if (currentCity !== (selectedDriver.current_city || "")) payload.current_city = currentCity;
                                if (Object.keys(payload).length === 0) {
                                  showToastMsg("No changes to save");
                                  return;
                                }
                                updateDriverProfile(selectedDriver.id, payload).then((updated) => {
                                  showToastMsg("Driver updated successfully");
                                  setSelectedDriver({ ...selectedDriver, ...updated });
                                  refreshDrivers();
                                }).catch(() => showToastMsg("Failed to update driver"));
                              }}
                              className="btn btn-primary btn-sm"
                              style={{ alignSelf: "flex-start", marginTop: 4 }}
                            >
                              <Save size={13} /> Save Changes
                            </button>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "14px 16px",
                            borderRadius: 12,
                            background: "rgba(239, 68, 68, 0.04)",
                            border: "1px solid rgba(239, 68, 68, 0.12)",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 650, color: "#b91c1c" }}>Remove from fleet</div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, maxWidth: 280 }}>
                              Deletes the driver record in Supabase. This cannot be undone.
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteDriver(selectedDriver)}
                            className="btn btn-sm"
                            style={{
                              background: "rgba(239, 68, 68, 0.08)",
                              color: "#dc2626",
                              border: "1px solid rgba(239, 68, 68, 0.25)",
                            }}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </div>
                      </div>
                    </div>

                    {driverPhotoZoom && selectedDriver.avatar_url && (
                      <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Profile photo"
                        onClick={() => setDriverPhotoZoom(false)}
                        style={{
                          position: "fixed",
                          inset: 0,
                          zIndex: 200,
                          background: "rgba(2, 6, 23, 0.88)",
                          backdropFilter: "blur(10px)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 24,
                          cursor: "zoom-out",
                        }}
                      >
                        <img
                          src={selectedDriver.avatar_url}
                          alt=""
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            maxWidth: "min(90vw, 520px)",
                            maxHeight: "85vh",
                            width: "auto",
                            height: "auto",
                            borderRadius: 12,
                            objectFit: "contain",
                            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                            cursor: "default",
                          }}
                        />
                        <button
                          type="button"
                          aria-label="Close photo"
                          onClick={(e) => { e.stopPropagation(); setDriverPhotoZoom(false); }}
                          style={{
                            position: "fixed",
                            top: 20,
                            right: 20,
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: "rgba(255, 255, 255, 0.12)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <X size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
                          <div style={{ display: "flex", gap: 2 }}>
                            <button
                              className="btn btn-ghost btn-icon"
                              style={{ width: 28, height: 28 }}
                              onClick={() => openEditDepot(depot)}
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
                              onClick={async () => {
                                if (!confirm(`Delete depot "${depot.name}"?`))
                                  return;
                                try {
                                  await deleteDepot(depot.id);
                                  showToastMsg("Depot deleted");
                                  refreshDepots();
                                } catch {
                                  showToastMsg("Failed to delete depot");
                                }
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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
            style={{ maxWidth: 720 }}
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
              {/* Quick presets */}
              <div
                style={{
                  marginBottom: 16,
                  padding: "12px 16px",
                  background: "rgba(99,91,255,0.04)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(99,91,255,0.10)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#635BFF",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: 8,
                  }}
                >
                  🚛 Quick Presets
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    // -- LIGHT COMMERCIAL VEHICLES (LCV) < 3T --
                    {
                      label: "Tata Ace Gold (Light)",
                      type: "light",
                      max_weight_kg: 750,
                      max_volume_m3: 4.7,
                      length_cm: 210,
                      width_cm: 150,
                      height_cm: 150,
                      cost_per_km: 8,
                      emission_factor: 0.035,
                    },
                    {
                      label: "Mahindra Bolero Pik-Up (Light)",
                      type: "light",
                      max_weight_kg: 1500,
                      max_volume_m3: 7.2,
                      length_cm: 250,
                      width_cm: 170,
                      height_cm: 170,
                      cost_per_km: 10,
                      emission_factor: 0.038,
                    },
                    {
                      label: "Ashok Leyland Dost+ (Light)",
                      type: "light",
                      max_weight_kg: 1500,
                      max_volume_m3: 6.8,
                      length_cm: 250,
                      width_cm: 165,
                      height_cm: 165,
                      cost_per_km: 10,
                      emission_factor: 0.038,
                    },
                    // -- INTERMEDIATE & MEDIUM COMMERCIAL VEHICLES (ICV/MCV) 3T - 10T --
                    {
                      label: "Tata 407 (Medium)",
                      type: "medium",
                      max_weight_kg: 2500,
                      max_volume_m3: 9.7,
                      length_cm: 300,
                      width_cm: 180,
                      height_cm: 180,
                      cost_per_km: 14,
                      emission_factor: 0.045,
                    },
                    {
                      label: "Eicher Pro 2049 (Medium)",
                      type: "medium",
                      max_weight_kg: 5000,
                      max_volume_m3: 19.8,
                      length_cm: 430,
                      width_cm: 215,
                      height_cm: 215,
                      cost_per_km: 18,
                      emission_factor: 0.048,
                    },
                    {
                      label: "Tata LPT 1109 (Medium)",
                      type: "medium",
                      max_weight_kg: 7000,
                      max_volume_m3: 24.2,
                      length_cm: 500,
                      width_cm: 220,
                      height_cm: 220,
                      cost_per_km: 22,
                      emission_factor: 0.052,
                    },
                    {
                      label: "BharatBenz 1215C (Medium)",
                      type: "medium",
                      max_weight_kg: 9000,
                      max_volume_m3: 31.7,
                      length_cm: 600,
                      width_cm: 230,
                      height_cm: 230,
                      cost_per_km: 25,
                      emission_factor: 0.056,
                    },
                    // -- HEAVY COMMERCIAL VEHICLES (HCV) & TRAILERS 10T+ --
                    {
                      label: "Ashok Leyland 1612 (Heavy)",
                      type: "heavy",
                      max_weight_kg: 12000,
                      max_volume_m3: 41.4,
                      length_cm: 720,
                      width_cm: 240,
                      height_cm: 240,
                      cost_per_km: 28,
                      emission_factor: 0.062,
                    },
                    {
                      label: "Mahindra Blazo X 28 (Heavy)",
                      type: "heavy",
                      max_weight_kg: 16000,
                      max_volume_m3: 46.0,
                      length_cm: 800,
                      width_cm: 240,
                      height_cm: 240,
                      cost_per_km: 32,
                      emission_factor: 0.065,
                    },
                    {
                      label: "BharatBenz 2823 (Heavy)",
                      type: "heavy",
                      max_weight_kg: 18000,
                      max_volume_m3: 54.0,
                      length_cm: 900,
                      width_cm: 240,
                      height_cm: 250,
                      cost_per_km: 35,
                      emission_factor: 0.068,
                    },
                    {
                      label: "Tata Prima 4028S (Trailer)",
                      type: "heavy",
                      max_weight_kg: 25000,
                      max_volume_m3: 79.0,
                      length_cm: 1220,
                      width_cm: 240,
                      height_cm: 270,
                      cost_per_km: 45,
                      emission_factor: 0.075,
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      className="btn btn-ghost btn-sm"
                      style={{
                        fontSize: "11px",
                        padding: "4px 10px",
                        border: "1px solid #e3e8ee",
                      }}
                      onClick={() =>
                        setNewVehicle({
                          name: preset.label.split(" (")[0],
                          type: preset.type,
                          max_weight_kg: preset.max_weight_kg,
                          max_volume_m3: preset.max_volume_m3,
                          length_cm: preset.length_cm,
                          width_cm: preset.width_cm,
                          height_cm: preset.height_cm,
                          cost_per_km: preset.cost_per_km,
                          emission_factor: preset.emission_factor,
                        })
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Validation warnings */}
              {(() => {
                const warnings: string[] = [];
                if (!newVehicle.name) warnings.push("Vehicle name is required");
                if (newVehicle.max_weight_kg <= 0)
                  warnings.push("Max weight must be greater than 0");
                if (
                  newVehicle.length_cm <= 0 ||
                  newVehicle.width_cm <= 0 ||
                  newVehicle.height_cm <= 0
                )
                  warnings.push(
                    "Vehicle dimensions (L×W×H) are needed for 3D packing",
                  );
                if (newVehicle.cost_per_km <= 0)
                  warnings.push("Cost per km helps calculate route costs");
                return warnings.length > 0 ? (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: "10px 14px",
                      background: "rgba(245,158,11,0.06)",
                      border: "1px solid rgba(245,158,11,0.15)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "12px",
                      color: "#D97706",
                    }}
                  >
                    {warnings.map((w, i) => (
                      <div key={i} style={{ marginBottom: 2 }}>
                        ⚠ {w}
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}

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
                    <option value="heavy">🟣 Heavy (10T+)</option>
                    <option value="medium">🟡 Medium (3-10T)</option>
                    <option value="light">🟢 Light (&lt;3T)</option>
                  </select>
                </div>
                <div className="stg-field">
                  <label className="label">Max Weight (kg)</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="e.g. 12000"
                    value={newVehicle.max_weight_kg || ""}
                    onChange={(e) =>
                      setNewVehicle((p) => ({
                        ...p,
                        max_weight_kg: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    Heavy: 10,000-16,000 · Medium: 3,000-7,000 · Light:
                    500-2,000
                  </span>
                </div>
                <div className="stg-field">
                  <label className="label">Max Volume (m³)</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="e.g. 42"
                    value={newVehicle.max_volume_m3 || ""}
                    onChange={(e) =>
                      setNewVehicle((p) => ({
                        ...p,
                        max_volume_m3: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    Auto-calculated:{" "}
                    {newVehicle.length_cm > 0 &&
                      newVehicle.width_cm > 0 &&
                      newVehicle.height_cm > 0
                      ? `${((newVehicle.length_cm * newVehicle.width_cm * newVehicle.height_cm) / 1e6).toFixed(1)} m³ from dimensions`
                      : "enter dimensions below"}
                  </span>
                </div>

                {/* Dimensions section */}
                <div className="stg-field" style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "rgba(14,165,233,0.04)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid rgba(14,165,233,0.12)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#0ea5e9",
                        marginBottom: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Truck size={14} /> Cargo Area Dimensions (cm)
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div>
                        <label className="label" style={{ fontSize: "11px" }}>
                          Length
                        </label>
                        <input
                          className="input"
                          type="number"
                          placeholder="e.g. 720"
                          value={newVehicle.length_cm || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setNewVehicle((p) => ({
                              ...p,
                              length_cm: val,
                              max_volume_m3:
                                val > 0 && p.width_cm > 0 && p.height_cm > 0
                                  ? parseFloat(
                                    (
                                      (val * p.width_cm * p.height_cm) /
                                      1e6
                                    ).toFixed(1),
                                  )
                                  : p.max_volume_m3,
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: "11px" }}>
                          Width
                        </label>
                        <input
                          className="input"
                          type="number"
                          placeholder="e.g. 240"
                          value={newVehicle.width_cm || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setNewVehicle((p) => ({
                              ...p,
                              width_cm: val,
                              max_volume_m3:
                                p.length_cm > 0 && val > 0 && p.height_cm > 0
                                  ? parseFloat(
                                    (
                                      (p.length_cm * val * p.height_cm) /
                                      1e6
                                    ).toFixed(1),
                                  )
                                  : p.max_volume_m3,
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: "11px" }}>
                          Height
                        </label>
                        <input
                          className="input"
                          type="number"
                          placeholder="e.g. 240"
                          value={newVehicle.height_cm || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setNewVehicle((p) => ({
                              ...p,
                              height_cm: val,
                              max_volume_m3:
                                p.length_cm > 0 && p.width_cm > 0 && val > 0
                                  ? parseFloat(
                                    (
                                      (p.length_cm * p.width_cm * val) /
                                      1e6
                                    ).toFixed(1),
                                  )
                                  : p.max_volume_m3,
                            }));
                          }}
                        />
                      </div>
                    </div>
                    {newVehicle.length_cm > 0 &&
                      newVehicle.width_cm > 0 &&
                      newVehicle.height_cm > 0 && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                            textAlign: "center",
                            fontWeight: 600,
                          }}
                        >
                          📦 {newVehicle.length_cm} × {newVehicle.width_cm} ×{" "}
                          {newVehicle.height_cm} cm ={" "}
                          {(
                            (newVehicle.length_cm *
                              newVehicle.width_cm *
                              newVehicle.height_cm) /
                            1e6
                          ).toFixed(1)}{" "}
                          m³
                        </div>
                      )}
                  </div>
                </div>

                <div className="stg-field">
                  <label className="label">Cost per km (₹)</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="e.g. 28"
                    value={newVehicle.cost_per_km || ""}
                    onChange={(e) =>
                      setNewVehicle((p) => ({
                        ...p,
                        cost_per_km: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    Includes fuel + driver + maintenance
                  </span>
                </div>
                <div className="stg-field">
                  <label className="label">
                    Emission Factor (kg CO₂/ton-km)
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="0.001"
                    placeholder="e.g. 0.062"
                    value={newVehicle.emission_factor || ""}
                    onChange={(e) =>
                      setNewVehicle((p) => ({
                        ...p,
                        emission_factor: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    Heavy: 0.06-0.08 · Medium: 0.04-0.06 · Light: 0.03-0.04
                  </span>
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
                disabled={
                  addingVehicle ||
                  !newVehicle.name ||
                  newVehicle.max_weight_kg <= 0
                }
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

      {/* ── Edit Vehicle Modal ── */}
      {showEditVehicle && (
        <div className="stg-overlay" onClick={() => setShowEditVehicle(false)}>
          <div
            className="stg-modal animate-slide-up"
            style={{ maxWidth: 720 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stg-modal-header">
              <div>
                <h3 className="stg-card-title">Edit Vehicle</h3>
                <p className="stg-card-desc">
                  Update vehicle specifications and cost parameters
                </p>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowEditVehicle(false)}
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
                    value={editVehicle.name}
                    onChange={(e) =>
                      setEditVehicle((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">Type</label>
                  <select
                    className="input"
                    value={editVehicle.type}
                    onChange={(e) =>
                      setEditVehicle((p) => ({ ...p, type: e.target.value }))
                    }
                  >
                    <option value="heavy">Heavy (10T+)</option>
                    <option value="medium">Medium (3-10T)</option>
                    <option value="light">Light (&lt;3T)</option>
                  </select>
                </div>
                <div className="stg-field">
                  <label className="label">Max Weight (kg)</label>
                  <input
                    className="input"
                    type="number"
                    value={editVehicle.max_weight_kg || ""}
                    onChange={(e) =>
                      setEditVehicle((p) => ({
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
                    value={editVehicle.max_volume_m3 || ""}
                    onChange={(e) =>
                      setEditVehicle((p) => ({
                        ...p,
                        max_volume_m3: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>

                <div className="stg-field" style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "rgba(14,165,233,0.04)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid rgba(14,165,233,0.12)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#0ea5e9",
                        marginBottom: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Truck size={14} /> Cargo Area Dimensions (cm)
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div>
                        <label className="label" style={{ fontSize: "11px" }}>
                          Length
                        </label>
                        <input
                          className="input"
                          type="number"
                          value={editVehicle.length_cm || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditVehicle((p) => ({
                              ...p,
                              length_cm: val,
                              max_volume_m3:
                                val > 0 && p.width_cm > 0 && p.height_cm > 0
                                  ? parseFloat(
                                    (
                                      (val * p.width_cm * p.height_cm) /
                                      1e6
                                    ).toFixed(1),
                                  )
                                  : p.max_volume_m3,
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: "11px" }}>
                          Width
                        </label>
                        <input
                          className="input"
                          type="number"
                          value={editVehicle.width_cm || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditVehicle((p) => ({
                              ...p,
                              width_cm: val,
                              max_volume_m3:
                                p.length_cm > 0 && val > 0 && p.height_cm > 0
                                  ? parseFloat(
                                    (
                                      (p.length_cm * val * p.height_cm) /
                                      1e6
                                    ).toFixed(1),
                                  )
                                  : p.max_volume_m3,
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: "11px" }}>
                          Height
                        </label>
                        <input
                          className="input"
                          type="number"
                          value={editVehicle.height_cm || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditVehicle((p) => ({
                              ...p,
                              height_cm: val,
                              max_volume_m3:
                                p.length_cm > 0 && p.width_cm > 0 && val > 0
                                  ? parseFloat(
                                    (
                                      (p.length_cm * p.width_cm * val) /
                                      1e6
                                    ).toFixed(1),
                                  )
                                  : p.max_volume_m3,
                            }));
                          }}
                        />
                      </div>
                    </div>
                    {editVehicle.length_cm > 0 &&
                      editVehicle.width_cm > 0 &&
                      editVehicle.height_cm > 0 && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                            textAlign: "center",
                            fontWeight: 600,
                          }}
                        >
                          {editVehicle.length_cm} x {editVehicle.width_cm} x{" "}
                          {editVehicle.height_cm} cm ={" "}
                          {(
                            (editVehicle.length_cm *
                              editVehicle.width_cm *
                              editVehicle.height_cm) /
                            1e6
                          ).toFixed(1)}{" "}
                          m³
                        </div>
                      )}
                  </div>
                </div>

                <div className="stg-field">
                  <label className="label">Cost per km (₹)</label>
                  <input
                    className="input"
                    type="number"
                    value={editVehicle.cost_per_km || ""}
                    onChange={(e) =>
                      setEditVehicle((p) => ({
                        ...p,
                        cost_per_km: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">
                    Emission Factor (kg CO₂/ton-km)
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="0.001"
                    value={editVehicle.emission_factor || ""}
                    onChange={(e) =>
                      setEditVehicle((p) => ({
                        ...p,
                        emission_factor: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <div className="stg-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowEditVehicle(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveVehicle}
                disabled={
                  savingVehicle ||
                  !editVehicle.name ||
                  editVehicle.max_weight_kg <= 0
                }
              >
                {savingVehicle ? (
                  <>
                    <div
                      className="loading-spinner"
                      style={{ width: 14, height: 14 }}
                    />{" "}
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Depot Modal ── */}
      {showEditDepot && (
        <div className="stg-overlay" onClick={() => setShowEditDepot(false)}>
          <div
            className="stg-modal animate-slide-up"
            style={{ maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stg-modal-header">
              <div>
                <h3 className="stg-card-title">Edit Depot</h3>
                <p className="stg-card-desc">
                  Update warehouse or dispatch center details
                </p>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowEditDepot(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="stg-modal-body">
              {/* Quick city presets */}
              <div
                style={{
                  marginBottom: 16,
                  padding: "12px 16px",
                  background: "rgba(16,185,129,0.04)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(16,185,129,0.12)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#10b981",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: 8,
                  }}
                >
                  📍 Quick Presets
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    {
                      label: "Mumbai",
                      name: "Mumbai Central Hub",
                      city: "Mumbai",
                      lat: 19.076,
                      lng: 72.8777,
                    },
                    {
                      label: "Delhi",
                      name: "Delhi NCR Hub",
                      city: "New Delhi",
                      lat: 28.6139,
                      lng: 77.209,
                    },
                    {
                      label: "Bengaluru",
                      name: "Bengaluru Depot",
                      city: "Bengaluru",
                      lat: 12.9716,
                      lng: 77.5946,
                    },
                    {
                      label: "Chennai",
                      name: "Chennai Port Hub",
                      city: "Chennai",
                      lat: 13.0827,
                      lng: 80.2707,
                    },
                    {
                      label: "Hyderabad",
                      name: "Hyderabad Hub",
                      city: "Hyderabad",
                      lat: 17.385,
                      lng: 78.4867,
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      className="btn btn-ghost btn-sm"
                      style={{
                        fontSize: "11px",
                        padding: "4px 10px",
                        border: "1px solid #e3e8ee",
                      }}
                      onClick={() =>
                        setEditDepot((p) => ({
                          ...p,
                          name: preset.name,
                          city: preset.city,
                          lat: preset.lat,
                          lng: preset.lng,
                        }))
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Validation warnings */}
              {(() => {
                const warnings: string[] = [];
                if (!editDepot.name) warnings.push("Depot name is required");
                if (!editDepot.city)
                  warnings.push("City is required for geocoding");
                if (!editDepot.lat && !editDepot.lng)
                  warnings.push(
                    "Coordinates needed — use Auto-fetch or enter manually",
                  );
                return warnings.length > 0 ? (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: "10px 14px",
                      background: "rgba(245,158,11,0.06)",
                      border: "1px solid rgba(245,158,11,0.15)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "12px",
                      color: "#D97706",
                    }}
                  >
                    {warnings.map((w, i) => (
                      <div key={i} style={{ marginBottom: 2 }}>
                        ⚠ {w}
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div className="stg-field">
                  <label className="label">Depot Name</label>
                  <input
                    className="input"
                    placeholder="e.g. Mumbai Central Hub"
                    value={editDepot.name}
                    onChange={(e) =>
                      setEditDepot((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div className="stg-field">
                  <label className="label">City</label>
                  <input
                    className="input"
                    placeholder="e.g. Mumbai"
                    value={editDepot.city}
                    onChange={(e) =>
                      setEditDepot((p) => ({ ...p, city: e.target.value }))
                    }
                  />
                </div>
                <div className="stg-field" style={{ gridColumn: "1 / -1" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{
                      width: "100%",
                      gap: 8,
                      justifyContent: "center",
                      padding: "10px 16px",
                      background: "rgba(99,91,255,0.06)",
                      border: "1px solid rgba(99,91,255,0.15)",
                    }}
                    disabled={isGeocoding || !editDepot.city}
                    onClick={async () => {
                      if (!editDepot.city) return;
                      setIsGeocoding(true);
                      try {
                        const geo = await geocodeAddress(editDepot.city);
                        if (geo) {
                          setEditDepot((p) => ({
                            ...p,
                            lat: geo.lat,
                            lng: geo.lng,
                          }));
                          showToastMsg(
                            `Coordinates fetched for ${editDepot.city}`,
                          );
                        } else {
                          showToastMsg(
                            "Could not find coordinates for this city",
                          );
                        }
                      } catch {
                        showToastMsg(
                          "Geocoding failed. Enter coordinates manually.",
                        );
                      } finally {
                        setIsGeocoding(false);
                      }
                    }}
                  >
                    {isGeocoding ? (
                      <>
                        <div
                          className="loading-spinner"
                          style={{ width: 14, height: 14 }}
                        />{" "}
                        Fetching...
                      </>
                    ) : (
                      <>
                        <MapPin size={14} /> 🌍 Auto-fetch Coordinates from City
                      </>
                    )}
                  </button>
                </div>

                {/* Coordinates section */}
                <div className="stg-field" style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "rgba(14,165,233,0.04)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid rgba(14,165,233,0.12)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#0ea5e9",
                        marginBottom: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <MapPin size={14} /> GPS Coordinates
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div>
                        <label className="label" style={{ fontSize: "11px" }}>
                          Latitude
                        </label>
                        <input
                          className="input"
                          type="number"
                          step="0.0001"
                          placeholder="e.g. 19.076"
                          value={editDepot.lat || ""}
                          onChange={(e) =>
                            setEditDepot((p) => ({
                              ...p,
                              lat: parseFloat(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: "11px" }}>
                          Longitude
                        </label>
                        <input
                          className="input"
                          type="number"
                          step="0.0001"
                          placeholder="e.g. 72.877"
                          value={editDepot.lng || ""}
                          onChange={(e) =>
                            setEditDepot((p) => ({
                              ...p,
                              lng: parseFloat(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                    </div>
                    {(editDepot.lat !== 0 || editDepot.lng !== 0) && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      >
                        📌 {editDepot.lat.toFixed(4)}° N,{" "}
                        {editDepot.lng.toFixed(4)}° E
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="stg-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowEditDepot(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveDepot}
                disabled={
                  savingDepot || !editDepot.name || !editDepot.city
                }
              >
                {savingDepot ? (
                  <>
                    <div
                      className="loading-spinner"
                      style={{ width: 14, height: 14 }}
                    />{" "}
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Update Depot
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
            style={{ maxWidth: 560 }}
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
              {/* Quick city presets */}
              <div
                style={{
                  marginBottom: 16,
                  padding: "12px 16px",
                  background: "rgba(16,185,129,0.04)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(16,185,129,0.12)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#10b981",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: 8,
                  }}
                >
                  📍 Quick Presets
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    {
                      label: "Mumbai",
                      name: "Mumbai Central Hub",
                      city: "Mumbai",
                      lat: 19.076,
                      lng: 72.8777,
                    },
                    {
                      label: "Delhi",
                      name: "Delhi NCR Hub",
                      city: "New Delhi",
                      lat: 28.6139,
                      lng: 77.209,
                    },
                    {
                      label: "Bengaluru",
                      name: "Bengaluru Depot",
                      city: "Bengaluru",
                      lat: 12.9716,
                      lng: 77.5946,
                    },
                    {
                      label: "Chennai",
                      name: "Chennai Port Hub",
                      city: "Chennai",
                      lat: 13.0827,
                      lng: 80.2707,
                    },
                    {
                      label: "Hyderabad",
                      name: "Hyderabad Hub",
                      city: "Hyderabad",
                      lat: 17.385,
                      lng: 78.4867,
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      className="btn btn-ghost btn-sm"
                      style={{
                        fontSize: "11px",
                        padding: "4px 10px",
                        border: "1px solid #e3e8ee",
                      }}
                      onClick={() =>
                        setNewDepot({
                          name: preset.name,
                          city: preset.city,
                          lat: preset.lat,
                          lng: preset.lng,
                        })
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Validation warnings */}
              {(() => {
                const warnings: string[] = [];
                if (!newDepot.name) warnings.push("Depot name is required");
                if (!newDepot.city)
                  warnings.push("City is required for geocoding");
                if (newDepot.lat === 0 && newDepot.lng === 0)
                  warnings.push(
                    "Coordinates needed — use Auto-fetch or enter manually",
                  );
                return warnings.length > 0 ? (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: "10px 14px",
                      background: "rgba(245,158,11,0.06)",
                      border: "1px solid rgba(245,158,11,0.15)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "12px",
                      color: "#D97706",
                    }}
                  >
                    {warnings.map((w, i) => (
                      <div key={i} style={{ marginBottom: 2 }}>
                        ⚠ {w}
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div className="stg-field">
                  <label className="label">Depot Name</label>
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
                <div className="stg-field" style={{ gridColumn: "1 / -1" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{
                      width: "100%",
                      gap: 8,
                      justifyContent: "center",
                      padding: "10px 16px",
                      background: "rgba(99,91,255,0.06)",
                      border: "1px solid rgba(99,91,255,0.15)",
                    }}
                    disabled={isGeocoding || !newDepot.city}
                    onClick={async () => {
                      if (!newDepot.city) return;
                      setIsGeocoding(true);
                      try {
                        const geo = await geocodeAddress(newDepot.city);
                        if (geo) {
                          setNewDepot((p) => ({
                            ...p,
                            lat: geo.lat,
                            lng: geo.lng,
                          }));
                          showToastMsg(
                            `Coordinates fetched for ${newDepot.city}`,
                          );
                        } else {
                          showToastMsg(
                            "Could not find coordinates for this city",
                          );
                        }
                      } catch {
                        showToastMsg(
                          "Geocoding failed. Enter coordinates manually.",
                        );
                      } finally {
                        setIsGeocoding(false);
                      }
                    }}
                  >
                    {isGeocoding ? (
                      <>
                        <div
                          className="loading-spinner"
                          style={{ width: 14, height: 14 }}
                        />{" "}
                        Fetching...
                      </>
                    ) : (
                      <>
                        <MapPin size={14} /> 🌍 Auto-fetch Coordinates from City
                      </>
                    )}
                  </button>
                </div>

                {/* Coordinates section */}
                <div className="stg-field" style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "rgba(14,165,233,0.04)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid rgba(14,165,233,0.12)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#0ea5e9",
                        marginBottom: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <MapPin size={14} /> GPS Coordinates
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div>
                        <label className="label" style={{ fontSize: "11px" }}>
                          Latitude
                        </label>
                        <input
                          className="input"
                          type="number"
                          step="0.0001"
                          placeholder="e.g. 19.076"
                          value={newDepot.lat || ""}
                          onChange={(e) =>
                            setNewDepot((p) => ({
                              ...p,
                              lat: parseFloat(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: "11px" }}>
                          Longitude
                        </label>
                        <input
                          className="input"
                          type="number"
                          step="0.0001"
                          placeholder="e.g. 72.877"
                          value={newDepot.lng || ""}
                          onChange={(e) =>
                            setNewDepot((p) => ({
                              ...p,
                              lng: parseFloat(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                    </div>
                    {newDepot.lat !== 0 && newDepot.lng !== 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      >
                        📌 {newDepot.lat.toFixed(4)}° N,{" "}
                        {newDepot.lng.toFixed(4)}° E
                      </div>
                    )}
                  </div>
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
