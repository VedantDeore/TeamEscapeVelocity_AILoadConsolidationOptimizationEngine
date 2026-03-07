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
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Scenario Simulator</h1>
          <p className="page-subtitle">
            Compare consolidation strategies side by side
          </p>
        </div>
        <button className="btn btn-primary">
          <FlaskConical size={15} /> New Scenario
        </button>
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
                </div>
              ))}
            </div>
          ))}
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
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
