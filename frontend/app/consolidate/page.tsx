"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Layers,
  Zap,
  ChevronDown,
  ChevronUp,
  Truck,
  Check,
  X,
  Edit,
  ArrowRight,
  Loader2,
  Settings2,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  MapPin,
  Box,
  Navigation,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { type Cluster, type ConsolidationPlan } from "@/lib/mock-data";
import {
  getLatestPlan,
  runConsolidation,
  submitClusterFeedback,
  getVehicles,
  checkReadiness,
  editCluster,
} from "@/lib/api";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e3e8ee",
        borderRadius: "8px",
        padding: "12px 16px",
        fontSize: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <p style={{ color: "#8792a2", marginBottom: "6px" }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.fill, fontWeight: 700 }}>
          {entry.name}:{" "}
          {typeof entry.value === "number"
            ? entry.value.toLocaleString()
            : entry.value}
        </p>
      ))}
    </div>
  );
};

// Empty plan structure
const emptyPlan: ConsolidationPlan = {
  id: "",
  name: "",
  status: "draft",
  totalShipments: 0,
  totalClusters: 0,
  avgUtilization: 0,
  totalCostBefore: 0,
  totalCostAfter: 0,
  co2Before: 0,
  co2After: 0,
  tripsBefore: 0,
  tripsAfter: 0,
  createdAt: "",
  clusters: [],
};

