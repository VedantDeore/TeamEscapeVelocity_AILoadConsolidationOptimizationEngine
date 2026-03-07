"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Leaf,
  TreePine,
  Car,
  Award,
  Download,
  Loader2,
  Truck,
  RefreshCw,
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
  Legend,
} from "recharts";
import { getCarbonMetrics, getCarbonRuns } from "@/lib/api";
import jsPDF from "jspdf";

const POLL_INTERVAL_MS = 15_000; // Refresh data every 15 seconds

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
      <p style={{ color: "#8792a2", marginBottom: "6px", fontWeight: 600 }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color || entry.stroke || entry.fill, fontWeight: 700, margin: "2px 0" }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value} kg CO₂
        </p>
      ))}
    </div>
  );
};

export default function CarbonPage() {
  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time metrics from /api/analytics/carbon
  const [metrics, setMetrics] = useState({
    co2_saved_total: 0, co2_before: 0, co2_after: 0, pct_saved: 0,
    trees_equivalent: 0, car_km_avoided: 0, green_score: "N/A",
    trips_eliminated: 0, energy_saved_kwh: 0, fuel_saved_liters: 0, clean_air_days: 0,
  });

  // Per-run data from /api/analytics/carbon-runs
  const [runs, setRuns] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);

  // ── Fetch all carbon data (reusable) ──
  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [metricsData, runsData] = await Promise.all([
        getCarbonMetrics().catch(() => null),
        getCarbonRuns().catch(() => null),
      ]);

      if (metricsData) {
        setMetrics({
          co2_saved_total: metricsData.co2_saved_total ?? 0,
          co2_before: metricsData.co2_before ?? 0,
          co2_after: metricsData.co2_after ?? 0,
          pct_saved: metricsData.pct_saved ?? 0,
          trees_equivalent: metricsData.trees_equivalent ?? 0,
          car_km_avoided: metricsData.car_km_avoided ?? 0,
          green_score: metricsData.green_score ?? "N/A",
          trips_eliminated: metricsData.trips_eliminated ?? 0,
          energy_saved_kwh: metricsData.energy_saved_kwh ?? 0,
          fuel_saved_liters: metricsData.fuel_saved_liters ?? 0,
          clean_air_days: metricsData.clean_air_days ?? 0,
        });
      }

      if (runsData) {
        if (runsData.runs?.length) setRuns(runsData.runs);
        if (runsData.clusters?.length) setClusters(runsData.clusters);
      }

      setLastUpdated(new Date());
    } finally {
      if (showSpinner) setTimeout(() => setRefreshing(false), 400);
    }
  }, []);

  // ── Initial fetch + polling every 15s ──
  useEffect(() => {
    fetchData(true); // initial load with spinner

    pollRef.current = setInterval(() => fetchData(false), POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  // ── Re-fetch when user returns to this tab ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchData]);

  // Chart data: per-run CO₂
  const runChartData = useMemo(() => {
    return runs.map((r) => ({
      name: `Run ${r.run}`,
      co2Before: r.co2_before,
      co2After: r.co2_after,
      saved: r.co2_saved,
      shipments: r.total_shipments,
    }));
  }, [runs]);

  // Chart data: per-cluster (truck) CO₂ from latest runs
  const clusterChartData = useMemo(() => {
    // Group clusters by vehicle name and aggregate
    const byVehicle: Record<string, { co2: number; count: number; distance: number }> = {};
    clusters.forEach((c) => {
      const name = c.vehicle_name || "Unknown";
      if (!byVehicle[name]) byVehicle[name] = { co2: 0, count: 0, distance: 0 };
      byVehicle[name].co2 += c.estimated_co2 || 0;
      byVehicle[name].count += 1;
      byVehicle[name].distance += c.route_distance_km || 0;
    });
    return Object.entries(byVehicle)
      .map(([name, v]) => ({
        vehicle: name.length > 18 ? name.slice(0, 16) + "…" : name,
        co2: Math.round(v.co2 * 100) / 100,
        trips: v.count,
        distance: Math.round(v.distance),
      }))
      .sort((a, b) => b.co2 - a.co2);
  }, [clusters]);

  // ── Download ESG Report as PDF ──
  const handleDownloadESG = useCallback(() => {
    setDownloading(true);
    try {
      const now = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      const addLine = (x1: number, x2: number, yPos: number, color = [200, 200, 200]) => {
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(0.5);
        doc.line(x1, yPos, x2, yPos);
      };
      const checkPage = (needed: number) => {
        if (y + needed > 275) { doc.addPage(); y = 20; }
      };

      // Header
      doc.setFillColor(10, 37, 64);
      doc.rect(0, 0, pageWidth, 42, "F");
      doc.setFillColor(16, 185, 129);
      doc.rect(0, 42, pageWidth, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("LORRI", 20, 18);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("AI Load Consolidation & Optimization Engine", 20, 25);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("ESG Sustainability Report", 20, 36);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Report Date: ${now}`, pageWidth - 20, 36, { align: "right" });
      y = 55;

      // Executive Summary
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(10, 37, 64);
      doc.text("Executive Summary", 20, y);
      y += 3;
      addLine(20, pageWidth - 20, y, [16, 185, 129]);
      y += 10;

      doc.setFillColor(16, 185, 129);
      doc.roundedRect(20, y - 5, 36, 22, 4, 4, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(metrics.green_score, 38, y + 9, { align: "center" });
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("ESG Green Score Rating", 64, y + 2);
      y += 26;

      const summaryMetrics = [
        { label: "Total CO2 Saved", value: `${metrics.co2_saved_total.toLocaleString()} kg` },
        { label: "CO2 Reduction", value: `${metrics.pct_saved}%` },
        { label: "Trips Eliminated", value: `${metrics.trips_eliminated}` },
        { label: "Trees Equivalent", value: `${metrics.trees_equivalent.toLocaleString()}` },
        { label: "Car Travel Avoided", value: `${metrics.car_km_avoided.toLocaleString()} km` },
        { label: "Clean Air Days", value: `${metrics.clean_air_days}` },
      ];
      const colWidth = (pageWidth - 40) / 3;
      summaryMetrics.forEach((m, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 20 + col * colWidth;
        const yOff = y + row * 22;
        doc.setFillColor(248, 249, 254);
        doc.roundedRect(x, yOff, colWidth - 6, 18, 3, 3, "F");
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(10, 37, 64);
        doc.text(m.value, x + 5, yOff + 8);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        doc.text(m.label, x + 5, yOff + 14);
      });
      y += 50;

      // Per-Run CO₂ Table
      checkPage(60);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(10, 37, 64);
      doc.text("CO2 Per Consolidation Run", 20, y);
      y += 3;
      addLine(20, pageWidth - 20, y, [16, 185, 129]);
      y += 10;

      doc.setFillColor(10, 37, 64);
      doc.rect(20, y - 4, pageWidth - 40, 10, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Run", 25, y + 2);
      doc.text("Shipments", 55, y + 2);
      doc.text("Before (kg)", 90, y + 2);
      doc.text("After (kg)", 125, y + 2);
      doc.text("Saved (kg)", 160, y + 2);
      y += 10;

      doc.setFont("helvetica", "normal");
      runs.forEach((r: any, i: number) => {
        checkPage(12);
        if (i % 2 === 0) {
          doc.setFillColor(248, 249, 254);
          doc.rect(20, y - 4, pageWidth - 40, 10, "F");
        }
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(9);
        doc.text(`Run ${r.run}`, 25, y + 2);
        doc.text(String(r.total_shipments), 55, y + 2);
        doc.text(String(r.co2_before), 90, y + 2);
        doc.text(String(r.co2_after), 125, y + 2);
        doc.setTextColor(16, 185, 129);
        doc.setFont("helvetica", "bold");
        doc.text(String(r.co2_saved), 160, y + 2);
        doc.setFont("helvetica", "normal");
        y += 10;
      });
      y += 8;

      // Compliance
      checkPage(50);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(10, 37, 64);
      doc.text("Compliance & Standards", 20, y);
      y += 3;
      addLine(20, pageWidth - 20, y, [16, 185, 129]);
      y += 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text("This report is aligned with:", 20, y);
      y += 8;
      ["GHG Protocol Corporate Standard (Scope 1 & 3)",
       "ISO 14064-1:2018 - Greenhouse Gas Accounting",
       "UN Sustainable Development Goals (SDG 13: Climate Action)",
       "India's National Action Plan on Climate Change (NAPCC)",
      ].forEach((s) => {
        doc.setFillColor(16, 185, 129);
        doc.circle(25, y - 1.2, 1.5, "F");
        doc.text(s, 30, y);
        y += 7;
      });
      y += 5;

      addLine(20, pageWidth - 20, y);
      y += 8;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated on ${now} by Lorri AI Load Consolidation & Optimization Engine`, 20, y);
      doc.text("Confidential", pageWidth - 20, y, { align: "right" });

      doc.save(`Lorri_ESG_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  }, [metrics, runs]);

  const totalSavings = metrics.co2_saved_total || 0;
  const treesEquiv = metrics.trees_equivalent || 0;
  const carKmEquiv = metrics.car_km_avoided || 0;
  const greenScore = metrics.green_score || "N/A";
  const pctReduction = metrics.pct_saved || 0;
  const tripsEliminated = metrics.trips_eliminated || 0;
  const energySaved = metrics.energy_saved_kwh || 0;
  const fuelSaved = metrics.fuel_saved_liters || 0;
  const cleanAirDays = metrics.clean_air_days || 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Carbon Impact</h1>
          <p className="page-subtitle">ESG-aligned sustainability metrics & environmental impact</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {lastUpdated && (
            <span style={{ fontSize: "11px", color: "#8792a2", whiteSpace: "nowrap" }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px" }}
          >
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button className="btn btn-primary" onClick={handleDownloadESG} disabled={downloading}>
            {downloading ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            {downloading ? " Generating..." : " Download ESG Report"}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* ── Dark Hero: CO₂ Total ── */}
        <div className="hero-dark-section animate-slide-up" style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "12px",
              background: "linear-gradient(135deg, #10B981, #06B6D4)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Leaf size={26} color="white" />
            </div>
            <div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>
                Total CO₂ Saved — All Consolidation Runs
              </div>
              <div style={{ fontSize: "52px", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em" }} className="text-gradient-green">
                <AnimatedNumber value={totalSavings} /> kg
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
              <span className="badge badge-success">▼ {pctReduction}% reduction</span>
              <span className="badge badge-primary">
                {runs.length} consolidation run{runs.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="hero-stats-row">
            {[
              { value: `${treesEquiv}`, label: "Trees planted\nequivalent", cls: "green" },
              { value: `${carKmEquiv.toLocaleString()}`, label: "km car travel\navoided", cls: "purple" },
              { value: `${tripsEliminated}`, label: "Trips\neliminated", cls: "" },
              { value: greenScore, label: "ESG green\nscore rating", cls: "amber" },
            ].map((s) => (
              <div key={s.label} className="hero-stat">
                <div className={`hero-stat-value ${s.cls}`}>{s.value}</div>
                <div className="hero-stat-label" style={{ whiteSpace: "pre-line" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Equivalent Impact Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "24px" }}>
          <div className="feature-card-green animate-slide-up">
            <TreePine size={26} style={{ marginBottom: "12px", opacity: 0.9 }} />
            <div style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
              <AnimatedNumber value={treesEquiv} />
            </div>
            <div className="feature-card-title" style={{ marginTop: "6px" }}>Trees Planted Equivalent</div>
            <div className="feature-card-body">1 tree absorbs ~22 kg CO₂/year</div>
          </div>

          <div className="feature-card-purple animate-slide-up">
            <Car size={26} style={{ marginBottom: "12px", opacity: 0.9 }} />
            <div style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
              <AnimatedNumber value={carKmEquiv} />
            </div>
            <div className="feature-card-title" style={{ marginTop: "6px" }}>km Car Travel Avoided</div>
            <div className="feature-card-body">Based on 160g CO₂/km average car</div>
          </div>

          <div className="feature-card-amber animate-slide-up">
            <Award size={26} style={{ marginBottom: "12px", opacity: 0.9 }} />
            <div style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {greenScore}
            </div>
            <div className="feature-card-title" style={{ marginTop: "6px" }}>Green Score Rating</div>
            <div className="feature-card-body">
              {greenScore === "A+" ? "Top 5% in industry — Excellent" :
               greenScore === "A" ? "Top 10% in industry — Very Good" :
               "Sustainability performance rating"}
            </div>
          </div>
        </div>

        {/* ── Charts Row: Per-Run CO₂ + Per-Truck Breakdown ── */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "24px" }}>
          {/* CO₂ by Consolidation Run */}
          <div className="card animate-slide-up">
            <div className="card-header">
              <div>
                <div className="card-title">CO₂ by Consolidation Run</div>
                <div className="card-description">Before vs After emissions per run</div>
              </div>
              <span className="badge badge-primary" style={{ fontSize: "11px" }}>
                {runs.length} runs
              </span>
            </div>
            <div className="card-body" style={{ height: "300px" }}>
              {runChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={runChartData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f7" />
                    <XAxis dataKey="name" tick={{ fill: "#8792a2", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#8792a2", fontSize: 11 }} axisLine={false} tickLine={false} unit=" kg" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="co2Before" name="Before" fill="#DF1B41" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="co2After" name="After" fill="#0CAF60" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#8792a2", fontSize: "13px" }}>
                  <div style={{ textAlign: "center" }}>
                    <Truck size={32} style={{ opacity: 0.3, marginBottom: "8px" }} />
                    <p>No consolidation runs yet.</p>
                    <p style={{ fontSize: "11px" }}>Run a consolidation to see CO₂ data here.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Per-Truck CO₂ Breakdown */}
          <div className="card animate-slide-up">
            <div className="card-header">
              <div className="card-title">By Truck / Vehicle</div>
              <div className="card-description">CO₂ per vehicle type</div>
            </div>
            <div className="card-body" style={{ height: "300px" }}>
              {clusterChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clusterChartData} layout="vertical" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f7" />
                    <XAxis type="number" tick={{ fill: "#8792a2", fontSize: 10 }} axisLine={false} tickLine={false} unit=" kg" />
                    <YAxis dataKey="vehicle" type="category" tick={{ fill: "#8792a2", fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div style={{ background: "#fff", border: "1px solid #e3e8ee", borderRadius: "8px", padding: "12px 16px", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                            <p style={{ fontWeight: 700, marginBottom: "4px" }}>{d?.vehicle}</p>
                            <p style={{ color: "#DF1B41" }}>CO₂: {d?.co2?.toLocaleString()} kg</p>
                            <p style={{ color: "#8792a2" }}>Trips: {d?.trips} | Distance: {d?.distance?.toLocaleString()} km</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="co2" name="CO₂ Emitted" fill="#635BFF" radius={[0, 4, 4, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#8792a2", fontSize: "13px" }}>
                  <div style={{ textAlign: "center" }}>
                    <Truck size={28} style={{ opacity: 0.3, marginBottom: "8px" }} />
                    <p>No truck data yet.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Impact Metrics ── */}
        <div className="stat-highlight-bar stagger-children">
          {[
            { value: `${totalSavings.toLocaleString()} kg`, label: "Total emissions cut", cls: "green" },
            { value: `${cleanAirDays}`, label: "Clean air days", cls: "" },
            { value: `${energySaved.toLocaleString()} kWh`, label: "Energy saved", cls: "purple" },
            { value: `${fuelSaved.toLocaleString()} L`, label: "Fuel saved", cls: "amber" },
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
