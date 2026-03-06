'use client';

import { useState } from 'react';
import {
  FlaskConical, BarChart3, TrendingDown, Award,
  Truck, Gauge, IndianRupee, Leaf, Clock
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend
} from 'recharts';
import { mockScenarios, type ScenarioResult } from '@/lib/mock-data';

const metricIcons: Record<string, React.ElementType> = {
  'Total Trips': Truck,
  'Avg Utilization': Gauge,
  'Total Cost': IndianRupee,
  'CO₂ Emissions': Leaf,
  'Delivery SLA': Clock,
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      fontSize: '12px',
    }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.fill || entry.stroke, fontWeight: 600 }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
};

export default function SimulatePage() {
  const [scenarios] = useState<ScenarioResult[]>(mockScenarios);

  const barData = [
    { metric: 'Trips', ...Object.fromEntries(scenarios.map(s => [s.name, s.totalTrips])) },
    { metric: 'Cost (₹K)', ...Object.fromEntries(scenarios.map(s => [s.name, s.totalCost / 1000])) },
    { metric: 'CO₂ (kg)', ...Object.fromEntries(scenarios.map(s => [s.name, s.co2Emissions])) },
  ];

  const radarData = [
    { metric: 'Cost Efficiency', 'No Consolidation': 40, 'AI Optimized': 95, 'Custom Config': 75 },
    { metric: 'Utilization', 'No Consolidation': 58, 'AI Optimized': 87, 'Custom Config': 78 },
    { metric: 'Carbon Score', 'No Consolidation': 35, 'AI Optimized': 92, 'Custom Config': 70 },
    { metric: 'SLA Compliance', 'No Consolidation': 95, 'AI Optimized': 97, 'Custom Config': 96 },
    { metric: 'Trip Efficiency', 'No Consolidation': 45, 'AI Optimized': 90, 'Custom Config': 72 },
  ];

  const colors = ['#ef4444', '#0ea5e9', '#8b5cf6'];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Scenario Simulator</h1>
          <p className="page-subtitle">Compare consolidation strategies side by side</p>
        </div>
        <button className="btn btn-primary">
          <FlaskConical size={16} /> New Scenario
        </button>
      </div>

      <div className="page-body">
        {/* Scenario Cards */}
        <div className="scenario-grid stagger-children" style={{ marginBottom: '32px' }}>
          {scenarios.map((scenario, i) => (
            <div
              key={scenario.name}
              className={`scenario-card ${i === 1 ? 'winner' : ''}`}
            >
              <div className="scenario-name" style={{ color: colors[i] }}>
                {scenario.name}
              </div>

              <div className="scenario-metric">
                <div className="scenario-metric-label">Total Trips</div>
                <div className="scenario-metric-value">{scenario.totalTrips}</div>
              </div>
              <div className="scenario-metric">
                <div className="scenario-metric-label">Avg Utilization</div>
                <div className="scenario-metric-value">{scenario.avgUtilization}%</div>
              </div>
              <div className="scenario-metric">
                <div className="scenario-metric-label">Total Cost</div>
                <div className="scenario-metric-value">₹{(scenario.totalCost / 100000).toFixed(1)}L</div>
              </div>
              <div className="scenario-metric">
                <div className="scenario-metric-label">CO₂ Emissions</div>
                <div className="scenario-metric-value">{scenario.co2Emissions.toLocaleString()} kg</div>
              </div>
              <div className="scenario-metric">
                <div className="scenario-metric-label">Delivery SLA Met</div>
                <div className="scenario-metric-value">{scenario.deliverySlaMet}%</div>
              </div>

              {i === 1 && (
                <div style={{ marginTop: '16px' }}>
                  <span className="badge badge-success" style={{ fontSize: '12px', padding: '4px 12px' }}>
                    <Award size={12} style={{ marginRight: '4px' }} /> Best Performance
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Bar Comparison */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Metric Comparison</div>
            </div>
            <div className="card-body" style={{ height: '340px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                  <XAxis dataKey="metric" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {scenarios.map((s, i) => (
                    <Bar key={s.name} dataKey={s.name} fill={colors[i]} radius={[4, 4, 0, 0]} barSize={28} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Radar Chart */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Performance Radar</div>
            </div>
            <div className="card-body" style={{ height: '340px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border-secondary)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  {scenarios.map((s, i) => (
                    <Radar
                      key={s.name}
                      name={s.name}
                      dataKey={s.name}
                      stroke={colors[i]}
                      fill={colors[i]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Savings Summary */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">AI Optimized vs No Consolidation — Savings Summary</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
              {[
                { label: 'Trips Saved', value: '16', unit: 'trips', pct: '34%', color: '#0ea5e9' },
                { label: 'Utilization Gain', value: '+29%', unit: 'points', pct: '50%', color: '#8b5cf6' },
                { label: 'Cost Saved', value: '₹1.4L', unit: 'per day', pct: '31%', color: '#10b981' },
                { label: 'CO₂ Reduced', value: '800', unit: 'kg', pct: '33%', color: '#f59e0b' },
                { label: 'SLA Improved', value: '+2%', unit: 'points', pct: '2%', color: '#06b6d4' },
              ].map((stat) => (
                <div key={stat.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{stat.unit}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{stat.label}</div>
                  <div style={{
                    marginTop: '8px',
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: `${stat.color}15`,
                    color: stat.color,
                    fontSize: '11px',
                    fontWeight: 600,
                  }}>
                    ▼{stat.pct}
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
