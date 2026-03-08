"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Layers,
  Clock,
  Fuel,
  Navigation,
  ChevronRight,
  ChevronDown,
  MapPin,
  Truck,
  Loader2,
  Zap,
  Package,
  ArrowDown,
  History,
  Weight,
  Calendar,
  Sun,
  Moon,
} from "lucide-react";
import { type Route as RouteType } from "@/lib/mock-data";
import { getRoutes } from "@/lib/api";

const LeafletMap = dynamic(() => import("@/components/ui/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        background:
          "linear-gradient(135deg, #0c1427 0%, #162032 50%, #0f1a2e 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <Loader2
          size={28}
          style={{
            color: "var(--lorri-primary)",
            animation: "spin 1s linear infinite",
          }}
        />
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "13px",
            marginTop: "12px",
          }}
        >
          Loading map...
        </p>
      </div>
    </div>
  ),
});

/* ─── helpers ─── */
function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const STOP_ICON: Record<
  string,
  { emoji: string; color: string; label: string }
> = {
  depot: { emoji: "🏭", color: "#f59e0b", label: "Depot" },
  pickup: { emoji: "📦", color: "#0ea5e9", label: "Pickup" },
  delivery: { emoji: "📍", color: "#10b981", label: "Delivery" },
};

export default function RoutesPage() {
  const [allRoutes, setAllRoutes] = useState<RouteType[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteType | null>(null);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"after" | "before">("after");
  const [mapTheme, setMapTheme] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("latest");

  useEffect(() => {
    setLoading(true);
    getRoutes()
      .then((data) => {
        if (data?.length) {
          const mapped: RouteType[] = data.map((r: any) => ({
            id: r.id,
            clusterId: r.cluster_id,
            vehicleName: r.vehicle_name,
            points: r.points || [],
            totalDistanceKm: r.total_distance_km,
            estimatedTime: r.estimated_time,
            fuelCost: r.fuel_cost,
            color: r.color,
            planId: r.plan_id || "",
            planName: r.plan_name || "",
            planCreatedAt: r.plan_created_at || "",
            planStatus: r.plan_status || "",
            clusterStatus: r.cluster_status || "",
          }));
          setAllRoutes(mapped);
        } else {
          setAllRoutes([]);
        }
      })
      .catch(() => setAllRoutes([]))
      .finally(() => setLoading(false));
  }, []);

  /* ─── group by plan (run) ─── */
  const planGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        planId: string;
        planName: string;
        planCreatedAt: string;
        routes: RouteType[];
      }
    >();
    for (const r of allRoutes) {
      const pid = r.planId || "unknown";
      if (!map.has(pid)) {
        map.set(pid, {
          planId: pid,
          planName: r.planName || "Consolidation Run",
          planCreatedAt: r.planCreatedAt || "",
          routes: [],
        });
      }
      map.get(pid)!.routes.push(r);
    }
    // sort by date desc
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.planCreatedAt).getTime() -
        new Date(a.planCreatedAt).getTime(),
    );
  }, [allRoutes]);

  // Active routes for the selected run
  const routes = useMemo(() => {
    if (planGroups.length === 0) return [];
    if (selectedPlanId === "latest") return planGroups[0]?.routes || [];
    return planGroups.find((g) => g.planId === selectedPlanId)?.routes || [];
  }, [planGroups, selectedPlanId]);

  // Auto-select first route when routes change
  useEffect(() => {
    if (routes.length > 0 && !routes.find((r) => r.id === selectedRoute?.id)) {
      setSelectedRoute(routes[0]);
      setExpandedRoute(routes[0].id);
    } else if (routes.length === 0) {
      setSelectedRoute(null);
      setExpandedRoute(null);
    }
  }, [routes]);

  const handleSelectRoute = useCallback((route: RouteType) => {
    setSelectedRoute(route);
    setExpandedRoute(route.id);
  }, []);

  const totalDistance = useMemo(
    () => routes.reduce((s, r) => s + r.totalDistanceKm, 0),
    [routes],
  );
  const totalFuel = useMemo(
    () => routes.reduce((s, r) => s + r.fuelCost, 0),
    [routes],
  );
  const totalStops = useMemo(
    () => routes.reduce((s, r) => s + r.points.length, 0),
    [routes],
  );
  const totalPickups = useMemo(
    () =>
      routes.reduce(
        (s, r) => s + r.points.filter((p) => p.type === "pickup").length,
        0,
      ),
    [routes],
  );
  const totalDeliveries = useMemo(
    () =>
      routes.reduce(
        (s, r) => s + r.points.filter((p) => p.type === "delivery").length,
        0,
      ),
    [routes],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Route Visualization</h1>
          <p className="page-subtitle">
            Optimized delivery routes with pickup→delivery ordering & load
            tracking
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Run history selector */}
          {planGroups.length > 1 && (
            <div style={{ position: "relative" }}>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="input"
                style={{
                  fontSize: "12px",
                  padding: "6px 32px 6px 10px",
                  minWidth: 220,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                }}
              >
                {planGroups.map((g, i) => (
                  <option key={g.planId} value={i === 0 ? "latest" : g.planId}>
                    {i === 0 ? "⚡ Latest" : `📋 Run ${planGroups.length - i}`}
                    {" — "}
                    {g.routes.length} routes · {formatDate(g.planCreatedAt)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="tabs">
            <button
              className={`tab ${viewMode === "before" ? "active" : ""}`}
              onClick={() => setViewMode("before")}
            >
              Before
            </button>
            <button
              className={`tab ${viewMode === "after" ? "active" : ""}`}
              onClick={() => setViewMode("after")}
            >
              Consolidated
            </button>
          </div>
          <button
            onClick={() => setMapTheme(mapTheme === "dark" ? "light" : "dark")}
            title={
              mapTheme === "dark" ? "Switch to light map" : "Switch to dark map"
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background:
                mapTheme === "dark"
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
              transition: "all 0.2s ease",
              marginLeft: "8px",
            }}
          >
            {mapTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            {mapTheme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* ── Empty state ── */}
        {!loading && allRoutes.length === 0 && (
          <div
            className="card animate-fade-in"
            style={{ textAlign: "center", padding: "80px 24px" }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🗺️</div>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 700,
                marginBottom: "8px",
                color: "var(--text-primary)",
              }}
            >
              No Routes Generated Yet
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                maxWidth: "420px",
                margin: "0 auto 24px",
              }}
            >
              Routes are created when you run the AI consolidation engine. Add
              shipments first, then run consolidation.
            </p>
            <div
              style={{ display: "flex", gap: "12px", justifyContent: "center" }}
            >
              <Link
                href="/consolidate"
                className="btn btn-primary"
                style={{ textDecoration: "none" }}
              >
                <Zap size={16} /> Run Consolidation
              </Link>
              <Link
                href="/shipments"
                className="btn btn-secondary"
                style={{ textDecoration: "none" }}
              >
                Add Shipments
              </Link>
            </div>
          </div>
        )}

        {routes.length > 0 && (
          <>
            {/* ── Run info banner ── */}
            {planGroups.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  marginBottom: 12,
                  borderRadius: "var(--radius-md)",
                  background: "rgba(99,91,255,0.04)",
                  border: "1px solid rgba(99,91,255,0.10)",
                  fontSize: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--text-secondary)",
                  }}
                >
                  <Calendar size={13} style={{ color: "#635BFF" }} />
                  <span
                    style={{ fontWeight: 600, color: "var(--text-primary)" }}
                  >
                    {selectedPlanId === "latest"
                      ? planGroups[0]?.planName
                      : planGroups.find((g) => g.planId === selectedPlanId)
                          ?.planName}
                  </span>
                  <span style={{ color: "var(--text-tertiary)" }}>·</span>
                  <span>
                    {formatDate(
                      (selectedPlanId === "latest"
                        ? planGroups[0]
                        : planGroups.find((g) => g.planId === selectedPlanId)
                      )?.planCreatedAt || "",
                    )}
                  </span>
                </div>
                {planGroups.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--text-tertiary)",
                      fontSize: "11px",
                    }}
                  >
                    <History size={11} />
                    {planGroups.length} runs in history
                  </div>
                )}
              </div>
            )}

            {/* ── Summary Stats ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              {[
                {
                  label: "Routes",
                  value: routes.length,
                  icon: Navigation,
                  color: "#635BFF",
                },
                {
                  label: "Total Distance",
                  value: `${totalDistance.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`,
                  icon: MapPin,
                  color: "#8b5cf6",
                },
                {
                  label: "Pickups",
                  value: totalPickups,
                  icon: Package,
                  color: "#0ea5e9",
                },
                {
                  label: "Deliveries",
                  value: totalDeliveries,
                  icon: ArrowDown,
                  color: "#10b981",
                },
                {
                  label: "Fuel Cost",
                  value: `₹${totalFuel.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                  icon: Fuel,
                  color: "#f59e0b",
                },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="card"
                    style={{
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "var(--radius-md)",
                        background: `${stat.color}12`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} style={{ color: stat.color }} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "var(--text-tertiary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {stat.label}
                      </div>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {stat.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Map + Sidebar ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 380px",
                gap: "16px",
              }}
            >
              {/* Map */}
              <div
                className="card"
                style={{
                  overflow: "hidden",
                  height: "620px",
                  position: "relative",
                }}
              >
                <LeafletMap
                  routes={routes}
                  selectedRoute={selectedRoute}
                  onSelectRoute={handleSelectRoute}
                  viewMode={viewMode}
                  mapTheme={mapTheme}
                />

                {/* Overlay badges */}
                <div
                  style={{
                    position: "absolute",
                    top: "14px",
                    right: "14px",
                    zIndex: 1000,
                    display: "flex",
                    gap: "6px",
                  }}
                >
                  <span
                    className={`badge ${viewMode === "after" ? "badge-success" : "badge-warning"}`}
                    style={{
                      backdropFilter: "blur(8px)",
                      background:
                        viewMode === "after"
                          ? "rgba(16, 185, 129, 0.8)"
                          : "rgba(245, 158, 11, 0.8)",
                    }}
                  >
                    {viewMode === "after"
                      ? "✓ Consolidated Routes"
                      : "⚠ Pre-Consolidation"}
                  </span>
                </div>

                {/* Map legend */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "14px",
                    left: "14px",
                    zIndex: 1000,
                    background: mapTheme === "dark" ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(10px)",
                    border: mapTheme === "dark" ? "1px solid var(--border-primary)" : "1px solid rgba(0,0,0,0.1)",
                    borderRadius: "var(--radius-md)",
                    padding: "10px 14px",
                    fontSize: "11px",
                    minWidth: 130,
                    boxShadow: mapTheme === "light" ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: "8px",
                      color: mapTheme === "dark" ? "var(--text-primary)" : "#1e293b",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Legend
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: mapTheme === "dark" ? "var(--text-secondary)" : "#475569",
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#f59e0b",
                        }}
                      />{" "}
                      Depot
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: mapTheme === "dark" ? "var(--text-secondary)" : "#475569",
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#0ea5e9",
                        }}
                      />{" "}
                      Pickup
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: mapTheme === "dark" ? "var(--text-secondary)" : "#475569",
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#10b981",
                        }}
                      />{" "}
                      Delivery
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: mapTheme === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    {routes.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          marginBottom: "3px",
                          cursor: "pointer",
                          opacity: selectedRoute?.id === r.id ? 1 : 0.5,
                          transition: "opacity 0.2s",
                        }}
                        onClick={() => handleSelectRoute(r)}
                      >
                        <div
                          style={{
                            width: "14px",
                            height: "3px",
                            background: r.color,
                            borderRadius: "2px",
                            boxShadow:
                              selectedRoute?.id === r.id
                                ? `0 0 6px ${r.color}`
                                : "none",
                          }}
                        />
                        <span
                          style={{
                            color:
                              selectedRoute?.id === r.id
                                ? "var(--text-primary)"
                                : "var(--text-tertiary)",
                            fontSize: "10px",
                          }}
                        >
                          {r.vehicleName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Route Details Sidebar ── */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  height: "620px",
                  overflowY: "auto",
                  overflowX: "hidden",
                  scrollbarWidth: "thin",
                  paddingRight: "4px",
                }}
              >
                <div
                  className="card"
                  style={{
                    padding: "12px 16px",
                    position: "sticky",
                    top: 0,
                    zIndex: 5,
                    background: "var(--bg-card)",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Truck size={15} style={{ color: "#635BFF" }} />
                    Route Details
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-tertiary)",
                      marginTop: "2px",
                    }}
                  >
                    {routes.length} routes · Click to expand · Scroll for more
                  </div>
                </div>

                {routes.map((route) => {
                  const isSelected = selectedRoute?.id === route.id;
                  const isExpanded = expandedRoute === route.id;
                  const pickups = route.points.filter(
                    (p) => p.type === "pickup",
                  );
                  const deliveries = route.points.filter(
                    (p) => p.type === "delivery",
                  );
                  const maxLoad = Math.max(
                    ...route.points.map((p) => p.current_load_kg || 0),
                    0,
                  );

                  return (
                    <div
                      key={route.id}
                      className="card"
                      onClick={() => handleSelectRoute(route)}
                      style={{
                        cursor: "pointer",
                        borderColor: isSelected ? route.color : undefined,
                        boxShadow: isSelected
                          ? `0 0 12px ${route.color}20`
                          : undefined,
                        transition: "all 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ padding: "14px 16px" }}>
                        {/* ── Route Header ── */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: isExpanded ? 12 : 0,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRoute(route);
                            setExpandedRoute(isExpanded ? null : route.id);
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "var(--radius-md)",
                              background: `${route.color}15`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Truck size={15} style={{ color: route.color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: 700,
                                color: "var(--text-primary)",
                              }}
                            >
                              {route.vehicleName}
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                color: "var(--text-tertiary)",
                                display: "flex",
                                gap: 8,
                                marginTop: 1,
                              }}
                            >
                              <span>Cluster {route.clusterId?.slice(-4)}</span>
                              <span>·</span>
                              <span style={{ color: "#0ea5e9" }}>
                                {pickups.length} pickups
                              </span>
                              <span>→</span>
                              <span style={{ color: "#10b981" }}>
                                {deliveries.length} deliveries
                              </span>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                color: route.color,
                              }}
                            >
                              {route.totalDistanceKm.toFixed(0)} km
                            </span>
                            {isExpanded ? (
                              <ChevronDown
                                size={14}
                                style={{
                                  color: route.color,
                                  transition: "transform 0.2s",
                                }}
                              />
                            ) : (
                              <ChevronRight
                                size={14}
                                style={{
                                  color: "var(--text-tertiary)",
                                  transition: "transform 0.2s",
                                }}
                              />
                            )}
                          </div>
                        </div>

                        {/* ── Expanded: Stop Timeline ── */}
                        {isExpanded && (
                          <div style={{ animation: "fadeIn 0.2s ease" }}>
                            {/* Route flow summary */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 10px",
                                marginBottom: 10,
                                borderRadius: "var(--radius-sm)",
                                background: "rgba(99,91,255,0.04)",
                                border: "1px solid rgba(99,91,255,0.08)",
                                fontSize: "11px",
                                color: "var(--text-secondary)",
                              }}
                            >
                              <span
                                style={{ color: "#f59e0b", fontWeight: 700 }}
                              >
                                🏭 Depot
                              </span>
                              <span>→</span>
                              <span
                                style={{ color: "#0ea5e9", fontWeight: 600 }}
                              >
                                📦 Pickup
                              </span>
                              <span>→</span>
                              <span
                                style={{ color: "#10b981", fontWeight: 600 }}
                              >
                                📍 Deliver
                              </span>
                              {pickups.length > 1 && (
                                <>
                                  <span>→</span>
                                  <span
                                    style={{
                                      color: "#94a3b8",
                                      fontWeight: 500,
                                    }}
                                  >
                                    ... × {pickups.length}
                                  </span>
                                </>
                              )}
                              <span>→</span>
                              <span
                                style={{ color: "#f59e0b", fontWeight: 700 }}
                              >
                                🏭 Depot
                              </span>
                            </div>

                            {/* Stop timeline */}
                            <div
                              style={{ position: "relative", paddingLeft: 20 }}
                            >
                              {/* Vertical line */}
                              <div
                                style={{
                                  position: "absolute",
                                  left: 7,
                                  top: 8,
                                  bottom: 8,
                                  width: 2,
                                  background: `linear-gradient(to bottom, #f59e0b 0%, #0ea5e9 35%, #10b981 70%, #f59e0b 100%)`,
                                  borderRadius: 2,
                                  opacity: 0.3,
                                }}
                              />

                              {route.points.map((point, i) => {
                                const info =
                                  STOP_ICON[point.type] || STOP_ICON.depot;
                                const isFirst = i === 0;
                                const isLast = i === route.points.length - 1;

                                return (
                                  <div
                                    key={i}
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: 10,
                                      position: "relative",
                                      padding: "5px 0",
                                    }}
                                  >
                                    {/* Dot */}
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: -16,
                                        top: 9,
                                        width: 12,
                                        height: 12,
                                        borderRadius: "50%",
                                        background: info.color,
                                        border: `2px solid var(--bg-card)`,
                                        zIndex: 2,
                                        boxShadow: `0 0 0 2px ${info.color}30`,
                                      }}
                                    />

                                    {/* Stop content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        <span style={{ fontSize: "12px" }}>
                                          {info.emoji}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: "12px",
                                            fontWeight:
                                              isFirst || isLast ? 700 : 500,
                                            color:
                                              isFirst || isLast
                                                ? "var(--text-primary)"
                                                : "var(--text-secondary)",
                                          }}
                                        >
                                          {point.city}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: "9px",
                                            padding: "1px 5px",
                                            borderRadius: 3,
                                            background: `${info.color}15`,
                                            color: info.color,
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.3px",
                                          }}
                                        >
                                          {info.label}
                                        </span>
                                      </div>

                                      {/* Load info for non-depot stops */}
                                      {point.type !== "depot" &&
                                        (point.weight_kg ||
                                          point.current_load_kg) && (
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              marginTop: 3,
                                              fontSize: "10px",
                                              color: "var(--text-tertiary)",
                                            }}
                                          >
                                            {point.weight_kg ? (
                                              <span>
                                                {point.type === "pickup"
                                                  ? "+"
                                                  : "−"}
                                                {point.weight_kg.toLocaleString()}{" "}
                                                kg
                                              </span>
                                            ) : null}
                                            {point.current_load_kg !==
                                              undefined && (
                                              <>
                                                <span>·</span>
                                                <span>
                                                  Load:{" "}
                                                  {point.current_load_kg.toLocaleString()}{" "}
                                                  kg
                                                </span>
                                                {point.load_pct !==
                                                  undefined && (
                                                  <span
                                                    style={{
                                                      padding: "0 4px",
                                                      borderRadius: 3,
                                                      fontSize: "9px",
                                                      fontWeight: 700,
                                                      background:
                                                        point.load_pct > 90
                                                          ? "rgba(239,68,68,0.12)"
                                                          : point.load_pct > 70
                                                            ? "rgba(245,158,11,0.12)"
                                                            : "rgba(16,185,129,0.12)",
                                                      color:
                                                        point.load_pct > 90
                                                          ? "#ef4444"
                                                          : point.load_pct > 70
                                                            ? "#f59e0b"
                                                            : "#10b981",
                                                    }}
                                                  >
                                                    {point.load_pct.toFixed(0)}%
                                                  </span>
                                                )}
                                              </>
                                            )}
                                            {point.shipment_code && (
                                              <>
                                                <span>·</span>
                                                <span
                                                  style={{
                                                    fontFamily: "monospace",
                                                    fontSize: "9px",
                                                  }}
                                                >
                                                  {point.shipment_code}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        )}
                                    </div>

                                    {/* Stop number */}
                                    <div
                                      style={{
                                        fontSize: "9px",
                                        color: "var(--text-tertiary)",
                                        fontWeight: 600,
                                        flexShrink: 0,
                                        width: 16,
                                        textAlign: "right",
                                      }}
                                    >
                                      {i + 1}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Load progress bar (if data available) */}
                            {maxLoad > 0 && (
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: "8px 10px",
                                  background: "rgba(99,91,255,0.03)",
                                  borderRadius: "var(--radius-sm)",
                                  border: "1px solid rgba(99,91,255,0.06)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: "10px",
                                    marginBottom: 4,
                                  }}
                                >
                                  <span
                                    style={{
                                      color: "var(--text-tertiary)",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Peak Load
                                  </span>
                                  <span
                                    style={{
                                      color: "var(--text-secondary)",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {maxLoad.toLocaleString()} kg
                                  </span>
                                </div>
                                <div
                                  style={{
                                    width: "100%",
                                    height: 4,
                                    background: "var(--border-secondary)",
                                    borderRadius: 2,
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "100%",
                                      width: `${Math.min(100, Math.max(...route.points.map((p) => p.load_pct || 0)))}%`,
                                      background: `linear-gradient(90deg, #10b981, ${Math.max(...route.points.map((p) => p.load_pct || 0)) > 85 ? "#ef4444" : "#0ea5e9"})`,
                                      borderRadius: 2,
                                      transition: "width 0.3s",
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Route Metrics */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                gap: "8px",
                                marginTop: 10,
                                paddingTop: 10,
                                borderTop: "1px solid var(--border-secondary)",
                              }}
                            >
                              <div style={{ textAlign: "center" }}>
                                <div
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--text-tertiary)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 3,
                                  }}
                                >
                                  <MapPin size={9} /> Distance
                                </div>
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    color: "var(--text-primary)",
                                    marginTop: 2,
                                  }}
                                >
                                  {route.totalDistanceKm.toFixed(0)} km
                                </div>
                              </div>
                              <div style={{ textAlign: "center" }}>
                                <div
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--text-tertiary)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 3,
                                  }}
                                >
                                  <Clock size={9} /> ETA
                                </div>
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    color: "var(--text-primary)",
                                    marginTop: 2,
                                  }}
                                >
                                  {route.estimatedTime}
                                </div>
                              </div>
                              <div style={{ textAlign: "center" }}>
                                <div
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--text-tertiary)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 3,
                                  }}
                                >
                                  <Fuel size={9} /> Cost
                                </div>
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    color: "var(--text-primary)",
                                    marginTop: 2,
                                  }}
                                >
                                  ₹
                                  {route.fuelCost.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Collapsed mini-summary */}
                        {!isExpanded && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginTop: 8,
                              fontSize: "10px",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            <span style={{ color: "#f59e0b" }}>🏭</span>
                            {route.points
                              .filter((p) => p.type !== "depot")
                              .slice(0, 4)
                              .map((p, i) => (
                                <span
                                  key={i}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 2,
                                  }}
                                >
                                  {i > 0 && (
                                    <span style={{ margin: "0 2px" }}>→</span>
                                  )}
                                  <span
                                    style={{
                                      color:
                                        p.type === "pickup"
                                          ? "#0ea5e9"
                                          : "#10b981",
                                    }}
                                  >
                                    {p.type === "pickup" ? "📦" : "📍"}
                                  </span>
                                  {p.city}
                                </span>
                              ))}
                            {route.points.filter((p) => p.type !== "depot")
                              .length > 4 && (
                              <span>
                                +
                                {route.points.filter((p) => p.type !== "depot")
                                  .length - 4}{" "}
                                more
                              </span>
                            )}
                            <span style={{ color: "#f59e0b" }}>→ 🏭</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
