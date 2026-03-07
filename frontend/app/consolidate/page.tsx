"use client";

import { useState, useEffect } from "react";
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

  const fetchVehiclesMap = () => {
    getVehicles()
      .then((data) => {
        if (data?.length) {
          const map: Record<string, { max_weight_kg: number; name: string }> = {};
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
              vehicleName: c.vehicle_name || vehiclesMap[c.vehicle_id]?.name || "Unknown Truck",
              shipmentIds: c.shipment_ids || [],
              utilizationPct: c.utilization_pct || 0,
              totalWeight: c.total_weight || 0,
              totalVolume: c.total_volume || 0,
              routeDistanceKm: c.route_distance_km || 0,
              estimatedCost: c.estimated_cost || 0,
              estimatedCo2: c.estimated_co2 || 0,
              status: c.status || "pending",
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
  }, []);

  const handleRunConsolidation = () => {
    setIsRunning(true);
    setShowResults(false);
    runConsolidation()
      .then((data) => {
        if (data && data.clusters && data.clusters.length > 0) {
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
              vehicleName: c.vehicle_name || vehiclesMap[c.vehicle_id]?.name || "Unknown Truck",
              shipmentIds: c.shipment_ids || [],
              utilizationPct: c.utilization_pct || 0,
              totalWeight: c.total_weight || 0,
              totalVolume: c.total_volume || 0,
              routeDistanceKm: c.route_distance_km || 0,
              estimatedCost: c.estimated_cost || 0,
              estimatedCo2: c.estimated_co2 || 0,
              status: c.status || "pending",
            })),
          };
          setPlan(mapped);
          setShowResults(true);
          // Refresh vehicles map in case new vehicles were added
          fetchVehiclesMap();
        } else {
          setPlan(emptyPlan);
          setShowResults(false);
        }
      })
      .catch((err) => {
        console.error("Failed to run consolidation:", err);
        setPlan(emptyPlan);
        setShowResults(false);
      })
      .finally(() => {
        setIsRunning(false);
      });
  };

  const handleClusterAction = (clusterId: string, action: string) => {
    setClusterStatuses((prev) => ({ ...prev, [clusterId]: action }));
    submitClusterFeedback(clusterId, action).catch(() => {});
  };

  const getUtilColor = (pct: number) => {
    if (pct >= 80) return "#0CAF60";
    if (pct >= 60) return "#E5850B";
    return "#DF1B41";
  };

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
                gridTemplateColumns: "repeat(4, 1fr)",
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

        {/* ── Loading State ── */}
        {isRunning && (
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                margin: "0 auto 24px",
                background: "var(--lorri-primary-light)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={32} style={{ color: "var(--lorri-primary)" }} />
            </div>
            <p
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "8px",
              }}
            >
              Running DBSCAN Clustering + 3D Bin Packing
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                marginBottom: "28px",
              }}
            >
              Analyzing 150 shipments across 15 cities · Optimizing vehicle
              assignments
            </p>
            <div
              className="progress-bar"
              style={{ maxWidth: "400px", margin: "0 auto" }}
            >
              <div
                className="progress-bar-fill purple"
                style={{
                  width: "65%",
                  background: "linear-gradient(90deg, #635BFF, #8B5CF6)",
                }}
              />
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {showResults && !isRunning && (
          <div className="animate-slide-up">
            {/* Before vs After + Chart Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
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
                      gridTemplateColumns: "1fr 1fr",
                      gap: "18px",
                    }}
                  >
                    {[
                      { val: plan.tripsBefore, label: "Total Trips" },
                      { val: "58%", label: "Utilization" },
                      { val: "₹4.5L", label: "Total Cost" },
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
                    { label: "Trips", pct: "▼ 34%", cls: "green" },
                    { label: "Cost", pct: "▼ 31%", cls: "green" },
                    { label: "CO₂", pct: "▼ 33%", cls: "green" },
                    { label: "Utilization", pct: "▲ 29%", cls: "purple" },
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
                      gridTemplateColumns: "1fr 1fr",
                      gap: "18px",
                    }}
                  >
                    {[
                      {
                        val: plan.tripsAfter,
                        label: "Total Trips",
                        pct: "▼34%",
                      },
                      { val: "87%", label: "Utilization", pct: "▲29%" },
                      { val: "₹3.1L", label: "Total Cost", pct: "▼31%" },
                      { val: `${plan.co2After} kg`, label: "CO₂", pct: "▼33%" },
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
              <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📦</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
                  No Consolidation Plan Found
                </h3>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px" }}>
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
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
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
                            <Truck size={14} style={{ color: "var(--lorri-primary)" }} />
                            <span>{cluster.vehicleName || vehiclesMap[cluster.vehicleId]?.name || "Unknown Truck"}</span>
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
                          gridTemplateColumns: "1fr 1fr",
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
                            : "✗ Cluster rejected"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
