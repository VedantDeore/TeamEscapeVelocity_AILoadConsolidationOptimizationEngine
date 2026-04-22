"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, SkipForward, Clock, Truck, MapPin, User,
  CheckCircle2, Zap, X, ChevronRight, Package, Navigation,
} from "lucide-react";

export interface SimulationStop {
  city: string;
  lat: number;
  lng: number;
  type: "depot" | "pickup" | "delivery";
  shipment_code?: string;
  weight_kg?: number;
  status?: string;
}

export interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  speed: number;
  currentStopIndex: number;
  completedStops: number[];
  elapsedSimTime: number;
  totalSimTime: number;
  truckPosition: { lat: number; lng: number } | null;
  currentCity: string;
  phase: "idle" | "assigned" | "traveling" | "at_stop" | "completed";
}

interface SimulationPanelProps {
  routeStops: SimulationStop[];
  vehicleName: string;
  driverName: string | null;
  totalDistanceKm: number;
  estimatedCost?: number;
  simulationState: SimulationState;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (speed: number) => void;
  onClose: () => void;
  onAssignDriver?: () => void;
}

const SPEED_OPTIONS = [1, 2, 5, 10, 50];

const STOP_COLORS: Record<string, string> = {
  depot: "#f59e0b",
  pickup: "#3b82f6",
  delivery: "#10b981",
};

function formatSimTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function SimulationPanel({
  routeStops,
  vehicleName,
  driverName,
  totalDistanceKm,
  estimatedCost,
  simulationState,
  onPlay,
  onPause,
  onSpeedChange,
  onClose,
  onAssignDriver,
}: SimulationPanelProps) {
  const {
    isRunning,
    isPaused,
    speed,
    currentStopIndex,
    completedStops,
    elapsedSimTime,
    totalSimTime,
    phase,
    currentCity,
  } = simulationState;

  const progressPct = totalSimTime > 0 ? Math.min(100, (elapsedSimTime / totalSimTime) * 100) : 0;
  const completedCount = completedStops.length;
  const totalCount = routeStops.length;

  const baseSimHour = 6;
  const clockTime = formatSimTime(baseSimHour * 3600 + elapsedSimTime);

  return (
    <div style={{
      position: "absolute",
      bottom: 14,
      right: 14,
      zIndex: 1200,
      width: 320,
      borderRadius: 16,
      background: "rgba(15, 23, 42, 0.92)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
      color: "#f1f5f9",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(99,91,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #635BFF, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Navigation size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Live Simulation</div>
            <div style={{ fontSize: 9, color: "#64748b" }}>{vehicleName}</div>
          </div>
        </div>
        <button onClick={onClose} style={{
          width: 24, height: 24, borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "transparent", color: "#94a3b8",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <X size={12} />
        </button>
      </div>

      {/* Clock + Status */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={14} color="#635BFF" />
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", letterSpacing: "1px" }}>
              {clockTime}
            </span>
          </div>
          <span style={{
            padding: "3px 8px", borderRadius: 6, fontSize: 9,
            fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
            background: phase === "completed" ? "rgba(16,185,129,0.15)" :
              phase === "traveling" ? "rgba(99,91,255,0.15)" :
                phase === "at_stop" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
            color: phase === "completed" ? "#10b981" :
              phase === "traveling" ? "#635BFF" :
                phase === "at_stop" ? "#f59e0b" : "#64748b",
          }}>
            {phase === "idle" ? "Ready" : phase === "assigned" ? "Assigned" :
              phase === "traveling" ? "En Route" : phase === "at_stop" ? "At Stop" : "Complete"}
          </span>
        </div>

        {/* Current location */}
        {currentCity && phase !== "idle" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            marginTop: 8, fontSize: 11, color: "#94a3b8",
          }}>
            <MapPin size={11} color={STOP_COLORS[routeStops[currentStopIndex]?.type] || "#635BFF"} />
            <span>{phase === "traveling" ? `Heading to ${currentCity}` : currentCity}</span>
          </div>
        )}
      </div>

      {/* Driver Info */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: driverName ? "rgba(99,91,255,0.2)" : "rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <User size={12} color={driverName ? "#635BFF" : "#475569"} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{driverName || "Auto-pilot"}</div>
            <div style={{ fontSize: 9, color: "#64748b" }}>{driverName ? "Driver Assigned" : "No driver assigned"}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b" }}>
            <Truck size={11} />
            <span>{totalDistanceKm.toFixed(0)} km</span>
          </div>
          {estimatedCost != null && (
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginTop: 2 }}>
              ₹{Math.round(estimatedCost * (progressPct / 100 || 0)).toLocaleString()} / ₹{estimatedCost.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 6 }}>
          <span style={{ color: "#64748b" }}>Progress</span>
          <span style={{ color: "#94a3b8", fontWeight: 700 }}>{completedCount}/{totalCount} stops</span>
        </div>
        <div style={{
          width: "100%", height: 5, borderRadius: 3,
          background: "rgba(255,255,255,0.06)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${progressPct}%`,
            background: phase === "completed" ? "#10b981" : "linear-gradient(90deg, #635BFF, #8b5cf6)",
            borderRadius: 3, transition: "width 0.3s",
          }} />
        </div>

        {/* Mini stop indicators */}
        <div style={{
          display: "flex", gap: 3, marginTop: 8, flexWrap: "wrap",
        }}>
          {routeStops.map((stop, i) => {
            const isDone = completedStops.includes(i);
            const isCurrent = i === currentStopIndex && phase !== "completed";
            return (
              <div key={i} style={{
                width: 18, height: 18, borderRadius: 5,
                background: isDone ? "#10b98130" : isCurrent ? `${STOP_COLORS[stop.type]}30` : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${isDone ? "#10b981" : isCurrent ? STOP_COLORS[stop.type] : "rgba(255,255,255,0.06)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, fontWeight: 800,
                color: isDone ? "#10b981" : isCurrent ? STOP_COLORS[stop.type] : "#475569",
                transition: "all 0.3s",
              }}>
                {isDone ? "✓" : i + 1}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Play/Pause */}
          <button
            onClick={isRunning && !isPaused ? onPause : onPlay}
            disabled={phase === "completed"}
            style={{
              width: 42, height: 42, borderRadius: 12, border: "none",
              background: phase === "completed" ? "rgba(255,255,255,0.04)" :
                "linear-gradient(135deg, #635BFF, #8b5cf6)",
              color: phase === "completed" ? "#475569" : "#fff",
              cursor: phase === "completed" ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: phase !== "completed" ? "0 4px 12px rgba(99,91,255,0.3)" : "none",
              transition: "all 0.2s",
            }}
          >
            {isRunning && !isPaused ? <Pause size={18} /> : <Play size={18} />}
          </button>

          {/* Speed selector */}
          <div style={{
            flex: 1, display: "flex", gap: 4,
          }}>
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8,
                  border: speed === s ? "1px solid rgba(99,91,255,0.4)" : "1px solid rgba(255,255,255,0.06)",
                  background: speed === s ? "rgba(99,91,255,0.15)" : "transparent",
                  color: speed === s ? "#a78bfa" : "#64748b",
                  cursor: "pointer",
                  fontSize: 10, fontWeight: 700,
                  transition: "all 0.2s",
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Speed label */}
        <div style={{
          textAlign: "center", marginTop: 8,
          fontSize: 10, color: "#475569",
        }}>
          <Zap size={9} style={{ display: "inline", verticalAlign: "middle" }} />
          {" "}Simulation speed: {speed}x
        </div>
      </div>
    </div>
  );
}
