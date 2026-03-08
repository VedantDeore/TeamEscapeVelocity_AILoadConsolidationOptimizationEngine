'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  FlaskConical, Award, Zap, Play, Pause, Cpu,
  Truck, Loader2, AlertCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend, AreaChart, Area,
} from 'recharts';
import { mockShipments, mockVehicles } from '@/lib/mock-data';
import { runScenarioSimulation, type SimulationResult, type SimulationScenario } from '@/lib/api';
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

// Helper: format cost in ₹ lakhs
function formatCostLakhs(cost: number): string {
  const lakhs = cost / 100000;
  if (lakhs >= 1) return `₹${lakhs.toFixed(1)}L`;
  const thousands = cost / 1000;
  return `₹${thousands.toFixed(0)}K`;
}

// Helper: compute radar scores from scenario data
function computeRadarData(scenarios: SimulationScenario[]) {
  const baseline = scenarios[0]; // No Consolidation
  if (!baseline) return [];

  return [
    {
      m: 'Cost Efficiency',
      ...Object.fromEntries(scenarios.map(sc => [
        sc.name,
        Math.round(Math.min(100, (1 - sc.total_cost / Math.max(baseline.total_cost * 1.5, 1)) * 100 + 50)),
      ])),
    },
    {
      m: 'Utilization',
      ...Object.fromEntries(scenarios.map(sc => [sc.name, Math.round(sc.avg_utilization)])),
    },
    {
      m: 'Carbon Score',
      ...Object.fromEntries(scenarios.map(sc => [
        sc.name,
        Math.round(Math.min(100, (1 - sc.co2_emissions / Math.max(baseline.co2_emissions * 1.3, 1)) * 100 + 40)),
      ])),
    },
    {
      m: 'SLA Compliance',
      ...Object.fromEntries(scenarios.map(sc => [sc.name, Math.round(sc.delivery_sla_met)])),
    },
    {
      m: 'Trip Efficiency',
      ...Object.fromEntries(scenarios.map(sc => [
        sc.name,
        Math.round(Math.min(100, (1 - sc.total_trips / Math.max(baseline.total_trips * 1.2, 1)) * 100 + 45)),
      ])),
    },
  ];
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function SimulatePage() {
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPacking, setShowPacking] = useState(false);
  const [packingData, setPackingData] = useState<PackingResultData | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [utilSteps, setUtilSteps] = useState<{ step: number; utilization: number }[]>([]);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call the real backend API
      const result = await runScenarioSimulation();
      setSimResult(result);

      // Also build the 3D packing visualisation
      const { data, steps } = buildSimPacking(150);
      setPackingData(data);
      setShowPacking(true);
      setAnimationStep(data.placements.length);
      setUtilSteps(steps);
    } catch (err: any) {
      console.error('Simulation failed:', err);
      setError(err.message || 'Failed to run simulation. Please ensure the backend is running.');
    } finally {
      setIsLoading(false);
    }
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

  // Derive display data from real API result
  const scenarios = simResult?.scenarios || [];
  const summary = simResult?.summary;
  const noConsolidation = scenarios[0]; // Scenario A
  const aiOptimised = scenarios[1];     // Scenario B

  // Compute headline values from real data
  const tripsSaved = noConsolidation && aiOptimised
    ? noConsolidation.total_trips - aiOptimised.total_trips : 0;
  const utilGain = summary?.utilization_gain ?? 0;
  const costSaved = noConsolidation && aiOptimised
    ? noConsolidation.total_cost - aiOptimised.total_cost : 0;
  const co2Saved = noConsolidation && aiOptimised
    ? Math.round(noConsolidation.co2_emissions - aiOptimised.co2_emissions) : 0;

  // Bar chart data from real scenarios
  const barData = scenarios.length > 0 ? [
    { metric: 'Trips', ...Object.fromEntries(scenarios.map(s => [s.name, s.total_trips])) },
    { metric: 'Cost (₹K)', ...Object.fromEntries(scenarios.map(s => [s.name, Math.round(s.total_cost / 1000)])) },
    { metric: 'CO₂ (kg)', ...Object.fromEntries(scenarios.map(s => [s.name, Math.round(s.co2_emissions)])) },
  ] : [];

  // Radar chart data computed from real scenarios
  const radarData = computeRadarData(scenarios);

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Scenario Simulator</h1>
          <p className="page-subtitle">Compare consolidation strategies &amp; visualise AI packing</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={run} disabled={isLoading}>
            {isLoading ? (
              <><Loader2 size={14} className="animate-spin" /> Running...</>
            ) : (
              <><FlaskConical size={14} /> Run Simulation</>
            )}
          </button>
          {showPacking && (
            <button className="btn btn-primary btn-sm" onClick={animate}>
              {isAnimating ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Animate</>}
            </button>
          )}
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Error State ── */}
        {error && (
          <div className="card animate-slide-up" style={{ borderColor: '#ef4444', background: '#fef2f2' }}>
            <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>Simulation Error</div>
                <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 2 }}>{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading State ── */}
        {isLoading && (
          <div className="card animate-slide-up" style={{ borderColor: 'rgba(99,91,255,.18)', background: '#fafaff' }}>
            <div className="card-body" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#635BFF' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0a2540' }}>Running Scenario Simulation</div>
                <div style={{ fontSize: 12.5, color: '#8792a2', marginTop: 4 }}>
                  Analysing pending shipments with 3 strategies: No Consolidation, AI Optimised, and Custom Config...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Empty State — Before first run ── */}
        {!simResult && !isLoading && !error && (
          <div className="card animate-slide-up" style={{ borderColor: 'rgba(99,91,255,.12)', background: '#fafaff' }}>
            <div className="card-body" style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: 'linear-gradient(135deg, #635BFF, #8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FlaskConical size={26} color="#fff" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 650, color: '#0a2540', letterSpacing: '-.02em' }}>
                  Ready to Simulate
                </div>
                <div style={{ fontSize: 13, color: '#8792a2', marginTop: 6, maxWidth: 420 }}>
                  Click <strong>"Run Simulation"</strong> to analyse your pending shipments with three strategies and see real cost, trip, and CO₂ comparisons.
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={run} style={{ marginTop: 8 }}>
                <FlaskConical size={14} /> Run Simulation
              </button>
            </div>
          </div>
        )}

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
            <div className="sim-packing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', borderTop: '1px solid #f0f3f7' }}>
              <div className="sim-packing-viewport" style={{ height: 440 }}>
                <PackingVisualizer3D
                  data={packingData} isAnimating={isAnimating} animationStep={animationStep}
                  onHoverItem={setHoveredItem} hoveredItem={hoveredItem}
                />
              </div>
              <div className="sim-packing-sidebar" style={{ borderLeft: '1px solid #f0f3f7', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        {/* ── Headline numbers (from real data) ── */}
        {simResult && (
          <div className="stat-highlight-bar stagger-children">
            {[
              { value: `${tripsSaved}`,                        label: 'Trips saved by AI', cls: 'purple' },
              { value: `+${utilGain.toFixed(0)}%`,             label: 'Utilisation gain',  cls: 'green'  },
              { value: formatCostLakhs(costSaved),             label: 'Daily cost savings', cls: 'amber'  },
              { value: `${co2Saved.toLocaleString()} kg`,      label: 'CO₂ reduced / day', cls: ''       },
            ].map(s => (
              <div key={s.label} className="stat-highlight-item">
                <div className={`stat-highlight-value ${s.cls}`}>{s.value}</div>
                <div className="stat-highlight-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Scenario cards (from real data) ── */}
        {scenarios.length > 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 650, color: '#0a2540', marginBottom: 14, letterSpacing: '-.02em' }}>Strategy comparison</h2>
            <div className="scenario-grid stagger-children">
              {scenarios.map((sc, i) => {
                const isWinner = sc.name === simResult?.best;
                return (
                  <div
                    key={sc.name}
                    className={`scenario-card ${isWinner ? 'winner' : ''}`}
                  >
                    <div className="scenario-name" style={{ color: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }}>
                      {sc.name}
                      {isWinner && (
                        <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: 10 }}>
                          <Award size={10} style={{ marginRight: 3 }} /> Best
                        </span>
                      )}
                    </div>
                    {[
                      { l: 'Total Trips',    v: `${sc.total_trips}` },
                      { l: 'Avg Utilisation', v: `${sc.avg_utilization}%` },
                      { l: 'Total Cost',     v: formatCostLakhs(sc.total_cost) },
                      { l: 'CO₂ Emissions',  v: `${Math.round(sc.co2_emissions).toLocaleString()} kg` },
                      { l: 'SLA Met',        v: `${sc.delivery_sla_met}%` },
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
        )}

        {/* ── Charts row (from real data) ── */}
        {scenarios.length > 0 && (
          <div className="sim-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                      <Bar key={s.name} dataKey={s.name} fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} radius={[4, 4, 0, 0]} barSize={26} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card animate-slide-up">
              <div className="card-header"><div className="card-title">Performance radar</div></div>
              <div className="card-body" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#f0f3f7" />
                    <PolarAngleAxis dataKey="m" tick={{ fill: '#8792a2', fontSize: 10 }} />
                    <PolarRadiusAxis tick={false} axisLine={false} />
                    {scenarios.map((s, i) => (
                      <Radar key={s.name} name={s.name} dataKey={s.name}
                        stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                        fillOpacity={0.08} strokeWidth={2} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 11, color: '#8792a2' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ── AI Advantage summary (from real data) ── */}
        {simResult && summary && noConsolidation && aiOptimised && (
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

              <div className="sim-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid #e3e8ee' }}>
                {[
                  {
                    value: `${tripsSaved}`,
                    label: 'Trips saved',
                    pct: `${summary.trips_saved_pct}%`,
                    color: '#10b981',
                  },
                  {
                    value: `+${utilGain.toFixed(0)}%`,
                    label: 'Utilisation gain',
                    pct: `${Math.abs(utilGain).toFixed(0)}%`,
                    color: '#635BFF',
                  },
                  {
                    value: formatCostLakhs(costSaved),
                    label: 'Cost saved / day',
                    pct: `${summary.cost_saved_pct}%`,
                    color: '#f59e0b',
                  },
                  {
                    value: `${co2Saved.toLocaleString()} kg`,
                    label: 'CO₂ reduced',
                    pct: `${summary.co2_saved_pct}%`,
                    color: '#10b981',
                  },
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
        )}

        {/* ── Note about data source ── */}
        {simResult?.summary?.note && (
          <div className="card" style={{ borderColor: '#f59e0b40', background: '#fffbeb' }}>
            <div className="card-body" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
              <AlertCircle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span style={{ color: '#92400e' }}>{simResult.summary.note}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