export default function ConsolidationPage() {
  const [plan, setPlan] = useState<ConsolidationPlan>(emptyPlan);
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [clusterStatuses, setClusterStatuses] = useState<
    Record<string, string>
  >({});
  const [vehiclesMap, setVehiclesMap] = useState<
    Record<string, { max_weight_kg: number; name: string }>
  >({});
  const [readiness, setReadiness] = useState<{
    ready: boolean;
    issues: { type: string; field: string; message: string }[];
    warnings: { type: string; field: string; message: string }[];
    summary: { pending_shipments: number; vehicles: number; depots: number };
  } | null>(null);
  const [runStage, setRunStage] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null);
  const [editRemoveIds, setEditRemoveIds] = useState<string[]>([]);
  const [editVehicleId, setEditVehicleId] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [overweightWarnings, setOverweightWarnings] = useState<any[]>([]);
  const [vehicleLimitWarnings, setVehicleLimitWarnings] = useState<string[]>([]);
  const [allVehicles, setAllVehicles] = useState<any[]>([]);

  const RUN_STAGES = [
    { label: "Fetching pending shipments from database...", pct: 10 },
    { label: "Analyzing pickup & delivery locations...", pct: 25 },
    { label: "Running DBSCAN geo-temporal clustering...", pct: 45 },
    { label: "Optimizing 3D bin-packing assignments...", pct: 65 },
    { label: "Solving CVRPTW route optimization...", pct: 80 },
    { label: "Calculating carbon emissions & costs...", pct: 90 },
    { label: "Saving consolidation plan to database...", pct: 95 },
  ];

  const fetchVehiclesMap = () => {
    getVehicles()
      .then((data) => {
        if (data?.length) {
          setAllVehicles(data);
          const map: Record<string, { max_weight_kg: number; name: string }> =
            {};
          data.forEach((v: any) => {
            map[v.id] = { max_weight_kg: v.max_weight_kg ?? 0, name: v.name };
          });
          setVehiclesMap(map);
        }
      })
      .catch(() => {});
  };

  const loadLatestPlan = () => {
    getLatestPlan()
      .then((data) => {
        if (data && data.clusters && data.clusters.length > 0) {
          const mapped: ConsolidationPlan = {
            id: data.id || "",
            name: data.name || "Latest Consolidation Plan",
            status: data.status || "active",
            totalShipments: data.total_shipments || 0,
            totalClusters: data.total_clusters || 0,
            avgUtilization: data.avg_utilization || 0,
            totalCostBefore: data.total_cost_before || 0,
            totalCostAfter: data.total_cost_after || 0,
            co2Before: data.co2_before || 0,
            co2After: data.co2_after || 0,
            tripsBefore: data.trips_before || 0,
            tripsAfter: data.trips_after || 0,
            createdAt: data.created_at || "",
            clusters: data.clusters.map((c: any) => ({
              id: c.id,
              planId: c.plan_id,
              vehicleId: c.vehicle_id,
              vehicleName:
                c.vehicle_name ||
                vehiclesMap[c.vehicle_id]?.name ||
                "Unknown Truck",
              shipmentIds: c.shipment_ids || [],
              utilizationPct: c.utilization_pct || 0,
              totalWeight: c.total_weight || 0,
              totalVolume: c.total_volume || 0,
              routeDistanceKm: c.route_distance_km || 0,
              estimatedCost: c.estimated_cost || 0,
              estimatedCo2: c.estimated_co2 || 0,
              status: c.status || "pending",
              chained: c.chained || false,
            })),
          };
          setPlan(mapped);
          setShowResults(true);
        } else {
          // No consolidation plan exists - show empty state
          setPlan(emptyPlan);
          setShowResults(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load consolidation plan:", err);
        setPlan(emptyPlan);
        setShowResults(false);
      });
  };

  useEffect(() => {
    fetchVehiclesMap();
    loadLatestPlan();
    checkReadiness()
      .then((data) => setReadiness(data))
      .catch(() => {});
  }, []);

  const handleRunConsolidation = () => {
    setIsRunning(true);
    setShowResults(false);
    setRunError(null);
    setRunStage(0);
    setOverweightWarnings([]);
    setVehicleLimitWarnings([]);

    // Animate through stages
    const stageInterval = setInterval(() => {
      setRunStage((prev) => {
        if (prev < RUN_STAGES.length - 1) return prev + 1;
        return prev;
      });
    }, 1800);

    runConsolidation()
      .then((data) => {
        clearInterval(stageInterval);
        if (data && data.clusters && data.clusters.length > 0) {
          if (data.overweight_warnings && data.overweight_warnings.length > 0) {
            setOverweightWarnings(data.overweight_warnings);
          }
          if (data.vehicle_limit_warnings && data.vehicle_limit_warnings.length > 0) {
            setVehicleLimitWarnings(data.vehicle_limit_warnings);
          }
          const mapped: ConsolidationPlan = {
            id: data.id || data.plan_id || "",
            name: data.name || "New Consolidation Plan",
            status: "active",
            totalShipments: data.total_shipments || 0,
            totalClusters: data.total_clusters || 0,
            avgUtilization: data.avg_utilization || 0,
            totalCostBefore: data.total_cost_before || 0,
            totalCostAfter: data.total_cost_after || 0,
            co2Before: data.co2_before || 0,
            co2After: data.co2_after || 0,
            tripsBefore: data.trips_before || 0,
            tripsAfter: data.trips_after || 0,
            createdAt: data.created_at || new Date().toISOString(),
            clusters: data.clusters.map((c: any) => ({
              id: c.id,
              planId: c.plan_id || data.plan_id || "",
              vehicleId: c.vehicle_id,
              vehicleName:
                c.vehicle_name ||
                vehiclesMap[c.vehicle_id]?.name ||
                "Unknown Truck",
              shipmentIds: c.shipment_ids || [],
              utilizationPct: c.utilization_pct || 0,
              totalWeight: c.total_weight || 0,
              totalVolume: c.total_volume || 0,
              routeDistanceKm: c.route_distance_km || 0,
              estimatedCost: c.estimated_cost || 0,
              estimatedCo2: c.estimated_co2 || 0,
              status: c.status || "pending",
              chained: c.chained || false,
            })),
          };
          setPlan(mapped);
          setShowResults(true);
          fetchVehiclesMap();
          checkReadiness()
            .then((d) => setReadiness(d))
            .catch(() => {});
        } else {
          setPlan(emptyPlan);
          setShowResults(false);
          setRunError(
            "No clusters could be formed. Try adding more shipments with nearby routes.",
          );
        }
      })
      .catch((err) => {
        clearInterval(stageInterval);
        console.error("Failed to run consolidation:", err);
        setPlan(emptyPlan);
        setShowResults(false);
        setRunError(
          "Consolidation engine failed. Check that you have pending shipments, vehicles, and depots configured.",
        );
      })
      .finally(() => {
        setIsRunning(false);
      });
  };

  const handleClusterAction = (clusterId: string, action: string) => {
    setClusterStatuses((prev) => ({ ...prev, [clusterId]: action }));
    submitClusterFeedback(clusterId, action)
      .then(() => {
        // Refresh readiness when rejecting (shipments go back to pending)
        if (action === "rejected") {
          checkReadiness()
            .then((d) => setReadiness(d))
            .catch(() => {});
        }
      })
      .catch(() => {});
  };

  const openClusterEdit = (cluster: Cluster) => {
    setEditingCluster(cluster);
    setEditRemoveIds([]);
    setEditVehicleId(cluster.vehicleId || "");
  };

  const handleSaveClusterEdit = async () => {
    if (!editingCluster) return;
    setEditSaving(true);
    try {
      const payload: any = {};
      if (editRemoveIds.length > 0) payload.remove_shipment_ids = editRemoveIds;
      if (editVehicleId && editVehicleId !== editingCluster.vehicleId)
        payload.vehicle_id = editVehicleId;
      await editCluster(editingCluster.id, payload);
      setEditingCluster(null);
      loadLatestPlan();
    } catch {
      // error
    } finally {
      setEditSaving(false);
    }
  };

  const hasRejectedClusters = plan.clusters.some(
    (c) => (clusterStatuses[c.id] || c.status) === "rejected",
  );

  const handleRerunRejected = () => {
    // Re-run consolidation — rejected shipments are already back to pending
    handleRunConsolidation();
  };

  const getUtilColor = (pct: number) => {
    if (pct >= 80) return "#0CAF60";
    if (pct >= 60) return "#E5850B";
    return "#DF1B41";
  };

  const costSavingPct =
    plan.totalCostBefore > 0
      ? Math.round(
          ((plan.totalCostBefore - plan.totalCostAfter) /
            plan.totalCostBefore) *
            100,
        )
      : 0;
  const tripSavingPct =
    plan.tripsBefore > 0
      ? Math.round(
          ((plan.tripsBefore - plan.tripsAfter) / plan.tripsBefore) * 100,
        )
      : 0;
  const co2SavingPct =
    plan.co2Before > 0
      ? Math.round(((plan.co2Before - plan.co2After) / plan.co2Before) * 100)
      : 0;

  const beforeAfterData = [
    { metric: "Trips", before: plan.tripsBefore, after: plan.tripsAfter },
    {
      metric: "Cost (₹K)",
      before: Math.round(plan.totalCostBefore / 1000),
      after: Math.round(plan.totalCostAfter / 1000),
    },
    { metric: "CO₂ (kg)", before: plan.co2Before, after: plan.co2After },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Consolidation Engine</h1>
          <p className="page-subtitle">
            AI-powered DBSCAN clustering & 3D bin-packing for maximum efficiency
          </p>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleRunConsolidation}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <div className="loading-spinner" /> Running Engine...
            </>
          ) : (
            <>
              <Zap size={16} /> Run Consolidation
            </>
          )}
        </button>
      </div>

      <div className="page-body">
        {/* ── Engine Parameters ── */}
        <div className="card" style={{ marginBottom: "24px" }}>
          <div className="card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: "var(--lorri-primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Settings2
                  size={14}
                  style={{ color: "var(--lorri-primary)" }}
                />
              </div>
              <span className="card-title">Engine Parameters</span>
            </div>
            <span className="badge badge-primary">DBSCAN + 3D Bin-Pack</span>
          </div>
          <div className="card-body">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
              }}
            >
              {[
                {
                  label: "Date Range",
                  type: "date",
                  defaultVal: "2026-03-07",
                  isSelect: false,
                },
                {
                  label: "Max Detour %",
                  type: "",
                  defaultVal: "15",
                  isSelect: true,
                  opts: ["10%", "15%", "20%", "30%"],
                },
                {
                  label: "Vehicle Types",
                  type: "",
                  defaultVal: "all",
                  isSelect: true,
                  opts: [
                    "All Available",
                    "Heavy Trucks Only",
                    "Medium Trucks Only",
                  ],
                },
                {
                  label: "Priority Mode",
                  type: "",
                  defaultVal: "preserve",
                  isSelect: true,
                  opts: ["Preserve Priority", "Relax (cost-optimized)"],
                },
              ].map((f) => (
                <div key={f.label}>
                  <label className="label">{f.label}</label>
                  {f.isSelect ? (
                    <select className="input">
                      {f.opts!.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type={f.type}
                      defaultValue={f.defaultVal}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Readiness Warnings ── */}
        {readiness && !showResults && !isRunning && (
          <div style={{ marginBottom: "24px" }}>
            {/* Issues (blocking) */}
            {readiness.issues.length > 0 && (
              <div
                className="animate-fade-in"
                style={{
                  background: "rgba(223,27,65,0.06)",
                  border: "1px solid rgba(223,27,65,0.20)",
                  borderRadius: "var(--radius-lg)",
                  padding: "16px 20px",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <AlertTriangle
                  size={18}
                  style={{ color: "#DF1B41", flexShrink: 0, marginTop: 2 }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "13px",
                      color: "#DF1B41",
                      marginBottom: "6px",
                    }}
                  >
                    Missing Configuration — Cannot run consolidation
                  </div>
                  {readiness.issues.map((issue, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        marginBottom: "3px",
                      }}
                    >
                      • {issue.message}
                    </div>
                  ))}
                  <Link
                    href="/settings"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--lorri-primary)",
                      marginTop: "8px",
                      textDecoration: "none",
                    }}
                  >
                    <Settings2 size={12} /> Go to Settings to configure{" "}
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            {/* Warnings (non-blocking) */}
            {readiness.warnings.length > 0 && (
              <div
                className="animate-fade-in"
                style={{
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.20)",
                  borderRadius: "var(--radius-lg)",
                  padding: "16px 20px",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <AlertTriangle
                  size={18}
                  style={{ color: "#D97706", flexShrink: 0, marginTop: 2 }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "13px",
                      color: "#D97706",
                      marginBottom: "6px",
                    }}
                  >
                    Suggestions
                  </div>
                  {readiness.warnings.map((w, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        marginBottom: "3px",
                      }}
                    >
                      • {w.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary cards */}
            {readiness.summary && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                }}
              >
                <div
                  className="card"
                  style={{
                    padding: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background:
                        readiness.summary.pending_shipments > 0
                          ? "rgba(99,91,255,0.10)"
                          : "rgba(223,27,65,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Package
                      size={18}
                      style={{
                        color:
                          readiness.summary.pending_shipments > 0
                            ? "#635BFF"
                            : "#DF1B41",
                      }}
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {readiness.summary.pending_shipments}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      Pending Shipments
                    </div>
                  </div>
                </div>
                <div
                  className="card"
                  style={{
                    padding: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background:
                        readiness.summary.vehicles > 0
                          ? "rgba(16,185,129,0.10)"
                          : "rgba(223,27,65,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Truck
                      size={18}
                      style={{
                        color:
                          readiness.summary.vehicles > 0
                            ? "#10B981"
                            : "#DF1B41",
                      }}
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {readiness.summary.vehicles}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      Vehicles Available
                    </div>
                  </div>
                </div>
                <div
                  className="card"
                  style={{
                    padding: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background:
                        readiness.summary.depots > 0
                          ? "rgba(14,165,233,0.10)"
                          : "rgba(223,27,65,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MapPin
                      size={18}
                      style={{
                        color:
                          readiness.summary.depots > 0 ? "#0ea5e9" : "#DF1B41",
                      }}
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {readiness.summary.depots}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      Depot Locations
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Error State ── */}
        {runError && !isRunning && (
          <div
            className="animate-fade-in"
            style={{
              background: "rgba(223,27,65,0.06)",
              border: "1px solid rgba(223,27,65,0.20)",
              borderRadius: "var(--radius-lg)",
              padding: "24px",
              marginBottom: "24px",
              textAlign: "center",
            }}
          >
            <AlertTriangle
              size={28}
              style={{ color: "#DF1B41", marginBottom: "12px" }}
            />
            <div
              style={{
                fontWeight: 700,
                fontSize: "15px",
                color: "#DF1B41",
                marginBottom: "8px",
              }}
            >
              Consolidation Failed
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                marginBottom: "16px",
              }}
            >
              {runError}
            </div>
            <div
              style={{ display: "flex", gap: "12px", justifyContent: "center" }}
            >
              <Link
                href="/shipments"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: "none" }}
              >
                <Package size={14} /> Add Shipments
              </Link>
              <Link
                href="/settings"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: "none" }}
              >
                <Settings2 size={14} /> Configure Settings
              </Link>
            </div>
          </div>
        )}

        {/* ── Loading State ── */}
        {isRunning && (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <div
              style={{
                width: "80px",
                height: "80px",
                margin: "0 auto 24px",
                background:
                  "linear-gradient(135deg, rgba(99,91,255,0.15), rgba(139,92,246,0.10))",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "pulse 2s infinite",
              }}
            >
              <Zap size={36} style={{ color: "var(--lorri-primary)" }} />
            </div>
            <p
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "8px",
              }}
            >
              Running AI Consolidation Engine
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                marginBottom: "32px",
              }}
            >
              {readiness?.summary
                ? `Processing ${readiness.summary.pending_shipments} shipments with ${readiness.summary.vehicles} vehicles`
                : "Analyzing shipments and optimizing assignments"}
            </p>

            {/* Stage indicators */}
            <div
              style={{ maxWidth: "500px", margin: "0 auto", textAlign: "left" }}
            >
              {RUN_STAGES.map((stage, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "8px 0",
                    opacity: idx <= runStage ? 1 : 0.3,
                    transition: "opacity 0.5s ease",
                  }}
                >
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        idx < runStage
                          ? "rgba(12,175,96,0.15)"
                          : idx === runStage
                            ? "rgba(99,91,255,0.15)"
                            : "var(--bg-secondary)",
                      flexShrink: 0,
                    }}
                  >
                    {idx < runStage ? (
                      <Check size={12} style={{ color: "#0CAF60" }} />
                    ) : idx === runStage ? (
                      <div
                        className="loading-spinner"
                        style={{ width: 12, height: 12 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--text-tertiary)",
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: idx === runStage ? 600 : 400,
                      color:
                        idx <= runStage
                          ? "var(--text-primary)"
                          : "var(--text-tertiary)",
                    }}
                  >
                    {stage.label}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="progress-bar"
              style={{ maxWidth: "500px", margin: "24px auto 0" }}
            >
              <div
                className="progress-bar-fill purple"
                style={{
                  width: `${RUN_STAGES[runStage]?.pct || 10}%`,
                  background: "linear-gradient(90deg, #635BFF, #8B5CF6)",
                  transition: "width 1s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {showResults && !isRunning && (
          <div className="animate-slide-up">
            {/* Overweight Warnings */}
            {overweightWarnings.length > 0 && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                    fontWeight: 700,
                    color: "#ef4444",
                    fontSize: "14px",
                  }}
                >
                  <AlertTriangle size={18} />
                  {overweightWarnings.length} shipment
                  {overweightWarnings.length > 1 ? "s" : ""} exceed
                  {overweightWarnings.length === 1 ? "s" : ""} vehicle capacity
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {overweightWarnings.map((w: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "rgba(239, 68, 68, 0.06)",
                        borderRadius: "8px",
                        padding: "8px 14px",
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <Package
                        size={14}
                        style={{ color: "#ef4444", flexShrink: 0 }}
                      />
                      <span>
                        <strong style={{ color: "var(--text-primary)" }}>
                          {w.shipment_code || w.shipment_id}
                        </strong>{" "}
                        — {w.weight_kg?.toLocaleString()}kg (max truck capacity:{" "}
                        {w.max_vehicle_capacity?.toLocaleString()}kg)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vehicle Limit Warnings */}
            {vehicleLimitWarnings.length > 0 && (
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.08)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                    fontWeight: 700,
                    color: "#f59e0b",
                    fontSize: "14px",
                  }}
                >
                  <Truck size={18} />
                  Vehicle Capacity Limit Reached
                </div>
                {vehicleLimitWarnings.map((msg: string, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "rgba(245, 158, 11, 0.06)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    <AlertTriangle
                      size={14}
                      style={{ color: "#f59e0b", flexShrink: 0 }}
                    />
                    <span>{msg}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Before vs After + Chart Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "16px",
                marginBottom: "24px",
                alignItems: "start",
              }}
            >
              {/* Before Card */}
              <div className="card" style={{ textAlign: "center" }}>
                <div className="card-header" style={{ paddingBottom: "18px" }}>
                  <div
                    className="card-title"
                    style={{
                      color: "var(--text-tertiary)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                    }}
                  >
                    Before Consolidation
                  </div>
                </div>
                <div className="card-body">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "18px",
                    }}
                  >
                    {[
                      { val: plan.tripsBefore, label: "Total Trips" },
                      {
                        val:
                          `${Math.round((((plan.totalCostBefore / plan.tripsBefore) * 100) / (plan.totalCostBefore || 1)) * (plan.tripsBefore || 1))}%` ||
                          "—",
                        label: "Utilization",
                      },
                      {
                        val:
                          plan.totalCostBefore > 0
                            ? `₹${(plan.totalCostBefore / 1000).toFixed(1)}K`
                            : "—",
                        label: "Total Cost",
                      },
                      { val: `${plan.co2Before} kg`, label: "CO₂" },
                    ].map((m) => (
                      <div key={m.label}>
                        <div
                          style={{
                            fontSize: "28px",
                            fontWeight: 800,
                            color: "var(--lorri-danger)",
                            letterSpacing: "-0.03em",
                          }}
                        >
                          {m.val}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                            marginTop: "3px",
                          }}
                        >
                          {m.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Arrow + Badge */}
              <div
                className="hero-dark-section"
                style={{ textAlign: "center", padding: "36px 24px" }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <ArrowRight
                    size={36}
                    style={{ color: "#a5b4fc", margin: "0 auto" }}
                  />
                </div>
                <div
                  className="hero-dark-title"
                  style={{ fontSize: "18px", marginBottom: "20px" }}
                >
                  AI Optimized
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {[
                    {
                      label: "Trips",
                      pct: tripSavingPct > 0 ? `▼ ${tripSavingPct}%` : "—",
                      cls: "green",
                    },
                    {
                      label: "Cost",
                      pct: costSavingPct > 0 ? `▼ ${costSavingPct}%` : "—",
                      cls: "green",
                    },
                    {
                      label: "CO₂",
                      pct: co2SavingPct > 0 ? `▼ ${co2SavingPct}%` : "—",
                      cls: "green",
                    },
                    {
                      label: "Utilization",
                      pct:
                        plan.avgUtilization > 0
                          ? `▲ ${Math.round(plan.avgUtilization)}%`
                          : "—",
                      cls: "purple",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "12px",
                      }}
                    >
                      <span style={{ color: "rgba(255,255,255,0.50)" }}>
                        {s.label}
                      </span>
                      <span style={{ fontWeight: 700, color: "#34d399" }}>
                        {s.pct}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* After Card */}
              <div
                className="card"
                style={{
                  textAlign: "center",
                  borderColor: "rgba(99,91,255,0.30)",
                  boxShadow: "0 0 0 3px rgba(99,91,255,0.08)",
                }}
              >
                <div className="card-header" style={{ paddingBottom: "18px" }}>
                  <div
                    className="card-title"
                    style={{
                      color: "var(--lorri-primary)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                    }}
                  >
                    After Consolidation
                  </div>
                </div>
                <div className="card-body">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "18px",
                    }}
                  >
                    {[
                      {
                        val: plan.tripsAfter,
                        label: "Total Trips",
                        pct: tripSavingPct > 0 ? `▼${tripSavingPct}%` : "",
                      },
                      {
                        val: `${Math.round(plan.avgUtilization)}%`,
                        label: "Utilization",
                        pct:
                          plan.avgUtilization > 0
                            ? `▲${Math.round(plan.avgUtilization)}%`
                            : "",
                      },
                      {
                        val:
                          plan.totalCostAfter > 0
                            ? `₹${(plan.totalCostAfter / 1000).toFixed(1)}K`
                            : "—",
                        label: "Total Cost",
                        pct: costSavingPct > 0 ? `▼${costSavingPct}%` : "",
                      },
                      {
                        val: `${plan.co2After} kg`,
                        label: "CO₂",
                        pct: co2SavingPct > 0 ? `▼${co2SavingPct}%` : "",
                      },
                    ].map((m) => (
                      <div key={m.label}>
                        <div
                          style={{
                            fontSize: "26px",
                            fontWeight: 800,
                            color: "var(--lorri-success)",
                            letterSpacing: "-0.03em",
                            lineHeight: 1,
                          }}
                        >
                          {m.val}
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            color: "var(--lorri-success)",
                            marginTop: "2px",
                          }}
                        >
                          {m.pct}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                            marginTop: "2px",
                          }}
                        >
                          {m.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison Chart */}
            <div className="card" style={{ marginBottom: "24px" }}>
              <div className="card-header">
                <div className="card-title">Before vs After Comparison</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <span className="badge badge-danger">Before</span>
                  <span className="badge badge-success">After</span>
                </div>
              </div>
              <div className="card-body" style={{ height: "230px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={beforeAfterData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f7" />
                    <XAxis
                      dataKey="metric"
                      tick={{ fill: "#8792a2", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#8792a2", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="before"
                      name="Before"
                      fill="#DF1B41"
                      radius={[4, 4, 0, 0]}
                      barSize={36}
                    />
                    <Bar
                      dataKey="after"
                      name="After"
                      fill="#0CAF60"
                      radius={[4, 4, 0, 0]}
                      barSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Clusters Grid */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <h2
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                }}
              >
                Consolidated Clusters
                <span
                  className="badge badge-ghost"
                  style={{ marginLeft: "10px", fontWeight: 600 }}
                >
                  {plan.clusters.length}
                </span>
              </h2>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  fontSize: "12px",
                  color: "var(--text-tertiary)",
                }}
              >
                <span className="badge badge-success">accepted</span>
                <span className="badge badge-warning">pending</span>
                <span className="badge badge-danger">rejected</span>
              </div>
            </div>

            {!showResults || plan.clusters.length === 0 ? (
              <div
                className="card"
                style={{ textAlign: "center", padding: "60px 20px" }}
              >
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📦</div>
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    marginBottom: "8px",
                    color: "var(--text-primary)",
                  }}
                >
                  No Consolidation Plan Found
                </h3>
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--text-secondary)",
                    marginBottom: "24px",
                  }}
                >
                  {isRunning
                    ? "Processing shipments and creating consolidation plan..."
                    : "Run consolidation to create clusters from your pending shipments."}
                </p>
                {!isRunning && (
                  <button
                    onClick={handleRunConsolidation}
                    className="btn btn-primary"
                    style={{ minWidth: "200px" }}
                  >
                    <Zap size={16} style={{ marginRight: "8px" }} />
                    Run Consolidation
                  </button>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "14px",
                }}
              >
                {plan.clusters.map((cluster) => {
                  const status = clusterStatuses[cluster.id] || cluster.status;
                  const isExpanded = expandedCluster === cluster.id;
                  const utilColor = getUtilColor(cluster.utilizationPct);
                  const utilClass =
                    cluster.utilizationPct >= 80
                      ? "green"
                      : cluster.utilizationPct >= 60
                        ? "yellow"
                        : "red";

                  return (
                    <div
                      key={cluster.id}
                      className="card"
                      style={{
                        borderColor:
                          status === "accepted"
                            ? "rgba(12,175,96,0.35)"
                            : status === "rejected"
                              ? "rgba(223,27,65,0.2)"
                              : undefined,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {/* Top accent for utilization */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: "3px",
                          background: utilColor,
                        }}
                      />

                      <div
                        className="card-body"
                        style={{ padding: "20px 20px 16px" }}
                      >
                        {/* Cluster Header */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "16px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                color: "var(--text-primary)",
                              }}
                            >
                              Cluster {cluster.id.split("-")[1]}
                            </div>
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "var(--lorri-primary)",
                                marginTop: "4px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Truck
                                size={14}
                                style={{ color: "var(--lorri-primary)" }}
                              />
                              <span>
                                {cluster.vehicleName ||
                                  vehiclesMap[cluster.vehicleId]?.name ||
                                  "Unknown Truck"}
                              </span>
                              {cluster.chained && (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "rgba(14,165,233,0.12)",
                                    color: "#0ea5e9",
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  CHAINED ROUTE
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`badge ${status === "accepted" ? "badge-success" : status === "rejected" ? "badge-danger" : "badge-warning"}`}
                          >
                            {status}
                          </span>
                        </div>

                        {/* Utilization Bar */}
                        <div style={{ marginBottom: "14px" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "11px",
                              marginBottom: "6px",
                            }}
                          >
                            <span style={{ color: "var(--text-secondary)" }}>
                              Utilization
                            </span>
                            <span style={{ fontWeight: 700, color: utilColor }}>
                              {cluster.utilizationPct}%
                            </span>
                          </div>
                          <div className="progress-bar">
                            <div
                              className={`progress-bar-fill ${utilClass}`}
                              style={{ width: `${cluster.utilizationPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Metrics */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                            gap: "10px",
                            fontSize: "12px",
                            marginBottom: "14px",
                          }}
                        >
                          {[
                            {
                              label: "Shipments",
                              val: cluster.shipmentIds.length,
                            },
                            {
                              label: "Weight",
                              val: `${cluster.totalWeight.toLocaleString()} kg`,
                            },
                            {
                              label: "Distance",
                              val: `${cluster.routeDistanceKm} km`,
                            },
                            {
                              label: "Cost",
                              val: `₹${cluster.estimatedCost.toLocaleString()}`,
                            },
                          ].map((m) => (
                            <div key={m.label}>
                              <div
                                style={{
                                  color: "var(--text-tertiary)",
                                  marginBottom: "2px",
                                }}
                              >
                                {m.label}
                              </div>
                              <div
                                style={{
                                  fontWeight: 650,
                                  color: "var(--text-primary)",
                                }}
                              >
                                {m.val}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Load Distribution Animation */}
                        {(() => {
                          const vehCapacity =
                            vehiclesMap[cluster.vehicleId]?.max_weight_kg ||
                            cluster.totalWeight;
                          const nItems = cluster.shipmentIds.length;
                          const avgWeight =
                            nItems > 0 ? cluster.totalWeight / nItems : 0;
                          const COLORS = [
                            "#635BFF",
                            "#0CAF60",
                            "#E5850B",
                            "#00A2E8",
                            "#FF6B35",
                            "#9B59B6",
                            "#1ABC9C",
                            "#DF1B41",
                          ];
                          return (
                            <div
                              style={{
                                marginBottom: "14px",
                                padding: "10px 12px",
                                background: "var(--bg-secondary)",
                                borderRadius: "8px",
                                border: "1px solid var(--border-secondary)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "var(--text-tertiary)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                  marginBottom: "8px",
                                }}
                              >
                                Load Distribution — {cluster.shipmentIds.length}{" "}
                                items → {vehCapacity.toLocaleString()}kg
                                capacity
                              </div>
                              {/* Stacked bar */}
                              <div
                                style={{
                                  display: "flex",
                                  height: "18px",
                                  borderRadius: "4px",
                                  overflow: "hidden",
                                  background: "rgba(0,0,0,0.04)",
                                  marginBottom: "6px",
                                }}
                              >
                                {cluster.shipmentIds.map((sid, i) => {
                                  const pct = (avgWeight / vehCapacity) * 100;
                                  return (
                                    <div
                                      key={sid}
                                      title={`${sid.slice(0, 8).toUpperCase()}: ~${Math.round(avgWeight)}kg`}
                                      style={{
                                        width: `${pct}%`,
                                        background: COLORS[i % COLORS.length],
                                        opacity: 0.85,
                                        borderRight:
                                          i < nItems - 1
                                            ? "1px solid rgba(255,255,255,0.5)"
                                            : "none",
                                        animation: `growWidth 0.6s ease-out ${i * 0.1}s both`,
                                        transition: "width 0.3s ease",
                                      }}
                                    />
                                  );
                                })}
                              </div>
                              {/* Legend */}
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "6px",
                                }}
                              >
                                {cluster.shipmentIds
                                  .slice(0, 6)
                                  .map((sid, i) => (
                                    <div
                                      key={sid}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "3px",
                                        fontSize: "9px",
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: 6,
                                          height: 6,
                                          borderRadius: 2,
                                          background: COLORS[i % COLORS.length],
                                        }}
                                      />
                                      {sid.slice(0, 6).toUpperCase()}
                                    </div>
                                  ))}
                                {cluster.shipmentIds.length > 6 && (
                                  <span
                                    style={{
                                      fontSize: "9px",
                                      color: "var(--text-tertiary)",
                                    }}
                                  >
                                    +{cluster.shipmentIds.length - 6} more
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Expand/Collapse */}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{
                            width: "100%",
                            justifyContent: "center",
                            marginBottom: "10px",
                          }}
                          onClick={() =>
                            setExpandedCluster(isExpanded ? null : cluster.id)
                          }
                        >
                          <Package size={12} />
                          View Shipments ({cluster.shipmentIds.length})
                          {isExpanded ? (
                            <ChevronUp size={12} />
                          ) : (
                            <ChevronDown size={12} />
                          )}
                        </button>

                        {isExpanded && (
                          <div
                            style={{
                              background: "var(--bg-secondary)",
                              borderRadius: "8px",
                              padding: "8px",
                              marginBottom: "10px",
                              fontSize: "11.5px",
                              border: "1px solid var(--border-secondary)",
                            }}
                          >
                            {cluster.shipmentIds.map((sid) => (
                              <div
                                key={sid}
                                style={{
                                  padding: "5px 8px",
                                  borderBottom:
                                    "1px solid var(--border-secondary)",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    color: "var(--lorri-primary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {sid.toUpperCase()}
                                </span>
                                <span
                                  className="badge badge-ghost"
                                  style={{ fontSize: "10px" }}
                                >
                                  pending
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        {status === "pending" && (
                          <div className="cluster-actions">
                            <button
                              className="btn btn-sm btn-success"
                              style={{ flex: 1 }}
                              onClick={() =>
                                handleClusterAction(cluster.id, "accepted")
                              }
                            >
                              <Check size={12} /> Accept
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ flex: 1 }}
                              onClick={() => openClusterEdit(cluster)}
                            >
                              <Edit size={12} /> Modify
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() =>
                                handleClusterAction(cluster.id, "rejected")
                              }
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}

                        {status !== "pending" && (
                          <div
                            style={{
                              textAlign: "center",
                              fontSize: "12px",
                              fontWeight: 600,
                              color:
                                status === "accepted"
                                  ? "var(--lorri-success)"
                                  : "var(--lorri-danger)",
                              padding: "8px 0 0",
                            }}
                          >
                            {status === "accepted"
                              ? "✓ Cluster accepted"
                              : "✗ Cluster rejected — shipments returned to pending"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Re-run for rejected clusters ── */}
            {hasRejectedClusters && !isRunning && (
              <div
                className="animate-fade-in"
                style={{
                  marginTop: "20px",
                  background:
                    "linear-gradient(135deg, rgba(99,91,255,0.06), rgba(139,92,246,0.04))",
                  border: "1px solid rgba(99,91,255,0.20)",
                  borderRadius: "var(--radius-lg)",
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      marginBottom: "4px",
                    }}
                  >
                    Rejected Clusters Detected
                  </div>
                  <div
                    style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                  >
                    Shipments from rejected clusters have been returned to
                    pending status. You can re-run the consolidation engine to
                    create new optimized clusters for these shipments.
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleRerunRejected}
                  disabled={isRunning}
                  style={{ flexShrink: 0 }}
                >
                  <Zap size={14} /> Re-run Engine
                </button>
              </div>
            )}

            {/* ── Navigation to Routes & Packing ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "16px",
                marginTop: "24px",
              }}
            >
              <Link href="/routes" style={{ textDecoration: "none" }}>
                <div
                  className="card"
                  style={{
                    padding: "24px",
                    cursor: "pointer",
                    borderColor: "rgba(14,165,233,0.25)",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background:
                        "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(99,91,255,0.08))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Navigation size={22} style={{ color: "#0ea5e9" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        marginBottom: "4px",
                      }}
                    >
                      View Optimized Routes
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      See routes on interactive map with stop-by-stop details
                    </div>
                  </div>
                  <ArrowRight
                    size={18}
                    style={{ color: "var(--text-tertiary)" }}
                  />
                </div>
              </Link>

              <Link href="/packing" style={{ textDecoration: "none" }}>
                <div
                  className="card"
                  style={{
                    padding: "24px",
                    cursor: "pointer",
                    borderColor: "rgba(139,92,246,0.25)",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background:
                        "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,91,255,0.08))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Box size={22} style={{ color: "#8B5CF6" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        marginBottom: "4px",
                      }}
                    >
                      View 3D Bin Packing
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Visualize how shipments were packed into each vehicle
                    </div>
                  </div>
                  <ArrowRight
                    size={18}
                    style={{ color: "var(--text-tertiary)" }}
                  />
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Cluster Modal ── */}
      {editingCluster && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,37,64,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setEditingCluster(null)}
        >
          <div
            className="card animate-slide-up consolidation-modal-content"
            style={{
              width: "600px",
              maxWidth: "94vw",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="card-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div className="card-title">Edit Cluster</div>
                <div className="card-description">
                  Remove shipments or change vehicle assignment
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setEditingCluster(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="card-body" style={{ padding: "20px" }}>
              {/* Vehicle Selection */}
              <div style={{ marginBottom: "20px" }}>
                <label
                  className="label"
                  style={{
                    marginBottom: "8px",
                    display: "block",
                    fontWeight: 700,
                  }}
                >
                  <Truck
                    size={14}
                    style={{ marginRight: "6px", verticalAlign: "middle" }}
                  />
                  Assigned Vehicle
                </label>
                <select
                  className="input"
                  value={editVehicleId}
                  onChange={(e) => setEditVehicleId(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Select vehicle...</option>
                  {allVehicles
                    .filter((v: any) => v.is_available !== false)
                    .map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.name} — {v.max_weight_kg?.toLocaleString()}kg /{" "}
                        {v.max_volume_m3}m³
                      </option>
                    ))}
                </select>
                {editVehicleId &&
                  editVehicleId !== editingCluster.vehicleId && (
                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "11px",
                        color: "var(--lorri-primary)",
                        fontWeight: 600,
                      }}
                    >
                      Vehicle will be changed from &quot;
                      {editingCluster.vehicleName}&quot;
                    </div>
                  )}
              </div>

              {/* Shipments List */}
              <div>
                <label
                  className="label"
                  style={{
                    marginBottom: "8px",
                    display: "block",
                    fontWeight: 700,
                  }}
                >
                  <Package
                    size={14}
                    style={{ marginRight: "6px", verticalAlign: "middle" }}
                  />
                  Shipments (
                  {editingCluster.shipmentIds.length - editRemoveIds.length}{" "}
                  remaining)
                </label>
                <div
                  style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "8px",
                    border: "1px solid var(--border-secondary)",
                    overflow: "hidden",
                  }}
                >
                  {editingCluster.shipmentIds.map((sid) => {
                    const isRemoved = editRemoveIds.includes(sid);
                    return (
                      <div
                        key={sid}
                        style={{
                          padding: "10px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderBottom: "1px solid var(--border-secondary)",
                          opacity: isRemoved ? 0.4 : 1,
                          textDecoration: isRemoved ? "line-through" : "none",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--lorri-primary)",
                          }}
                        >
                          {sid.slice(0, 8).toUpperCase()}
                        </span>
                        <button
                          className={`btn btn-sm ${isRemoved ? "btn-success" : "btn-danger"}`}
                          style={{ padding: "2px 10px", fontSize: "11px" }}
                          onClick={() => {
                            if (isRemoved) {
                              setEditRemoveIds((prev) =>
                                prev.filter((id) => id !== sid),
                              );
                            } else {
                              if (
                                editingCluster.shipmentIds.length -
                                  editRemoveIds.length <=
                                1
                              )
                                return;
                              setEditRemoveIds((prev) => [...prev, sid]);
                            }
                          }}
                        >
                          {isRemoved ? "Undo" : "Remove"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {editRemoveIds.length > 0 && (
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "11px",
                      color: "var(--lorri-danger)",
                      fontWeight: 600,
                    }}
                  >
                    {editRemoveIds.length} shipment(s) will be returned to
                    pending
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                padding: "16px 20px",
                borderTop: "1px solid var(--border-secondary)",
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => setEditingCluster(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveClusterEdit}
                disabled={
                  editSaving ||
                  (editRemoveIds.length === 0 &&
                    editVehicleId === editingCluster.vehicleId)
                }
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
