"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Truck, MapPin, Package, CheckCircle2, Navigation,
  Loader2, Clock, ChevronRight, AlertCircle, Locate,
} from "lucide-react";
import { getDriverTask, updateTaskStatus, updateDriverLocation } from "@/lib/api";

interface Stop {
  city: string;
  lat: number;
  lng: number;
  type: "depot" | "pickup" | "delivery";
  shipment_code?: string;
  weight_kg?: number;
  status?: string;
}

interface TaskData {
  id: string;
  driver_id: string;
  route_id: string;
  vehicle_name: string;
  status: string;
  stops: Stop[];
  current_stop_index: number;
  started_at: string | null;
  completed_at: string | null;
}

const STOP_META: Record<string, { color: string; icon: any; label: string }> = {
  depot: { color: "#f59e0b", icon: Navigation, label: "Depot" },
  pickup: { color: "#3b82f6", icon: Package, label: "Pickup" },
  delivery: { color: "#10b981", icon: MapPin, label: "Delivery" },
};

export default function DriverTaskPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<"off" | "tracking" | "error">("off");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPushRef = useRef<number>(0);

  const load = useCallback(async () => {
    try {
      const data = await getDriverTask(taskId);
      setTask(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!showMap || !mapContainerRef.current || !task || task.stops.length === 0) return;
    if (mapInstanceRef.current) return;

    let cancelled = false;
    const initMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapContainerRef.current) return;

      const currentStopPt = task.stops[task.current_stop_index] || task.stops[0];
      const map = L.map(mapContainerRef.current, {
        center: [currentStopPt.lat, currentStopPt.lng],
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
      });

      L.tileLayer("https://api.maptiler.com/maps/streets-v2-dark/256/{z}/{x}/{y}.png?key=W7r3awl6Vd3m8EdFkhue", {
        maxZoom: 20,
        tileSize: 256,
      }).addTo(map);

      const routeCoords = task.stops.map((s) => [s.lat, s.lng] as [number, number]);
      L.polyline(routeCoords, {
        color: "#0ea5e9", weight: 5, opacity: 0.85, smoothFactor: 1,
      }).addTo(map);

      L.polyline(routeCoords, {
        color: "#0ea5e9", weight: 12, opacity: 0.15, smoothFactor: 1,
      }).addTo(map);

      task.stops.forEach((stop, idx) => {
        const meta = STOP_META[stop.type] || STOP_META.depot;
        const isCurrent = idx === task.current_stop_index && task.status !== "completed";
        const isDone = stop.status === "completed" || idx < task.current_stop_index;
        const size = isCurrent ? 28 : 20;

        L.marker([stop.lat, stop.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="
              width:${size}px;height:${size}px;border-radius:50%;
              background:${isDone ? "#10b981" : meta.color};
              border:3px solid #fff;display:flex;align-items:center;justify-content:center;
              box-shadow:0 2px 8px ${isDone ? "#10b981" : meta.color}60;
              font-size:${isCurrent ? 12 : 9}px;color:#fff;font-weight:700;
              ${isCurrent ? "animation:pulse-ring 2s ease infinite;" : ""}
            ">${isDone ? "✓" : idx + 1}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
          zIndexOffset: isCurrent ? 1000 : 0,
        }).addTo(map).bindTooltip(
          `<b>${stop.city}</b><br/>${meta.label}${stop.shipment_code ? ` · ${stop.shipment_code}` : ""}`,
          { direction: "top", offset: [0, -12] },
        );
      });

      const bounds = L.latLngBounds(routeCoords.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [40, 40] });

      mapInstanceRef.current = map;
    };
    initMap();
    return () => { cancelled = true; };
  }, [showMap, task]);

  // GPS tracking via watchPosition
  useEffect(() => {
    if (!task || task.status === "completed" || task.status === "assigned") return;
    if (!navigator.geolocation) { setGpsStatus("error"); return; }

    setGpsStatus("tracking");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading, speed } = pos.coords;
        const now = Date.now();
        if (now - lastPushRef.current > 5000) {
          lastPushRef.current = now;
          updateDriverLocation({
            driver_id: task.driver_id,
            lat, lng,
            heading: heading ?? undefined,
            speed_kmh: speed ? speed * 3.6 : 0,
          }).catch(() => {});
        }

        if (mapInstanceRef.current) {
          const L = require("leaflet");
          if (driverMarkerRef.current) {
            driverMarkerRef.current.setLatLng([lat, lng]);
          } else {
            driverMarkerRef.current = L.marker([lat, lng], {
              icon: L.divIcon({
                className: "",
                html: `<div style="
                  width:36px;height:36px;border-radius:50%;
                  background:linear-gradient(135deg,#0ea5e9,#06b6d4);
                  border:3px solid #fff;display:flex;align-items:center;justify-content:center;
                  box-shadow:0 3px 16px rgba(14,165,233,0.6);
                  animation:pulse-ring 2s ease infinite;
                "><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="5"/></svg></div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              }),
              zIndexOffset: 2000,
            }).addTo(mapInstanceRef.current);
          }
        }
      },
      () => { setGpsStatus("error"); },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [task?.status, task?.driver_id]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleStartRoute = async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      const updated = await updateTaskStatus(taskId, { status: "in_progress", current_stop_index: 0 });
      setTask(updated);
    } catch (err: any) { setError(err.message); }
    setActionLoading(false);
  };

  const handleCompleteStop = async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      const nextIdx = task.current_stop_index + 1;
      const stops = [...task.stops];
      if (stops[task.current_stop_index]) {
        stops[task.current_stop_index] = { ...stops[task.current_stop_index], status: "completed" };
      }
      const isLastStop = nextIdx >= stops.length;
      const updated = await updateTaskStatus(taskId, {
        status: isLastStop ? "completed" : "in_progress",
        current_stop_index: isLastStop ? stops.length : nextIdx,
        stops,
      });
      setTask(updated);
    } catch (err: any) { setError(err.message); }
    setActionLoading(false);
  };

  const handleCompleteRoute = async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      const stops = task.stops.map((s) => ({ ...s, status: "completed" }));
      const updated = await updateTaskStatus(taskId, { status: "completed", current_stop_index: stops.length, stops });
      setTask(updated);
    } catch (err: any) { setError(err.message); }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", paddingTop: 80, color: "#64748b" }}>
        <Loader2 size={28} style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
        <p>Loading task...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ textAlign: "center", paddingTop: 80, color: "#64748b" }}>
        <AlertCircle size={32} style={{ margin: "0 auto 12px", color: "#ef4444" }} />
        <p>{error || "Task not found"}</p>
        <button onClick={() => router.push("/driver/dashboard")} style={{
          marginTop: 16, padding: "10px 20px", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", cursor: "pointer",
        }}>Back to Dashboard</button>
      </div>
    );
  }

  const currentIdx = task.current_stop_index;
  const isCompleted = task.status === "completed";
  const isAssigned = task.status === "assigned";
  const totalStops = task.stops.length;
  const completedStopsCount = task.stops.filter((s) => s.status === "completed").length;
  const progress = totalStops > 0 ? (completedStopsCount / totalStops) * 100 : 0;
  const currentStop = task.stops[currentIdx];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => router.push("/driver/dashboard")} style={{
          width: 36, height: 36, borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
          color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 800 }}>{task.vehicle_name}</h1>
          <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
            Task: {task.id.slice(0, 8)}
            {gpsStatus === "tracking" && <span style={{ color: "#10b981", fontWeight: 700, fontSize: 9 }}>● GPS</span>}
            {gpsStatus === "error" && <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 9 }}>● GPS Error</span>}
          </div>
        </div>
        <span style={{
          padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.5px",
          background: isCompleted ? "rgba(16,185,129,0.15)" : isAssigned ? "rgba(245,158,11,0.15)" : "rgba(99,91,255,0.15)",
          color: isCompleted ? "#10b981" : isAssigned ? "#f59e0b" : "#635BFF",
        }}>{task.status}</span>
      </div>

      {/* Map */}
      {showMap && (
        <div style={{
          height: 300, borderRadius: 14, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)", position: "relative",
        }}>
          <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
          <style>{`
            @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(99,91,255,0.4); } 100% { box-shadow: 0 0 0 12px rgba(99,91,255,0); } }
          `}</style>
        </div>
      )}

      {/* Progress */}
      <div style={{
        padding: "12px 14px", borderRadius: 14,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
          <span style={{ color: "#94a3b8", fontWeight: 600 }}>Route Progress</span>
          <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{completedStopsCount}/{totalStops} stops</span>
        </div>
        <div style={{
          width: "100%", height: 5, borderRadius: 3,
          background: "rgba(255,255,255,0.06)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: isCompleted ? "#10b981" : "linear-gradient(90deg, #0ea5e9, #10b981)",
            borderRadius: 3, transition: "width 0.5s ease",
          }} />
        </div>
      </div>

      {/* Current Stop Card */}
      {!isCompleted && currentStop && (
        <div style={{
          padding: "14px", borderRadius: 14,
          background: "rgba(99,91,255,0.08)", border: "1px solid rgba(99,91,255,0.2)",
        }}>
          <div style={{ fontSize: 9, color: "#635BFF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>
            Current Destination
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `${STOP_META[currentStop.type]?.color || "#635BFF"}20`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {(() => { const Icon = STOP_META[currentStop.type]?.icon || MapPin; return <Icon size={20} color={STOP_META[currentStop.type]?.color || "#635BFF"} />; })()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{currentStop.city}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Stop {currentIdx + 1} of {totalStops} · {STOP_META[currentStop.type]?.label || currentStop.type}
                {currentStop.shipment_code && <span> · {currentStop.shipment_code}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completion */}
      {isCompleted && (
        <div style={{
          textAlign: "center", padding: "28px 20px", borderRadius: 14,
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
        }}>
          <CheckCircle2 size={44} color="#10b981" style={{ margin: "0 auto 10px" }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginBottom: 4 }}>Route Complete!</h2>
          <p style={{ fontSize: 12, color: "#64748b" }}>All deliveries completed. Vehicle is free for next route.</p>
        </div>
      )}

      {/* Stop Timeline */}
      <div>
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#94a3b8" }}>Route Stops</h2>
        <div style={{ position: "relative", paddingLeft: 26 }}>
          <div style={{
            position: "absolute", left: 10, top: 10, bottom: 10,
            width: 2, borderRadius: 2,
            background: "linear-gradient(to bottom, #f59e0b 0%, #3b82f6 35%, #10b981 70%, #f59e0b 100%)",
            opacity: 0.25,
          }} />
          {task.stops.map((stop, i) => {
            const meta = STOP_META[stop.type] || STOP_META.depot;
            const isCurrent = i === currentIdx && !isCompleted;
            const isDone = stop.status === "completed" || i < currentIdx;
            const isFuture = i > currentIdx && !isCompleted;
            const Icon = meta.icon;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                position: "relative", padding: "8px 0",
                opacity: isFuture ? 0.4 : 1, transition: "opacity 0.3s",
              }}>
                <div style={{
                  position: "absolute", left: -20, top: 12,
                  width: isDone ? 16 : isCurrent ? 18 : 12,
                  height: isDone ? 16 : isCurrent ? 18 : 12,
                  borderRadius: "50%",
                  background: isDone ? "#10b981" : isCurrent ? meta.color : "rgba(255,255,255,0.1)",
                  border: isCurrent ? `3px solid ${meta.color}40` : isDone ? "2px solid #0f766e" : "2px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 2, boxShadow: isCurrent ? `0 0 10px ${meta.color}40` : "none",
                }}>
                  {isDone && <CheckCircle2 size={8} color="#fff" />}
                </div>
                <div style={{
                  flex: 1, padding: "8px 12px", borderRadius: 10,
                  background: isCurrent ? `${meta.color}10` : "rgba(255,255,255,0.02)",
                  border: isCurrent ? `1px solid ${meta.color}30` : "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon size={13} color={isDone ? "#10b981" : meta.color} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{stop.city}</span>
                      <span style={{
                        padding: "1px 5px", borderRadius: 3, fontSize: 8,
                        background: `${meta.color}15`, color: meta.color,
                        fontWeight: 700, textTransform: "uppercase",
                      }}>{meta.label}</span>
                    </div>
                    {isDone && <span style={{ fontSize: 9, color: "#10b981", fontWeight: 700 }}>Done</span>}
                    {isCurrent && <span style={{ fontSize: 9, color: meta.color, fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}><ChevronRight size={9} /> Current</span>}
                  </div>
                  {stop.shipment_code && (
                    <div style={{ fontSize: 9, color: "#64748b", marginTop: 3, fontFamily: "monospace" }}>
                      {stop.shipment_code}{stop.weight_kg && <span> · {stop.weight_kg.toLocaleString()} kg</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Button */}
      {!isCompleted && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          padding: "14px 20px", maxWidth: 480, margin: "0 auto",
          background: "linear-gradient(to top, rgba(2,21,38,0.98), rgba(2,21,38,0.8))",
          backdropFilter: "blur(12px)", borderTop: "1px solid rgba(14,165,233,0.1)",
        }}>
          {isAssigned ? (
            <button onClick={handleStartRoute} disabled={actionLoading} style={{
              width: "100%", padding: "14px", borderRadius: 14, border: "none",
              cursor: actionLoading ? "not-allowed" : "pointer",
              background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 20px rgba(14,165,233,0.3)",
            }}>
              {actionLoading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Navigation size={18} />}
              Start Route
            </button>
          ) : currentIdx < totalStops ? (
            <button onClick={handleCompleteStop} disabled={actionLoading} style={{
              width: "100%", padding: "14px", borderRadius: 14, border: "none",
              cursor: actionLoading ? "not-allowed" : "pointer",
              background: currentStop?.type === "delivery"
                ? "linear-gradient(135deg, #10b981, #059669)"
                : currentStop?.type === "pickup"
                  ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                  : "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: `0 4px 20px ${STOP_META[currentStop?.type || "depot"]?.color}40`,
            }}>
              {actionLoading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={18} />}
              {currentStop?.type === "pickup" ? "Complete Pickup"
                : currentStop?.type === "delivery" ? "Complete Delivery"
                : currentIdx === 0 ? "Leave Depot" : "Arrive at Depot"}
            </button>
          ) : (
            <button onClick={handleCompleteRoute} disabled={actionLoading} style={{
              width: "100%", padding: "14px", borderRadius: 14, border: "none",
              cursor: actionLoading ? "not-allowed" : "pointer",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
            }}>
              {actionLoading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={18} />}
              Mark Route Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
