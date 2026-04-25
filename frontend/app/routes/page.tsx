"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Play,
  User,
  X,
  RefreshCw,
} from "lucide-react";
import { type Route as RouteType } from "@/lib/mock-data";
import { getRoutes, getNearbyDrivers, assignDriverTask, updateDriverLocation, autoAssignDrivers, simulateCompleteTask, getRouteAssignments, startDriverTask, getAllDriverPositions, getLiveJourneyPositions, type NearbyDriver, type DriverAssignment, type DriverPosition, type LiveJourneyPosition } from "@/lib/api";
import type { TruckSimulation, LiveDriver } from "@/components/ui/LeafletMap";
import type { SimulationState } from "@/components/ui/SimulationPanel";

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

const SimulationPanel = dynamic(
  () => import("@/components/ui/SimulationPanel"),
  { ssr: false },
);

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

  // ─── Live Tracking ─────────────────────────────────────
  const [liveMode, setLiveMode] = useState(false);
  const [liveDrivers, setLiveDrivers] = useState<LiveDriver[]>([]);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!liveMode) {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
      if (liveJourneyRef.current) clearInterval(liveJourneyRef.current);
      liveJourneyRef.current = null;
      setLiveDrivers([]);
      setLiveJourneyPositions([]);
      return;
    }
    const poll = async () => {
      try {
        const [positionsData, journeyData] = await Promise.all([
          getAllDriverPositions(),
          getLiveJourneyPositions(),
        ]);
        const journeyDriverIds = new Set((journeyData || []).map((j: LiveJourneyPosition) => j.driver_id));
        const combined: LiveDriver[] = [];
        for (const j of (journeyData || [])) {
          combined.push({
            driver_id: j.driver_id,
            name: `${j.name} (${Math.round(j.progress_pct)}%)`,
            is_online: j.is_online,
            lat: j.lat, lng: j.lng,
            heading: null, speed_kmh: 0,
          });
        }
        for (const d of (positionsData || [])) {
          if (!journeyDriverIds.has(d.driver_id)) {
            const statusLabel = d.driver_status === "idle_at_home" ? "Home"
              : d.driver_status === "idle_at_depot" ? "Depot"
              : d.driver_status === "assigned" ? "Assigned"
              : d.driver_status;
            combined.push({
              driver_id: d.driver_id,
              name: `${d.name} (${statusLabel})`,
              is_online: d.is_online,
              lat: d.lat, lng: d.lng,
              heading: null, speed_kmh: 0,
            });
          }
        }
        setLiveDrivers(combined);
        setLiveJourneyPositions(journeyData || []);
      } catch { /* silent */ }
    };
    poll();
    liveIntervalRef.current = setInterval(poll, 5000);
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      if (liveJourneyRef.current) clearInterval(liveJourneyRef.current);
    };
  }, [liveMode]);

  // ─── Driver Assignments (persisted) ────────────────────
  const [routeDriverMap, setRouteDriverMap] = useState<Record<string, DriverAssignment>>({});
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const [allDriverPositions, setAllDriverPositions] = useState<DriverPosition[]>([]);
  const [liveJourneyPositions, setLiveJourneyPositions] = useState<LiveJourneyPosition[]>([]);
  const liveJourneyRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildDriverMap = useCallback((assignments: DriverAssignment[]) => {
    const map: Record<string, DriverAssignment> = {};
    for (const a of assignments) map[a.route_id] = a;
    setRouteDriverMap(map);
  }, []);

  // On routes change, fetch EXISTING assignments (no new creation)
  useEffect(() => {
    if (routes.length === 0) { setRouteDriverMap({}); return; }
    const routeIds = routes.map((r) => r.id);
    setAutoAssigning(true);
    getRouteAssignments(routeIds)
      .then((result) => buildDriverMap(result.assignments))
      .catch(() => {})
      .finally(() => setAutoAssigning(false));
  }, [routes, buildDriverMap]);

  // Explicit "Assign Drivers" — only called on button click
  const handleAutoAssign = useCallback((force = false) => {
    if (routes.length === 0) return;
    const routeIds = routes.map((r) => r.id);
    setAutoAssigning(true);
    autoAssignDrivers(routeIds, force)
      .then((result) => {
        console.log("[AutoAssign] result:", result);
        buildDriverMap(result.assignments);
      })
      .catch((err) => console.error("[AutoAssign] error:", err))
      .finally(() => setAutoAssigning(false));
  }, [routes, buildDriverMap]);

  // ─── Simulation Engine ─────────────────────────────────
  const [showSimPanel, setShowSimPanel] = useState(false);
  const [assignedDriver, setAssignedDriver] = useState<{ id: string; name: string } | null>(null);
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<NearbyDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);

  const [simState, setSimState] = useState<SimulationState>({
    isRunning: false, isPaused: false, speed: 1,
    currentStopIndex: 0, completedStops: [],
    elapsedSimTime: 0, totalSimTime: 0,
    truckPosition: null, currentCity: "",
    phase: "idle",
  });

  const [truckSim, setTruckSim] = useState<TruckSimulation | null>(null);

  const simRef = useRef<{
    animFrameId: number | null;
    lastTimestamp: number;
    roadPath: [number, number][];
    segDistances: number[];
    totalDistance: number;
    traveledDistance: number;
    stopDistances: number[];
    dwellTimer: number;
    lastLocationPush: number;
    trailPath: [number, number][];
  }>({
    animFrameId: null, lastTimestamp: 0, roadPath: [],
    segDistances: [], totalDistance: 0, traveledDistance: 0,
    stopDistances: [], dwellTimer: 0, lastLocationPush: 0,
    trailPath: [],
  });

  const loadDrivers = useCallback(async () => {
    setDriversLoading(true);
    try {
      const startPt = selectedRoute?.points?.[0];
      if (startPt) {
        const data = await getNearbyDrivers(startPt.lat, startPt.lng);
        setAvailableDrivers(data || []);
      } else {
        setAvailableDrivers([]);
      }
    } catch { /* ignore */ }
    setDriversLoading(false);
  }, [selectedRoute]);

  const handleAssignDriver = useCallback(async (driver: any) => {
    if (!selectedRoute) return;
    try {
      await assignDriverTask(driver.id, selectedRoute.id);
    } catch { /* proceed even if task creation fails for prototype */ }
    setAssignedDriver({ id: driver.id, name: driver.name });
    setDriverModalOpen(false);

    setSimState((prev) => ({
      ...prev,
      phase: "assigned",
      currentStopIndex: 0,
      completedStops: [],
      elapsedSimTime: 0,
      truckPosition: selectedRoute.points[0]
        ? { lat: selectedRoute.points[0].lat, lng: selectedRoute.points[0].lng }
        : null,
      currentCity: selectedRoute.points[0]?.city || "",
    }));

    const startPt = selectedRoute.points[0];
    if (startPt) {
      setTruckSim({
        position: { lat: startPt.lat, lng: startPt.lng },
        heading: 0,
        currentStopIndex: 0,
        completedStops: [],
        phase: "assigned",
        trailPath: [],
      });
    }
    setShowSimPanel(true);
  }, [selectedRoute]);

  const startSimulation = useCallback(async () => {
    if (!selectedRoute) return;
    const points = selectedRoute.points;
    if (points.length < 2) return;

    // Mark task as started (en_route) in the backend
    const taskId = routeDriverMap[selectedRoute.id]?.task_id;
    if (taskId) {
      startDriverTask(taskId).catch(() => {});
    }

    // Fetch OSRM road route
    const { fetchRoadRoute } = await import("@/components/ui/LeafletMap");
    let roadPath: [number, number][] | null = null;
    try {
      const result = await fetchRoadRoute(points);
      if (result) {
        roadPath = result.map((p) => {
          if (Array.isArray(p)) return [p[0] as number, p[1] as number] as [number, number];
          const ll = p as { lat: number; lng: number };
          return [ll.lat, ll.lng] as [number, number];
        });
      }
    } catch { /* fallback to straight lines */ }

    if (!roadPath || roadPath.length < 2) {
      roadPath = points.map((p) => [p.lat, p.lng] as [number, number]);
    }

    // Calculate segment distances and total
    const segDistances: number[] = [];
    let totalDist = 0;
    for (let i = 1; i < roadPath.length; i++) {
      const dlat = roadPath[i][0] - roadPath[i - 1][0];
      const dlng = roadPath[i][1] - roadPath[i - 1][1];
      const d = Math.sqrt(dlat * dlat + dlng * dlng);
      segDistances.push(d);
      totalDist += d;
    }

    // Find the road-path index closest to each route stop
    const stopDistances: number[] = [];
    for (const stop of points) {
      let bestDist = Infinity;
      let bestAccum = 0;
      let accum = 0;
      for (let i = 0; i < roadPath.length; i++) {
        const dlat = roadPath[i][0] - stop.lat;
        const dlng = roadPath[i][1] - stop.lng;
        const d = dlat * dlat + dlng * dlng;
        if (d < bestDist) {
          bestDist = d;
          bestAccum = accum;
        }
        if (i < segDistances.length) accum += segDistances[i];
      }
      stopDistances.push(bestAccum);
    }

    const avgSpeedDeg = totalDist / (selectedRoute.totalDistanceKm / 50 * 3600);
    const totalSimTimeSec = totalDist / (avgSpeedDeg || 0.0001);

    simRef.current = {
      animFrameId: null,
      lastTimestamp: 0,
      roadPath,
      segDistances,
      totalDistance: totalDist,
      traveledDistance: 0,
      stopDistances,
      dwellTimer: 0,
      lastLocationPush: 0,
      trailPath: [roadPath[0]],
    };

    setSimState((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      phase: "traveling",
      totalSimTime: totalSimTimeSec,
      elapsedSimTime: 0,
      currentStopIndex: 0,
      completedStops: [],
      currentCity: points[0]?.city || "",
    }));

    const animate = (timestamp: number) => {
      const ref = simRef.current;
      if (!ref.lastTimestamp) ref.lastTimestamp = timestamp;
      const rawDelta = (timestamp - ref.lastTimestamp) / 1000;
      ref.lastTimestamp = timestamp;

      setSimState((prev) => {
        if (prev.isPaused || prev.phase === "completed") {
          ref.animFrameId = requestAnimationFrame(animate);
          return prev;
        }

        const delta = rawDelta * prev.speed;

        // Dwell time at stops
        if (ref.dwellTimer > 0) {
          ref.dwellTimer -= delta;
          if (ref.dwellTimer > 0) {
            ref.animFrameId = requestAnimationFrame(animate);
            return { ...prev, elapsedSimTime: prev.elapsedSimTime + delta };
          }
          // Dwell done - continue traveling
          return { ...prev, phase: "traveling", elapsedSimTime: prev.elapsedSimTime + delta };
        }

        // Move truck
        const speed = ref.totalDistance / (totalSimTimeSec || 1);
        ref.traveledDistance += speed * delta;

        // Check if arrived at next stop
        const nextStopIdx = prev.currentStopIndex + 1;
        if (nextStopIdx < stopDistances.length && ref.traveledDistance >= stopDistances[nextStopIdx]) {
          const newCompleted = [...prev.completedStops, prev.currentStopIndex];
          ref.dwellTimer = 3; // 3 sim-seconds dwell
          const isLast = nextStopIdx >= points.length - 1;

          const stopPt = points[nextStopIdx];
          const pos = { lat: stopPt.lat, lng: stopPt.lng };

          setTruckSim({
            position: pos,
            heading: 0,
            currentStopIndex: nextStopIdx,
            completedStops: newCompleted,
            phase: isLast ? "completed" : "at_stop",
            trailPath: ref.trailPath.map(([lat, lng]) => [lat, lng] as [number, number]),
          });

          // Push location to backend
          if (assignedDriver) {
            updateDriverLocation({
              driver_id: assignedDriver.id,
              lat: pos.lat, lng: pos.lng,
              heading: 0, speed_kmh: 0,
            }).catch(() => {});
          }

          if (isLast) {
            return {
              ...prev,
              phase: "completed",
              isRunning: false,
              currentStopIndex: nextStopIdx,
              completedStops: [...newCompleted, nextStopIdx],
              elapsedSimTime: prev.totalSimTime,
              currentCity: stopPt.city,
            };
          }

          ref.animFrameId = requestAnimationFrame(animate);
          return {
            ...prev,
            phase: "at_stop",
            currentStopIndex: nextStopIdx,
            completedStops: newCompleted,
            elapsedSimTime: prev.elapsedSimTime + delta,
            currentCity: stopPt.city,
          };
        }

        // Interpolate position along road path
        let accum = 0;
        let segIdx = 0;
        for (; segIdx < ref.segDistances.length; segIdx++) {
          if (accum + ref.segDistances[segIdx] >= ref.traveledDistance) break;
          accum += ref.segDistances[segIdx];
        }
        if (segIdx >= ref.segDistances.length) segIdx = ref.segDistances.length - 1;

        const segLen = ref.segDistances[segIdx] || 1;
        const frac = Math.min(1, (ref.traveledDistance - accum) / segLen);
        const lat = ref.roadPath[segIdx][0] + (ref.roadPath[segIdx + 1]?.[0] ?? ref.roadPath[segIdx][0] - ref.roadPath[segIdx][0]) * frac;
        const lng = ref.roadPath[segIdx][1] + (ref.roadPath[segIdx + 1]?.[1] ?? ref.roadPath[segIdx][1] - ref.roadPath[segIdx][1]) * frac;

        // Heading calculation
        const nextPt = ref.roadPath[Math.min(segIdx + 1, ref.roadPath.length - 1)];
        const heading = Math.atan2(
          nextPt[1] - ref.roadPath[segIdx][1],
          nextPt[0] - ref.roadPath[segIdx][0],
        ) * (180 / Math.PI);

        // Add to trail
        ref.trailPath.push([lat, lng]);
        if (ref.trailPath.length > 500) ref.trailPath = ref.trailPath.slice(-400);

        const pos = { lat, lng };

        setTruckSim({
          position: pos,
          heading: 90 - heading,
          currentStopIndex: prev.currentStopIndex,
          completedStops: prev.completedStops,
          phase: "traveling",
          trailPath: ref.trailPath.map(([la, ln]) => [la, ln] as [number, number]),
        });

        // Push location to backend periodically (every 2 real seconds)
        const now = Date.now();
        if (assignedDriver && now - ref.lastLocationPush > 2000) {
          ref.lastLocationPush = now;
          updateDriverLocation({
            driver_id: assignedDriver.id,
            lat, lng,
            heading: 90 - heading,
            speed_kmh: 50 * prev.speed,
          }).catch(() => {});
        }

        if (ref.traveledDistance < ref.totalDistance) {
          ref.animFrameId = requestAnimationFrame(animate);
        }

        return {
          ...prev,
          elapsedSimTime: prev.elapsedSimTime + delta,
          truckPosition: pos,
          phase: "traveling",
          currentCity: points[nextStopIdx]?.city || prev.currentCity,
        };
      });
    };

    simRef.current.animFrameId = requestAnimationFrame(animate);
  }, [selectedRoute, assignedDriver, routeDriverMap]);

  const handleSimPlay = useCallback(() => {
    if (simState.phase === "assigned" || simState.phase === "idle") {
      startSimulation();
    } else {
      setSimState((prev) => ({ ...prev, isPaused: false }));
    }
  }, [simState.phase, startSimulation]);

  const handleSimPause = useCallback(() => {
    setSimState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setSimState((prev) => ({ ...prev, speed }));
  }, []);

  const handleSimClose = useCallback(() => {
    if (simRef.current.animFrameId) {
      cancelAnimationFrame(simRef.current.animFrameId);
    }
    setShowSimPanel(false);
    setTruckSim(null);
    setAssignedDriver(null);
    setSimState({
      isRunning: false, isPaused: false, speed: 1,
      currentStopIndex: 0, completedStops: [],
      elapsedSimTime: 0, totalSimTime: 0,
      truckPosition: null, currentCity: "",
      phase: "idle",
    });
  }, []);

  // When simulation completes, mark task as complete in backend (updates driver location)
  const simCompletedRef = useRef(false);
  useEffect(() => {
    if (simState.phase === "completed" && !simCompletedRef.current) {
      simCompletedRef.current = true;
      if (selectedRoute) {
        const taskId = routeDriverMap[selectedRoute.id]?.task_id;
        if (taskId) {
          simulateCompleteTask(taskId).then(() => {
            const routeIds = routes.map((r) => r.id);
            getRouteAssignments(routeIds).then((result) => {
              buildDriverMap(result.assignments);
            }).catch(() => {});
          }).catch(() => {});
        }
      }
    }
    if (simState.phase !== "completed") {
      simCompletedRef.current = false;
    }
  }, [simState.phase, selectedRoute, routeDriverMap, routes, buildDriverMap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simRef.current.animFrameId) {
        cancelAnimationFrame(simRef.current.animFrameId);
      }
    };
  }, []);

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
        <div className="route-page-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
                className="route-run-banner"
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
              className="route-stats-grid"
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
              className="route-map-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 380px",
                gap: "16px",
              }}
            >
              {/* Map */}
              <div
                className="card route-map-container"
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
                  truckSimulation={truckSim}
                  liveDrivers={
                    liveMode ? liveDrivers :
                    showAllDrivers ? allDriverPositions.map((d) => ({
                      driver_id: d.driver_id,
                      name: `${d.name} (${d.driver_status === "idle_at_home" ? "Home" : d.driver_status === "idle_at_depot" ? "Depot" : d.driver_status === "assigned" ? "Assigned" : d.driver_status === "en_route" ? "En Route" : d.driver_status})`,
                      is_online: d.is_online,
                      lat: d.lat, lng: d.lng,
                      heading: null, speed_kmh: 0,
                    })) :
                    undefined
                  }
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

                {/* Simulation Panel */}
                {showSimPanel && selectedRoute && (
                  <SimulationPanel
                    routeStops={selectedRoute.points.map((p) => ({
                      city: p.city,
                      lat: p.lat,
                      lng: p.lng,
                      type: p.type,
                      shipment_code: p.shipment_code,
                      weight_kg: p.weight_kg,
                    }))}
                    vehicleName={selectedRoute.vehicleName}
                    driverName={assignedDriver?.name || routeDriverMap[selectedRoute.id]?.driver_name || null}
                    totalDistanceKm={selectedRoute.totalDistanceKm}
                    estimatedCost={selectedRoute.fuelCost}
                    simulationState={simState}
                    onPlay={handleSimPlay}
                    onPause={handleSimPause}
                    onSpeedChange={handleSpeedChange}
                    onClose={handleSimClose}
                  />
                )}

                {/* Driver Assignment Modal */}
                {driverModalOpen && (
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 1300,
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--radius-lg)",
                  }}>
                    <div style={{
                      width: 340,
                      maxHeight: 420,
                      borderRadius: 16,
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-primary)",
                      boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 16px",
                        borderBottom: "1px solid var(--border-secondary)",
                      }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                            Assign Driver
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>
                            Sorted by proximity to depot
                          </div>
                        </div>
                        <button
                          onClick={() => setDriverModalOpen(false)}
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            border: "1px solid var(--border-primary)",
                            background: "transparent",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div style={{
                        padding: "8px",
                        maxHeight: 340,
                        overflowY: "auto",
                      }}>
                        {driversLoading ? (
                          <div style={{ textAlign: "center", padding: 30, color: "var(--text-tertiary)" }}>
                            <Loader2 size={20} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
                            <p style={{ fontSize: 12 }}>Finding nearby drivers...</p>
                          </div>
                        ) : availableDrivers.length === 0 ? (
                          <div style={{ textAlign: "center", padding: 30, color: "var(--text-tertiary)" }}>
                            <User size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                            <p style={{ fontSize: 13, fontWeight: 600 }}>No Drivers Registered</p>
                            <p style={{ fontSize: 11, marginTop: 4 }}>
                              Register at <span style={{ color: "#635BFF", fontWeight: 600 }}>/driver/register</span>
                            </p>
                          </div>
                        ) : (
                          availableDrivers.map((driver, idx) => {
                            const isBest = idx === 0 && !driver.has_active_task && driver.distance_km !== null;
                            const isBusy = driver.has_active_task;
                            return (
                              <button
                                key={driver.id}
                                onClick={() => handleAssignDriver(driver)}
                                disabled={isBusy}
                                style={{
                                  width: "100%", padding: "10px 12px", borderRadius: 10,
                                  border: isBest ? "1px solid rgba(16,185,129,0.4)" : "1px solid var(--border-secondary)",
                                  background: isBest ? "rgba(16,185,129,0.04)" : "transparent",
                                  cursor: isBusy ? "not-allowed" : "pointer",
                                  opacity: isBusy ? 0.5 : 1,
                                  display: "flex", alignItems: "center", gap: 10,
                                  marginBottom: 4, transition: "all 0.15s", textAlign: "left",
                                }}
                                onMouseEnter={(e) => { if (!isBusy) { e.currentTarget.style.background = isBest ? "rgba(16,185,129,0.08)" : "rgba(99,91,255,0.06)"; } }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = isBest ? "rgba(16,185,129,0.04)" : "transparent"; }}
                              >
                                <div style={{
                                  width: 34, height: 34, borderRadius: 10,
                                  background: isBest ? "rgba(16,185,129,0.15)" : "rgba(99,91,255,0.1)",
                                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                }}>
                                  <User size={15} style={{ color: isBest ? "#10b981" : "#635BFF" }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                                      {driver.name}
                                    </span>
                                    {isBest && (
                                      <span style={{
                                        fontSize: 8, fontWeight: 800, padding: "1px 5px",
                                        borderRadius: 4, background: "#10b981", color: "#fff",
                                        textTransform: "uppercase", letterSpacing: "0.5px",
                                      }}>Recommended</span>
                                    )}
                                    {isBusy && (
                                      <span style={{
                                        fontSize: 8, fontWeight: 700, padding: "1px 5px",
                                        borderRadius: 4, background: "rgba(245,158,11,0.15)", color: "#f59e0b",
                                      }}>Busy</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", display: "flex", gap: 6, marginTop: 1 }}>
                                    <span>{driver.phone}</span>
                                    {driver.is_online && <span style={{ color: "#10b981", fontWeight: 700 }}>● Online</span>}
                                    {driver.distance_km !== null && (
                                      <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                                        {driver.distance_km < 1 ? "< 1 km" : `${driver.distance_km} km away`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  {driver.distance_km !== null ? (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: isBest ? "#10b981" : "var(--text-secondary)" }}>
                                      {driver.distance_km < 1 ? "<1" : driver.distance_km} km
                                    </div>
                                  ) : (
                                    <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Route Details Sidebar ── */}
              <div
                className="route-sidebar"
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{
                        fontSize: "14px", fontWeight: 700, color: "var(--text-primary)",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <Truck size={15} style={{ color: "#635BFF" }} />
                        Route Details
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                        {routes.length} routes · Click to expand
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setLiveMode((v) => !v); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "5px 10px", borderRadius: 8,
                          border: liveMode ? "1px solid rgba(16,185,129,0.4)" : "1px solid var(--border-primary)",
                          background: liveMode ? "rgba(16,185,129,0.1)" : "transparent",
                          color: liveMode ? "#10b981" : "var(--text-secondary)",
                          cursor: "pointer", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: liveMode ? "#10b981" : "var(--text-tertiary)",
                          animation: liveMode ? "pulse-ring 1.5s ease infinite" : "none",
                        }} />
                        Live
                        {liveMode && liveDrivers.length > 0 && (
                          <span style={{
                            background: "#10b981", color: "#fff", borderRadius: 4,
                            padding: "0 4px", fontSize: 9, marginLeft: 2,
                          }}>{liveDrivers.length}</span>
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAutoAssign(false); }}
                        disabled={autoAssigning || routes.length === 0}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "5px 10px", borderRadius: 8,
                          border: "1px solid rgba(99,91,255,0.3)",
                          background: autoAssigning ? "rgba(99,91,255,0.15)" : "rgba(99,91,255,0.06)",
                          color: "#a78bfa", cursor: autoAssigning ? "wait" : "pointer",
                          fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                        }}
                      >
                        {autoAssigning ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <User size={10} />}
                        {autoAssigning ? "Assigning…" : "Assign Drivers"}
                      </button>
                      {Object.keys(routeDriverMap).length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAutoAssign(true); }}
                          disabled={autoAssigning}
                          title="Clear current assignments and reassign based on GPS location"
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "5px 8px", borderRadius: 8,
                            border: "1px solid rgba(245,158,11,0.3)",
                            background: "rgba(245,158,11,0.06)",
                            color: "#f59e0b", cursor: "pointer",
                            fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                          }}
                        >
                          <RefreshCw size={10} />
                          Reassign
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showAllDrivers) {
                            setShowAllDrivers(false);
                            setAllDriverPositions([]);
                          } else {
                            getAllDriverPositions().then((data) => {
                              setAllDriverPositions(data || []);
                              setShowAllDrivers(true);
                            }).catch(() => {});
                          }
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "5px 10px", borderRadius: 8,
                          border: showAllDrivers ? "1px solid rgba(14,165,233,0.4)" : "1px solid var(--border-primary)",
                          background: showAllDrivers ? "rgba(14,165,233,0.1)" : "transparent",
                          color: showAllDrivers ? "#0ea5e9" : "var(--text-secondary)",
                          cursor: "pointer", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                        }}
                      >
                        <MapPin size={10} />
                        {showAllDrivers ? "Hide Drivers" : "All Drivers"}
                        {showAllDrivers && allDriverPositions.length > 0 && (
                          <span style={{
                            background: "#0ea5e9", color: "#fff", borderRadius: 4,
                            padding: "0 4px", fontSize: 9, marginLeft: 2,
                          }}>{allDriverPositions.length}</span>
                        )}
                      </button>
                      {/* Simulate Button */}
                      {selectedRoute && !showSimPanel && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const driverInfo = routeDriverMap[selectedRoute.id];
                            if (driverInfo) {
                              setAssignedDriver({ id: driverInfo.driver_id, name: driverInfo.driver_name });
                            } else {
                              setAssignedDriver(null);
                            }
                            const startPt = selectedRoute.points[0];
                            if (startPt) {
                              setTruckSim({
                                position: { lat: startPt.lat, lng: startPt.lng },
                                heading: 0, currentStopIndex: 0, completedStops: [],
                                phase: "assigned", trailPath: [],
                              });
                            }
                            setSimState((prev) => ({
                              ...prev, phase: "assigned", currentStopIndex: 0,
                              completedStops: [], elapsedSimTime: 0,
                              truckPosition: startPt ? { lat: startPt.lat, lng: startPt.lng } : null,
                              currentCity: startPt?.city || "",
                            }));
                            setShowSimPanel(true);
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "5px 10px", borderRadius: 8, border: "none",
                            background: "linear-gradient(135deg, #635BFF, #8b5cf6)",
                            color: "#fff", cursor: "pointer", fontSize: 10,
                            fontWeight: 700, boxShadow: "0 2px 8px rgba(99,91,255,0.3)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Play size={10} />
                          Simulate
                        </button>
                      )}
                    </div>
                    {showSimPanel && (
                      <span style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: "rgba(99,91,255,0.1)",
                        color: "#635BFF",
                        fontSize: 10,
                        fontWeight: 700,
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: simState.phase === "completed" ? "#10b981" :
                            simState.isRunning ? "#635BFF" : "#f59e0b",
                          animation: simState.isRunning && !simState.isPaused ? "pulse-ring 1.5s ease infinite" : "none",
                        }} />
                        {simState.phase === "completed" ? "Done" : simState.isRunning ? "Live" : "Ready"}
                      </span>
                    )}
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
                            {routeDriverMap[route.id] && (
                              <div style={{ marginTop: 3 }}>
                                <div style={{
                                  display: "flex", alignItems: "center", gap: 5,
                                }}>
                                  {routeDriverMap[route.id].driver_avatar ? (
                                    <img
                                      src={routeDriverMap[route.id].driver_avatar!}
                                      alt=""
                                      style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover" }}
                                    />
                                  ) : (
                                    <div style={{
                                      width: 16, height: 16, borderRadius: "50%",
                                      background: "linear-gradient(135deg, #635BFF, #8b5cf6)",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: 8, fontWeight: 800, color: "#fff",
                                    }}>
                                      {routeDriverMap[route.id].driver_name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span style={{ fontSize: 10, fontWeight: 600, color: "#a78bfa" }}>
                                    {routeDriverMap[route.id].driver_name}
                                  </span>
                                  {routeDriverMap[route.id].city_match ? (
                                    <span style={{
                                      fontSize: 8, padding: "1px 4px", borderRadius: 3,
                                      background: "rgba(16,185,129,0.12)", color: "#10b981", fontWeight: 700,
                                    }}>City Match</span>
                                  ) : routeDriverMap[route.id].deadhead_km > 0 ? (
                                    <span style={{
                                      fontSize: 8, padding: "1px 4px", borderRadius: 3,
                                      background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 700,
                                    }}>
                                      {routeDriverMap[route.id].deadhead_km} km deadhead
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: 8, padding: "1px 4px", borderRadius: 3,
                                      background: "rgba(16,185,129,0.12)", color: "#10b981", fontWeight: 700,
                                    }}>
                                      {routeDriverMap[route.id].distance_km < 1 ? "<1" : routeDriverMap[route.id].distance_km} km
                                    </span>
                                  )}
                                  {routeDriverMap[route.id].task_id && routeDriverMap[route.id].task_status !== "completed" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const taskId = routeDriverMap[route.id].task_id;
                                        simulateCompleteTask(taskId).then(() => {
                                          const routeIds = routes.map((r) => r.id);
                                          getRouteAssignments(routeIds).then((result) => {
                                            buildDriverMap(result.assignments);
                                          }).catch(() => {});
                                        }).catch(() => {});
                                      }}
                                      style={{
                                        fontSize: 8, padding: "1px 5px", borderRadius: 3,
                                        border: "1px solid rgba(99,91,255,0.3)",
                                        background: "rgba(99,91,255,0.08)", color: "#a78bfa",
                                        fontWeight: 700, cursor: "pointer", marginLeft: 2,
                                      }}
                                    >
                                      Sim Complete
                                    </button>
                                  )}
                                </div>
                                {routeDriverMap[route.id].deadhead_km > 0 && !routeDriverMap[route.id].city_match && (
                                  <div style={{
                                    fontSize: 9, color: "var(--text-tertiary)", marginTop: 2, marginLeft: 21,
                                  }}>
                                    Driver traveling {routeDriverMap[route.id].deadhead_km} km
                                    {routeDriverMap[route.id].driver_city ? ` from ${routeDriverMap[route.id].driver_city}` : ""}
                                    {` — deadhead cost ₹${routeDriverMap[route.id].deadhead_cost}`}
                                  </div>
                                )}
                                {routeDriverMap[route.id].total_driver_cost != null && routeDriverMap[route.id].total_driver_cost! > 0 && (
                                  <div style={{
                                    fontSize: 9, color: "var(--text-tertiary)", marginTop: 1, marginLeft: 21,
                                  }}>
                                    Driver cost: ₹{routeDriverMap[route.id].total_driver_cost}
                                    {routeDriverMap[route.id].estimated_hours ? ` (${routeDriverMap[route.id].estimated_hours}h journey)` : ""}
                                  </div>
                                )}
                              </div>
                            )}
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
                              className="route-metrics-grid"
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, 1fr)",
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
