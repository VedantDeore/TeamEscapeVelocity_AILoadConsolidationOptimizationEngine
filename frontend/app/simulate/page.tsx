"use client";

import { useState, useEffect } from "react";
import { FlaskConical, BarChart3, Award, Zap, ArrowRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import { mockScenarios, type ScenarioResult } from "@/lib/mock-data";
import { getScenarios } from "@/lib/api";
import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  FlaskConical, Award, Zap, Play, Pause, Cpu, TrendingDown,
  Truck, Package, Leaf, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend, AreaChart, Area,
} from 'recharts';
import { mockScenarios, mockShipments, mockVehicles, type ScenarioResult } from '@/lib/mock-data';
import { clientSidePack, type ClientPackingItem, type ClientContainer } from '@/lib/api';
import type { PackingResultData, PackingStep } from '@/components/packing-3d/PackingVisualizer3D';

const PackingVisualizer3D = dynamic(
  () => import('@/components/packing-3d/PackingVisualizer3D'),
  {
    ssr: false,
    loading: () => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 440, background: '#f5f7fa', borderRadius: 12 }}>
        <Cpu className="animate-spin" size={22} style={{ color: '#94a3b8' }} />
      </div>
    ),
  },
);

const COLORS = [
  '#635BFF', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
  '#14b8a6', '#a855f7', '#eab308', '#3b82f6', '#e11d48',
];

const Tip = ({ active, payload, label }: any) => {
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
      <p style={{ color: "#8792a2", marginBottom: "6px", fontWeight: 500 }}>
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p
          key={i}
          style={{ color: entry.fill || entry.stroke, fontWeight: 700 }}
        >
          {entry.name}:{" "}
          {typeof entry.value === "number"
            ? entry.value.toLocaleString()
            : entry.value}
    <div style={{
      background: '#fff', border: '1px solid #e3e8ee', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.06)',
    }}>
      <p style={{ color: '#8792a2', marginBottom: 4, fontWeight: 500 }}>{label}</p>
      {payload.map((e: any, i: number) => (
        <p key={i} style={{ color: e.fill || e.stroke, fontWeight: 600 }}>
          {e.name}: {typeof e.value === 'number' ? e.value.toLocaleString() : e.value}
        </p>
      ))}
    </div>
  );
};

// Scenario colors: red for baseline, indigo for AI, amber for custom
const colors = ["#DF1B41", "#635BFF", "#F59E0B"];
const cardStyles = [
  { border: "rgba(223,27,65,0.25)", top: "", title: "#DF1B41" },
  {
    border: "rgba(99,91,255,0.35)",
    top: "linear-gradient(90deg, #635BFF, #8B5CF6)",
    title: "#635BFF",
  },
  { border: "rgba(245,158,11,0.25)", top: "", title: "#F59E0B" },
];
const SCENARIO_COLORS = ['#9ca3af', '#635BFF', '#f59e0b'];

