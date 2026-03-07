"use client";

import { useState, useEffect } from "react";
import {
  Leaf,
  TreePine,
  Car,
  Factory,
  Award,
  Download,
  TrendingDown,
  Zap,
  ArrowRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { mockCarbonMonthly, mockCarbonBreakdown } from "@/lib/mock-data";
import { getCarbonMetrics } from "@/lib/api";

function AnimatedNumber({
  value,
  duration = 1500,
}: {
  value: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else setDisplay(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display.toLocaleString()}</>;
}

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
        <p
          key={i}
          style={{
            color: entry.color || entry.stroke || entry.fill,
            fontWeight: 700,
          }}
        >
          {entry.name}:{" "}
          {typeof entry.value === "number"
            ? entry.value.toLocaleString()
            : entry.value}{" "}
          kg CO₂
        </p>
      ))}
    </div>
  );
};

export default function CarbonPage() {
  const [carbonMonthly, setCarbonMonthly] = useState(mockCarbonMonthly);
  const [carbonBreakdown, setCarbonBreakdown] = useState(mockCarbonBreakdown);

  useEffect(() => {
    getCarbonMetrics()
      .then((data) => {
        if (data?.monthly?.length) setCarbonMonthly(data.monthly);
        if (data?.breakdown?.length) setCarbonBreakdown(data.breakdown);
      })
      .catch(() => {});
  }, []);

  const totalSavings = carbonMonthly.reduce((sum, m) => sum + m.savings, 0);
  const treesEquiv = Math.floor(totalSavings / 22);
  const carKmEquiv = Math.floor(totalSavings * 6.25);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Carbon Impact</h1>
          <p className="page-subtitle">
            ESG-aligned sustainability metrics & environmental impact
          </p>
        </div>
        <button className="btn btn-primary">
          <Download size={15} /> Download ESG Report
        </button>
      </div>

      <div className="page-body">
        {/* ── Dark Hero: CO₂ Total ── */}
        <div
          className="hero-dark-section animate-slide-up"
          style={{ marginBottom: "24px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #10B981, #06B6D4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Leaf size={26} color="white" />
            </div>
            <div>
              <div
                style={{
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 500,
                }}
              >
                Total CO₂ Saved — Last 6 Months
              </div>
              <div
                style={{
                  fontSize: "52px",
                  fontWeight: 800,
                  lineHeight: 1.05,
                  letterSpacing: "-0.04em",
                }}
                className="text-gradient-green"
              >
                <AnimatedNumber value={totalSavings} /> kg
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
              <span className="badge badge-success">▼ 33% reduction</span>
              <span className="badge badge-primary">Trend: Improving</span>
            </div>
          </div>

          <div className="hero-stats-row">
            {[
              {
                value: `${treesEquiv}`,
                label: "Trees planted\nequivalent",
                cls: "green",
              },
              {
                value: `${carKmEquiv.toLocaleString()}`,
                label: "km car travel\navoided",
                cls: "purple",
              },
              { value: "96", label: "Trips\neliminated", cls: "" },
              { value: "A+", label: "ESG green\nscore rating", cls: "amber" },
            ].map((s) => (
              <div key={s.label} className="hero-stat">
                <div className={`hero-stat-value ${s.cls}`}>{s.value}</div>
                <div
                  className="hero-stat-label"
                  style={{ whiteSpace: "pre-line" }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Equivalent Impact Cards ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "14px",
            marginBottom: "24px",
          }}
        >
          <div className="feature-card-green animate-slide-up">
            <TreePine
              size={26}
              style={{ marginBottom: "12px", opacity: 0.9 }}
            />
            <div
              style={{
                fontSize: "36px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              <AnimatedNumber value={treesEquiv} />
            </div>
            <div className="feature-card-title" style={{ marginTop: "6px" }}>
              Trees Planted Equivalent
            </div>
            <div className="feature-card-body">
              1 tree absorbs ~22 kg CO₂/year
            </div>
          </div>

          <div className="feature-card-purple animate-slide-up">
            <Car size={26} style={{ marginBottom: "12px", opacity: 0.9 }} />
            <div
              style={{
                fontSize: "36px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              <AnimatedNumber value={carKmEquiv} />
            </div>
            <div className="feature-card-title" style={{ marginTop: "6px" }}>
              km Car Travel Avoided
            </div>
            <div className="feature-card-body">
              Based on 160g CO₂/km average car
            </div>
          </div>

          <div className="feature-card-amber animate-slide-up">
            <Award size={26} style={{ marginBottom: "12px", opacity: 0.9 }} />
            <div
              style={{
                fontSize: "36px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              A+
            </div>
            <div className="feature-card-title" style={{ marginTop: "6px" }}>
              Green Score Rating
            </div>
            <div className="feature-card-body">
              Top 5% in industry — Excellent
            </div>
          </div>
        </div>

        {/* ── Charts Row ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div className="card animate-slide-up">
            <div className="card-header">
              <div>
                <div className="card-title">Monthly CO₂ Trend</div>
                <div className="card-description">
                  Before vs After consolidation
                </div>
              </div>
            </div>
            <div className="card-body" style={{ height: "280px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={carbonMonthly}>
                  <defs>
                    <linearGradient
                      id="carbonBefore"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#DF1B41"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#DF1B41" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="carbonAfter"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#0CAF60"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#0CAF60" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f7" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#8792a2", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8792a2", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    unit=" kg"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="co2Before"
                    name="Before"
                    stroke="#DF1B41"
                    strokeWidth={2.5}
                    fill="url(#carbonBefore)"
                    dot={{ fill: "#DF1B41", r: 3, strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="co2After"
                    name="After"
                    stroke="#0CAF60"
                    strokeWidth={2.5}
                    fill="url(#carbonAfter)"
                    dot={{ fill: "#0CAF60", r: 3, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card animate-slide-up">
            <div className="card-header">
              <div className="card-title">By Vehicle Type</div>
              <div className="card-description">Emission breakdown</div>
            </div>
            <div className="card-body" style={{ height: "280px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={carbonBreakdown} layout="vertical" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f7" />
                  <XAxis
                    type="number"
                    tick={{ fill: "#8792a2", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="category"
                    type="category"
                    tick={{ fill: "#8792a2", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="before"
                    name="Before"
                    fill="#DF1B41"
                    radius={[0, 4, 4, 0]}
                    barSize={10}
                  />
                  <Bar
                    dataKey="after"
                    name="After"
                    fill="#0CAF60"
                    radius={[0, 4, 4, 0]}
                    barSize={10}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Impact Metrics ── */}
        <div className="stat-highlight-bar stagger-children">
          {[
            {
              value: `${totalSavings.toLocaleString()} kg`,
              label: "Total emissions cut",
              cls: "green",
            },
            { value: "18", label: "Clean air days", cls: "" },
            { value: "2,400 kWh", label: "Energy saved", cls: "purple" },
            { value: "1,850 L", label: "Fuel saved", cls: "amber" },
          ].map((s) => (
            <div key={s.label} className="stat-highlight-item">
              <div className={`stat-highlight-value ${s.cls}`}>{s.value}</div>
              <div className="stat-highlight-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
