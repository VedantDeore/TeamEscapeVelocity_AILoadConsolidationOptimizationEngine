"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Power, MapPin, Navigation, Truck, Clock, ChevronRight, Loader2,
  Package, RefreshCw, UserCircle, Settings,
} from "lucide-react";
import {
  toggleDriverOnline, getDriverTasks, updateDriverLocation, listDrivers,
} from "@/lib/api";

interface DriverTask {
  id: string;
  vehicle_name: string;
  status: string;
  stops: any[];
  current_stop_index: number;
  created_at: string;
}

const ACCENT = "#0ea5e9";
const ACCENT_GLOW = "rgba(14,165,233,0.25)";

export default function DriverDashboardPage() {
  const router = useRouter();
  const [driverId, setDriverId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverStatus, setDriverStatus] = useState<string>("idle_at_home");
  const [effectiveCity, setEffectiveCity] = useState<string>("");
  const gpsWatchRef = useRef<number | null>(null);
  const lastGpsPushRef = useRef<number>(0);

  useEffect(() => {
    if (!isOnline || !driverId || !navigator.geolocation) {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
      return;
    }
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastGpsPushRef.current > 8000) {
          lastGpsPushRef.current = now;
          updateDriverLocation({
            driver_id: driverId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading ?? undefined,
            speed_kmh: pos.coords.speed ? pos.coords.speed * 3.6 : 0,
          }).catch(() => {});
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  }, [isOnline, driverId]);

  useEffect(() => {
    const id = localStorage.getItem("driver_id");
    const name = localStorage.getItem("driver_name");
    if (!id) { router.replace("/driver/login"); return; }
    setDriverId(id);
    setDriverName(name || "Driver");
    const persisted = localStorage.getItem("driver_online");
    if (persisted === "true") {
      setIsOnline(true);
      toggleDriverOnline(id, true).catch(() => {});
    }
  }, [router]);

  useEffect(() => {
    if (!driverId) return;
    listDrivers().then((drivers) => {
      const me = drivers.find((d: any) => d.id === driverId);
      if (me) {
        setDriverStatus(me.driver_status || "idle_at_home");
        setEffectiveCity(me.current_city || me.home_city || "");
      }
    }).catch(() => {});
  }, [driverId]);

  const loadTasks = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const data = await getDriverTasks(driverId);
      setTasks(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [driverId]);

  useEffect(() => {
    if (driverId) loadTasks();
  }, [driverId, loadTasks]);

  useEffect(() => {
    if (!driverId) return;
    const iv = setInterval(loadTasks, 10000);
    return () => clearInterval(iv);
  }, [driverId, loadTasks]);

  const handleToggleOnline = async () => {
    setToggling(true);
    try {
      const newState = !isOnline;
      await toggleDriverOnline(driverId, newState);
      setIsOnline(newState);
      localStorage.setItem("driver_online", String(newState));
    } catch { /* ignore */ }
    setToggling(false);
  };

  const activeTasks = tasks.filter((t) => t.status === "assigned" || t.status === "in_progress");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const STOP_COLORS: Record<string, string> = {
    depot: "#f59e0b",
    pickup: ACCENT,
    delivery: "#10b981",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Greeting + Profile Link */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
              Hello, {driverName}
            </h1>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
              background: driverStatus === "idle_at_home" ? "rgba(16,185,129,0.12)" :
                driverStatus === "idle_at_depot" ? "rgba(245,158,11,0.12)" :
                driverStatus === "assigned" ? "rgba(99,91,255,0.12)" :
                driverStatus === "en_route" ? "rgba(14,165,233,0.12)" : "rgba(100,116,139,0.12)",
              color: driverStatus === "idle_at_home" ? "#10b981" :
                driverStatus === "idle_at_depot" ? "#f59e0b" :
                driverStatus === "assigned" ? "#635BFF" :
                driverStatus === "en_route" ? "#0ea5e9" : "#64748b",
            }}>
              {driverStatus === "idle_at_home" ? "At Home" :
               driverStatus === "idle_at_depot" ? `At Depot${effectiveCity ? ` (${effectiveCity})` : ""}` :
               driverStatus === "assigned" ? "Assigned" :
               driverStatus === "en_route" ? "En Route" : driverStatus}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            {isOnline ? "You are online and available" : "Go online to receive tasks"}
            {effectiveCity && ` · ${effectiveCity}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => router.push("/driver/profile")}
            style={{
              width: 40, height: 40, borderRadius: 12,
              border: `1px solid rgba(14,165,233,0.2)`,
              background: "rgba(14,165,233,0.06)",
              color: ACCENT, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title="Edit Profile"
          >
            <UserCircle size={20} />
          </button>
        </div>
      </div>

      {/* Online Toggle */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          onClick={handleToggleOnline}
          disabled={toggling}
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            border: `4px solid ${isOnline ? "#10b981" : "rgba(255,255,255,0.1)"}`,
            background: isOnline
              ? "radial-gradient(circle, rgba(16,185,129,0.2), rgba(16,185,129,0.05))"
              : "radial-gradient(circle, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
            color: isOnline ? "#10b981" : "#64748b",
            cursor: toggling ? "not-allowed" : "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.3s ease",
            boxShadow: isOnline ? "0 0 40px rgba(16,185,129,0.2)" : "none",
          }}
        >
          {toggling ? (
            <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Power size={32} />
          )}
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
            {isOnline ? "Online" : "Go Online"}
          </span>
        </button>
      </div>

      {/* Quick Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "Active", value: activeTasks.length, icon: Navigation, color: ACCENT },
          { label: "Completed", value: completedTasks.length, icon: Package, color: "#10b981" },
          { label: "Status", value: isOnline ? "Online" : "Offline", icon: MapPin, color: isOnline ? "#10b981" : "#64748b" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{
              padding: "14px 12px", borderRadius: 14,
              background: "rgba(14,165,233,0.04)",
              border: "1px solid rgba(14,165,233,0.08)",
              textAlign: "center",
            }}>
              <Icon size={16} style={{ color: s.color, marginBottom: 6 }} />
              <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Active Tasks */}
      <div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Active Tasks</h2>
          <button
            onClick={loadTasks}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "6px 10px", borderRadius: 8,
              border: "1px solid rgba(14,165,233,0.15)",
              background: "transparent",
              color: "#94a3b8", cursor: "pointer", fontSize: 11, fontWeight: 600,
            }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
            <Loader2 size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13 }}>Loading tasks...</p>
          </div>
        ) : activeTasks.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "40px 20px", borderRadius: 16,
            background: "rgba(14,165,233,0.03)",
            border: "1px solid rgba(14,165,233,0.06)",
          }}>
            <Truck size={36} style={{ color: "#1e3a5f", marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#475569", marginBottom: 4 }}>No Active Tasks</p>
            <p style={{ fontSize: 12, color: "#64748b" }}>Tasks are auto-assigned when routes are generated</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activeTasks.map((task) => {
              const totalStops = task.stops?.length || 0;
              const currentIdx = task.current_stop_index || 0;
              const currentStop = task.stops?.[currentIdx];
              const progress = totalStops > 0 ? (currentIdx / totalStops) * 100 : 0;

              return (
                <div
                  key={task.id}
                  onClick={() => router.push(`/driver/task/${task.id}`)}
                  style={{
                    padding: "16px", borderRadius: 16,
                    background: "rgba(14,165,233,0.06)",
                    border: `1px solid rgba(14,165,233,0.15)`,
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `rgba(14,165,233,0.15)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Truck size={18} color={ACCENT} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{task.vehicle_name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {totalStops} stops ·{" "}
                          <span style={{ color: task.status === "in_progress" ? "#10b981" : "#f59e0b", fontWeight: 700 }}>
                            {task.status === "in_progress" ? "In Progress" : "Assigned"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={18} color="#64748b" />
                  </div>

                  {currentStop && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px", borderRadius: 10,
                      background: "rgba(255,255,255,0.04)",
                      fontSize: 12, color: "#94a3b8",
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: STOP_COLORS[currentStop.type] || ACCENT,
                      }} />
                      <span style={{ fontWeight: 600 }}>Next:</span>
                      <span>{currentStop.city}</span>
                      <span style={{
                        padding: "1px 6px", borderRadius: 4, fontSize: 9,
                        background: `${STOP_COLORS[currentStop.type] || ACCENT}20`,
                        color: STOP_COLORS[currentStop.type] || ACCENT,
                        fontWeight: 700, textTransform: "uppercase",
                      }}>
                        {currentStop.type}
                      </span>
                    </div>
                  )}

                  <div style={{ marginTop: 10 }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      fontSize: 10, color: "#64748b", marginBottom: 4,
                    }}>
                      <span>Progress</span>
                      <span>{currentIdx}/{totalStops} stops</span>
                    </div>
                    <div style={{
                      width: "100%", height: 4, borderRadius: 2,
                      background: "rgba(255,255,255,0.06)", overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", width: `${progress}%`,
                        background: `linear-gradient(90deg, ${ACCENT}, #10b981)`,
                        borderRadius: 2, transition: "width 0.3s",
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#94a3b8" }}>
            Completed ({completedTasks.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {completedTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                style={{
                  padding: "12px 14px", borderRadius: 12,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Clock size={14} color="#10b981" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{task.vehicle_name}</div>
                    <div style={{ fontSize: 10, color: "#10b981" }}>Completed</div>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "#64748b" }}>
                  {task.stops?.length || 0} stops
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