function buildSimPacking(count: number) {
  const vehicle = mockVehicles[2];
  const shipments = mockShipments.slice(0, count);

  const items: ClientPackingItem[] = shipments.map((s, i) => ({
    id: s.id, label: s.shipmentCode, width: s.widthCm, height: s.heightCm,
    depth: s.lengthCm, weight: s.weightKg, color: COLORS[i % COLORS.length],
    cargoType: s.cargoType, priority: s.priority,
  }));
  const container: ClientContainer = {
    width: vehicle.widthCm, height: vehicle.heightCm,
    depth: vehicle.lengthCm, maxWeight: vehicle.maxWeightKg,
  };
  const result = clientSidePack(container, items);
  const tw = result.placements.reduce((s, p) => s + p.weight, 0);
  const tv = result.placements.reduce((s, p) => s + p.orientedWidth * p.orientedHeight * p.orientedDepth, 0);
  const cv = container.width * container.height * container.depth;
  let cx = 0, cy = 0, cz = 0;
  if (tw > 0) {
    for (const p of result.placements) {
      cx += (p.x + p.orientedWidth / 2) * p.weight;
      cy += (p.y + p.orientedHeight / 2) * p.weight;
      cz += (p.z + p.orientedDepth / 2) * p.weight;
    }
    cx /= tw; cy /= tw; cz /= tw;
  }

  const data: PackingResultData = {
    container: {
      id: vehicle.id, name: vehicle.name,
      width: vehicle.widthCm, height: vehicle.heightCm, depth: vehicle.lengthCm,
      max_weight: vehicle.maxWeightKg, volume_m3: parseFloat((cv / 1e6).toFixed(4)),
    },
    placements: result.placements.map(p => ({
      item: {
        id: p.id, label: p.label, width: p.width, height: p.height, depth: p.depth,
        weight: p.weight, volume_m3: parseFloat(((p.width * p.height * p.depth) / 1e6).toFixed(4)),
        cargo_type: p.cargoType || 'general', priority: p.priority || 'normal',
        stackable: true, color: p.color,
      },
      position: { x: p.x, y: p.y, z: p.z }, orientation: 0,
      oriented_width: p.orientedWidth, oriented_height: p.orientedHeight, oriented_depth: p.orientedDepth,
    })),
    unpacked_items: result.unpacked.map(u => ({
      id: u.id, label: u.label, width: u.width, height: u.height, depth: u.depth, weight: u.weight, color: u.color,
    })),
    steps: result.steps as PackingStep[],
    metrics: {
      total_items: result.placements.length, unpacked_count: result.unpacked.length,
      volume_utilization_pct: parseFloat(result.utilization.toFixed(2)),
      weight_utilization_pct: parseFloat(((tw / container.maxWeight) * 100).toFixed(2)),
      total_weight_kg: parseFloat(tw.toFixed(2)),
      total_volume_m3: parseFloat((tv / 1e6).toFixed(4)),
      center_of_gravity: { x: +cx.toFixed(2), y: +cy.toFixed(2), z: +cz.toFixed(2) },
      container_volume_m3: parseFloat((cv / 1e6).toFixed(4)),
      algorithm: 'hybrid', computation_time_ms: 0,
    },
  };
  return { data, steps: data.steps.map(s => ({ step: s.step_number, utilization: +s.utilization_pct.toFixed(1) })) };
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function SimulatePage() {
  const [scenarios, setScenarios] = useState<ScenarioResult[]>(mockScenarios);

  useEffect(() => {
    getScenarios()
      .then((data) => {
        if (data?.length) {
          const mapped = data.map((s: any) => ({
            name: s.name,
            totalTrips: s.total_trips,
            avgUtilization: s.avg_utilization,
            totalCost: s.total_cost,
            co2Emissions: s.co2_emissions,
            deliverySlaMet: s.delivery_sla_met,
          }));
          setScenarios(mapped);
        }
      })
      .catch(() => {});
  }, []);
  const [scenarios] = useState<ScenarioResult[]>(mockScenarios);
  const [showPacking, setShowPacking] = useState(false);
  const [packingData, setPackingData] = useState<PackingResultData | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [utilSteps, setUtilSteps] = useState<{ step: number; utilization: number }[]>([]);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = useCallback(() => {
    const { data, steps } = buildSimPacking(150);
    setPackingData(data);
    setShowPacking(true);
    setAnimationStep(data.placements.length);
    setUtilSteps(steps);
  }, []);

  const animate = useCallback(() => {
    if (!packingData) return;
    if (isAnimating) { if (animRef.current) clearInterval(animRef.current); setIsAnimating(false); return; }
    setIsAnimating(true); setAnimationStep(0);
    let s = 0;
    animRef.current = setInterval(() => {
      s++;
      setAnimationStep(s);
      if (s >= packingData.placements.length) { if (animRef.current) clearInterval(animRef.current); setIsAnimating(false); }
    }, 550);
  }, [packingData, isAnimating]);

  const barData = [
    {
      metric: "Trips",
      ...Object.fromEntries(scenarios.map((s) => [s.name, s.totalTrips])),
    },
    {
      metric: "Cost (₹K)",
      ...Object.fromEntries(scenarios.map((s) => [s.name, s.totalCost / 1000])),
    },
    {
      metric: "CO₂ (kg)",
      ...Object.fromEntries(scenarios.map((s) => [s.name, s.co2Emissions])),
    },
  ];
  const radarData = [
    {
      metric: "Cost Efficiency",
      "No Consolidation": 40,
      "AI Optimized": 95,
      "Custom Config": 75,
    },
    {
      metric: "Utilization",
      "No Consolidation": 58,
      "AI Optimized": 87,
      "Custom Config": 78,
    },
    {
      metric: "Carbon Score",
      "No Consolidation": 35,
      "AI Optimized": 92,
      "Custom Config": 70,
    },
    {
      metric: "SLA Compliance",
      "No Consolidation": 95,
      "AI Optimized": 97,
      "Custom Config": 96,
    },
    {
      metric: "Trip Efficiency",
      "No Consolidation": 45,
      "AI Optimized": 90,
      "Custom Config": 72,
    },
    { m: 'Cost Efficiency', 'No Consolidation': 40, 'AI Optimized': 95, 'Custom Config': 75 },
    { m: 'Utilization',     'No Consolidation': 58, 'AI Optimized': 87, 'Custom Config': 78 },
    { m: 'Carbon Score',    'No Consolidation': 35, 'AI Optimized': 92, 'Custom Config': 70 },
    { m: 'SLA Compliance',  'No Consolidation': 95, 'AI Optimized': 97, 'Custom Config': 96 },
    { m: 'Trip Efficiency', 'No Consolidation': 45, 'AI Optimized': 90, 'Custom Config': 72 },
  ];

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Scenario Simulator</h1>
          <p className="page-subtitle">
            Compare consolidation strategies side by side
          </p>
          <p className="page-subtitle">Compare consolidation strategies & visualise AI packing</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={run}>
            <FlaskConical size={14} /> Run Simulation
          </button>
          {showPacking && (
            <button className="btn btn-primary btn-sm" onClick={animate}>
              {isAnimating ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Animate</>}
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* ── Stat Bar: Savings Summary ── */}
        <div
          className="stat-highlight-bar stagger-children"
          style={{ marginBottom: "28px" }}
        >
          {[
            { value: "16", label: "Trips saved by AI", cls: "purple" },
            { value: "+29%", label: "Utilization gain", cls: "green" },
            { value: "₹1.4L", label: "Daily cost savings", cls: "amber" },
            { value: "800 kg", label: "CO₂ reduced per day", cls: "" },
          ].map((s) => (
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── 3D Packing Panel ── */}
        {showPacking && packingData && (
          <div className="card animate-slide-up" style={{ overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Truck size={15} style={{ color: '#635BFF' }} />
                <span className="card-title" style={{ fontSize: 14 }}>
                  {packingData.container.name}
                </span>
                <span style={{ fontSize: 12, color: '#8792a2', marginLeft: 8 }}>
                  {packingData.metrics.total_items} items · {packingData.metrics.volume_utilization_pct.toFixed(1)}% utilisation
                </span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', borderTop: '1px solid #f0f3f7' }}>
              <div style={{ height: 440 }}>
                <PackingVisualizer3D
                  data={packingData} isAnimating={isAnimating} animationStep={animationStep}
                  onHoverItem={setHoveredItem} hoveredItem={hoveredItem}
                />
              </div>
              <div style={{ borderLeft: '1px solid #f0f3f7', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8792a2', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    Utilisation curve
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={utilSteps}>
                      <defs>
                        <linearGradient id="uFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#635BFF" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#635BFF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="step" tick={{ fill: '#8792a2', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#8792a2', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<Tip />} />
                      <Area type="monotone" dataKey="utilization" stroke="#635BFF" fill="url(#uFill)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  {[
                    { k: 'Volume', v: `${packingData.metrics.volume_utilization_pct.toFixed(1)}%`, c: '#635BFF' },
                    { k: 'Weight', v: `${packingData.metrics.weight_utilization_pct.toFixed(1)}%`, c: '#10b981' },
                    { k: 'Packed', v: `${packingData.metrics.total_items} / ${packingData.metrics.total_items + packingData.metrics.unpacked_count}`, c: '#0a2540' },
                    { k: 'Algorithm', v: packingData.metrics.algorithm, c: '#f59e0b' },
                  ].map(r => (
                    <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8792a2' }}>{r.k}</span>
                      <span style={{ fontWeight: 600, color: r.c }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Headline numbers ── */}
        <div className="stat-highlight-bar stagger-children">
          {[
            { value: '16',    label: 'Trips saved by AI', cls: 'purple' },
            { value: '+29%',  label: 'Utilisation gain',  cls: 'green'  },
            { value: '₹1.4L', label: 'Daily cost savings', cls: 'amber'  },
            { value: '800 kg',label: 'CO₂ reduced / day', cls: ''       },
          ].map(s => (
            <div key={s.label} className="stat-highlight-item">
              <div className={`stat-highlight-value ${s.cls}`}>{s.value}</div>
              <div className="stat-highlight-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Scenario Cards ── */}
        <div
          className="scenario-grid stagger-children"
          style={{ marginBottom: "28px" }}
        >
          {scenarios.map((scenario, i) => (
            <div
              key={scenario.name}
              className={`scenario-card ${i === 1 ? "winner" : ""}`}
              style={{ borderColor: cardStyles[i].border }}
            >
              {/* Top accent bar for winner */}
              {i === 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: cardStyles[i].top,
                    borderRadius: "12px 12px 0 0",
                  }}
                />
              )}

              <div
                className="scenario-name"
                style={{ color: cardStyles[i].title }}
              >
                {scenario.name}
                {i === 1 && (
                  <span
                    className="badge badge-primary"
                    style={{ marginLeft: "8px", fontSize: "10px" }}
                  >
                    <Award size={10} style={{ marginRight: "3px" }} />
                    Best
                  </span>
                )}
              </div>

              {[
                { label: "Total Trips", val: `${scenario.totalTrips}` },
                {
                  label: "Avg Utilization",
                  val: `${scenario.avgUtilization}%`,
                },
                {
                  label: "Total Cost",
                  val: `₹${(scenario.totalCost / 100000).toFixed(1)}L`,
                },
                {
                  label: "CO₂ Emissions",
                  val: `${scenario.co2Emissions.toLocaleString()} kg`,
                },
                { label: "SLA Met", val: `${scenario.deliverySlaMet}%` },
              ].map((m) => (
                <div key={m.label} className="scenario-metric">
                  <div className="scenario-metric-label">{m.label}</div>
                  <div className="scenario-metric-value">{m.val}</div>
        {/* ── Scenario cards ── */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 650, color: '#0a2540', marginBottom: 14, letterSpacing: '-.02em' }}>Strategy comparison</h2>
          <div className="scenario-grid stagger-children">
            {scenarios.map((sc, i) => {
              const isWinner = i === 1;
              return (
                <div
                  key={sc.name}
                  className={`scenario-card ${isWinner ? 'winner' : ''}`}
                >
                  <div className="scenario-name" style={{ color: SCENARIO_COLORS[i] }}>
                    {sc.name}
                    {isWinner && (
                      <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: 10 }}>
                        <Award size={10} style={{ marginRight: 3 }} /> Best
                      </span>
                    )}
                  </div>
                  {[
                    { l: 'Total Trips',    v: `${sc.totalTrips}` },
                    { l: 'Avg Utilisation', v: `${sc.avgUtilization}%` },
                    { l: 'Total Cost',     v: `₹${(sc.totalCost / 100000).toFixed(1)}L` },
                    { l: 'CO₂ Emissions',  v: `${sc.co2Emissions.toLocaleString()} kg` },
                    { l: 'SLA Met',        v: `${sc.deliverySlaMet}%` },
                  ].map(m => (
                    <div key={m.l} className="scenario-metric">
                      <div className="scenario-metric-label">{m.l}</div>
                      <div className="scenario-metric-value">{m.v}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Charts ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div className="card animate-slide-up">
            <div className="card-header">
              <div className="card-title">Metric Comparison</div>
            </div>
            <div className="card-body" style={{ height: "320px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f7" />
                  <XAxis
                    dataKey="metric"
                    tick={{ fill: "#8792a2", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8792a2", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {scenarios.map((s, i) => (
                    <Bar
                      key={s.name}
                      dataKey={s.name}
                      fill={colors[i]}
                      radius={[4, 4, 0, 0]}
                      barSize={28}
                    />
        {/* ── Charts row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card animate-slide-up">
            <div className="card-header"><div className="card-title">Metric comparison</div></div>
            <div className="card-body" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f7" />
                  <XAxis dataKey="metric" tick={{ fill: '#8792a2', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8792a2', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  {scenarios.map((s, i) => (
                    <Bar key={s.name} dataKey={s.name} fill={SCENARIO_COLORS[i]} radius={[4, 4, 0, 0]} barSize={26} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card animate-slide-up">
            <div className="card-header">
              <div className="card-title">Performance Radar</div>
            </div>
            <div className="card-body" style={{ height: "320px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#f0f3f7" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: "#8792a2", fontSize: 10 }}
                  />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  {scenarios.map((s, i) => (
                    <Radar
                      key={s.name}
                      name={s.name}
                      dataKey={s.name}
                      stroke={colors[i]}
                      fill={colors[i]}
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                    }}
                  />
            <div className="card-header"><div className="card-title">Performance radar</div></div>
            <div className="card-body" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#f0f3f7" />
                  <PolarAngleAxis dataKey="m" tick={{ fill: '#8792a2', fontSize: 10 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  {scenarios.map((s, i) => (
                    <Radar key={s.name} name={s.name} dataKey={s.name}
                      stroke={SCENARIO_COLORS[i]} fill={SCENARIO_COLORS[i]}
                      fillOpacity={0.08} strokeWidth={2} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11, color: '#8792a2' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Dark Hero: AI Advantage ── */}
        <div className="hero-dark-section animate-slide-up">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                background: "linear-gradient(135deg, #635BFF, #8B5CF6)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={20} color="white" />
            </div>
            <div>
              <div className="hero-dark-title" style={{ fontSize: "24px" }}>
                AI Optimized vs No Consolidation
              </div>
              <div className="hero-dark-subtitle">Savings summary</div>
            </div>
          </div>

          <div className="hero-stats-row">
            {[
              { value: "16", label: "Trips saved", pct: "34%", cls: "green" },
              {
                value: "+29%",
                label: "Utilization gain",
                pct: "50%",
                cls: "purple",
              },
              {
                value: "₹1.4L",
                label: "Cost saved/day",
                pct: "31%",
                cls: "amber",
              },
              {
                value: "800 kg",
                label: "CO₂ reduced",
                pct: "33%",
                cls: "green",
              },
            ].map((s) => (
              <div key={s.label} className="hero-stat">
                <div className={`hero-stat-value ${s.cls}`}>{s.value}</div>
                <div className="hero-stat-label">
                  {s.label}
                  <br />
                  <span style={{ color: "#34d399", fontWeight: 600 }}>
                    ▼ {s.pct} improvement
                  </span>
        {/* ── AI Advantage summary (light card instead of dark hero) ── */}
        <div className="card" style={{ borderColor: 'rgba(99,91,255,.18)', background: '#fafaff' }}>
          <div className="card-body" style={{ padding: '28px 28px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'linear-gradient(135deg, #635BFF, #8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 650, color: '#0a2540', letterSpacing: '-.02em' }}>
                  AI Optimised vs No Consolidation
                </div>
                <div style={{ fontSize: 12.5, color: '#8792a2' }}>Savings summary</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid #e3e8ee' }}>
              {[
                { value: '16',    label: 'Trips saved',     pct: '34%', color: '#10b981' },
                { value: '+29%',  label: 'Utilisation gain', pct: '50%', color: '#635BFF' },
                { value: '₹1.4L', label: 'Cost saved / day', pct: '31%', color: '#f59e0b' },
                { value: '800 kg',label: 'CO₂ reduced',     pct: '33%', color: '#10b981' },
              ].map((s, i) => (
                <div key={s.label} style={{
                  padding: '20px 0', borderRight: i < 3 ? '1px solid #f0f3f7' : 'none',
                  paddingLeft: i > 0 ? 20 : 0,
                }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: '-.03em' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#8792a2', marginTop: 4 }}>
                    {s.label}
                    <span style={{ display: 'block', color: '#10b981', fontWeight: 600, fontSize: 11, marginTop: 2 }}>
                      ▼ {s.pct} improvement
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
