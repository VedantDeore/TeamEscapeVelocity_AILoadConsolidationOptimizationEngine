'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Package, Layers, TrendingDown, IndianRupee,
  Leaf, Truck, Zap, Upload, BarChart3, AlertTriangle,
  ArrowRight, ChevronUp, ChevronDown, Activity,
  CheckCircle2, Clock, MapPin
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { mockUtilizationTrend, mockActivityFeed } from '@/lib/mock-data';

// Cost savings chart data — derived from utilization trend
const costSavingsData = mockUtilizationTrend.map(d => ({
  date: d.day,
  before: Math.round(d.cost),
  after: Math.round(d.cost * 0.69),   // 31% savings from consolidation
}));

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e3e8ee',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <p style={{ color: '#8792a2', marginBottom: '6px', fontWeight: 500 }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color, fontWeight: 700, fontSize: '13px' }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          {entry.name === 'Utilization' ? '%' : ''}
        </p>
      ))}
    </div>
  );
};

const kpis = [
  {
    icon: Package, label: 'Total Shipments', value: '150', change: '↑ 12% vs yesterday',
    pos: true, accentColor: '#635BFF',
  },
  {
    icon: Layers, label: 'Consolidation Rate', value: '87%', change: '↑ 5.2% vs last week',
    pos: true, accentColor: '#0CAF60',
  },
  {
    icon: TrendingDown, label: 'Avg Utilization', value: '87%', change: '↑ 29% improvement',
    pos: true, accentColor: '#F59E0B',
  },
  {
    icon: IndianRupee, label: 'Cost Savings', value: '₹1.4L', change: '↓ 31% reduction',
    pos: true, accentColor: '#EC4899',
  },
  {
    icon: Leaf, label: 'CO₂ Reduced', value: '800 kg', change: '↓ 33% reduction',
    pos: true, accentColor: '#0CAF60',
  },
  {
    icon: Truck, label: 'Trips Eliminated', value: '16', change: '↓ 34% fewer trips',
    pos: true, accentColor: '#635BFF',
  },
];

const activityColors: Record<string, { bg: string; color: string }> = {
  alert:       { bg: '#FFF8E6', color: '#E5850B' },
  success:     { bg: '#ECFDF5', color: '#0CAF60' },
  ai:          { bg: '#EEF2FF', color: '#635BFF' },
  info:        { bg: '#EFF6FF', color: '#0EA5E9' },
};

const activityIcons: Record<string, React.ElementType> = {
  alert:   AlertTriangle,
  success: CheckCircle2,
  ai:      Zap,
  info:    Activity,
};

export default function DashboardPage() {
  const [today] = useState(() =>
    new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  );

  return (
    <>
      {/* ── Page Header with gradient mesh ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time logistics intelligence — {today}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/shipments">
            <button className="btn btn-secondary">
              <Upload size={15} /> Upload Shipments
            </button>
          </Link>
          <Link href="/consolidate">
            <button className="btn btn-primary btn-lg">
              <Zap size={16} /> Run Optimization
            </button>
          </Link>
        </div>
      </div>

      <div className="page-body">

        {/* ── Hero Stats Bar (Stripe "backbone of commerce" style) ── */}
        <div className="stat-highlight-bar stagger-children" style={{ marginBottom: '28px' }}>
          {[
            { label: '150 shipments active', value: '150', sublabel: 'active today', colorClass: '' },
            { label: 'Consolidation rate', value: '87%', sublabel: 'consolidated', colorClass: 'purple' },
            { label: 'Trips eliminated', value: '16', sublabel: 'trips saved today', colorClass: 'green' },
            { label: 'Cost saved today', value: '₹1.4L', sublabel: '31% below baseline', colorClass: 'amber' },
          ].map((s) => (
            <div key={s.label} className="stat-highlight-item">
              <div className={`stat-highlight-value ${s.colorClass}`}>{s.value}</div>
              <div className="stat-highlight-label">{s.sublabel}</div>
            </div>
          ))}
        </div>

        {/* ── KPI Cards Grid ── */}
        <div
          className="stagger-children"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px',
            marginBottom: '28px',
          }}
        >
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="kpi-card">
                <div className="kpi-icon" style={{ background: `${kpi.accentColor}12` }}>
                  <Icon size={18} style={{ color: kpi.accentColor }} />
                </div>
                <div className="kpi-value">{kpi.value}</div>
                <div className="kpi-label">{kpi.label}</div>
                <div className={kpi.pos ? 'kpi-change-pos' : 'kpi-change-neg'}>
                  {kpi.change}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Alert Banner ── */}
        <div className="alert-banner alert-warning animate-slide-up" style={{ marginBottom: '24px' }}>
          <AlertTriangle size={18} style={{ color: '#E5850B', flexShrink: 0 }} />
          <div>
            <strong>12 shipments</strong> heading to Chennai tomorrow can be merged — estimated savings:&nbsp;
            <strong>₹24,000</strong>
          </div>
          <div className="alert-actions">
            <Link href="/consolidate">
              <button className="btn btn-primary btn-sm">
                Consolidate Now <ArrowRight size={12} />
              </button>
            </Link>
          </div>
        </div>

        {/* ── Charts Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {/* Utilization Trend */}
          <div className="card animate-slide-up">
            <div className="card-header">
              <div>
                <div className="card-title">Utilization Trend</div>
                <div className="card-description">Vehicle utilization over last 30 days</div>
              </div>
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ChevronUp size={11} /> +29%
              </span>
            </div>
            <div className="card-body" style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockUtilizationTrend}>
                  <defs>
                    <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#635BFF" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#635BFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f7" />
                  <XAxis dataKey="date" tick={{ fill: '#8792a2', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[50, 100]} tick={{ fill: '#8792a2', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone" dataKey="utilization" name="Utilization"
                    stroke="#635BFF" strokeWidth={2.5}
                    fill="url(#utilGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#635BFF', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost Savings Chart */}
          <div className="card animate-slide-up">
            <div className="card-header">
              <div>
                <div className="card-title">Cost Savings (₹)</div>
                <div className="card-description">Before vs After consolidation</div>
              </div>
              <span className="badge badge-primary">This month</span>
            </div>
            <div className="card-body" style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costSavingsData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f7" />
                  <XAxis dataKey="date" tick={{ fill: '#8792a2', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8792a2', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="before" name="Before" fill="#E3E8EE" radius={[3,3,0,0]} barSize={14} />
                  <Bar dataKey="after"  name="After"  fill="#635BFF"  radius={[3,3,0,0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Bottom Row: Gradient Feature Cards + Activity Feed ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', marginBottom: '24px' }}>

          {/* Feature Cards (Stripe product tile style) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Link href="/consolidate" style={{ textDecoration: 'none' }}>
              <div className="feature-card-purple" style={{ height: '100%' }}>
                <Layers size={24} style={{ marginBottom: '12px', opacity: 0.9 }} />
                <div className="feature-card-title">Consolidation Engine</div>
                <div className="feature-card-body">
                  AI-powered DBSCAN clustering & 3D bin-packing for maximum efficiency.
                </div>
                <div className="feature-card-link">
                  Run engine <ArrowRight size={13} />
                </div>
              </div>
            </Link>

            <Link href="/simulate" style={{ textDecoration: 'none' }}>
              <div className="feature-card-amber" style={{ height: '100%' }}>
                <BarChart3 size={24} style={{ marginBottom: '12px', opacity: 0.9 }} />
                <div className="feature-card-title">Scenario Simulator</div>
                <div className="feature-card-body">
                  Compare consolidation strategies side by side before committing.
                </div>
                <div className="feature-card-link">Compare now <ArrowRight size={13} /></div>
              </div>
            </Link>

            <Link href="/carbon" style={{ textDecoration: 'none' }}>
              <div className="feature-card-green" style={{ height: '100%' }}>
                <Leaf size={24} style={{ marginBottom: '12px', opacity: 0.9 }} />
                <div className="feature-card-title">Carbon Impact</div>
                <div className="feature-card-body">
                  ESG-aligned metrics — 800 kg CO₂ saved this month. A+ green score.
                </div>
                <div className="feature-card-link">View report <ArrowRight size={13} /></div>
              </div>
            </Link>

            <Link href="/routes" style={{ textDecoration: 'none' }}>
              <div className="feature-card-purple" style={{ background: 'linear-gradient(135deg, #0A2540 0%, #1E1B4B 100%)', height: '100%' }}>
                <MapPin size={24} style={{ marginBottom: '12px', opacity: 0.9 }} />
                <div className="feature-card-title">Route Map</div>
                <div className="feature-card-body">
                  Live geospatial view of all clusters and vehicles across India.
                </div>
                <div className="feature-card-link">Open map <ArrowRight size={13} /></div>
              </div>
            </Link>
          </div>

          {/* Activity Feed */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Activity</div>
              <span className="badge badge-ghost" style={{ fontSize: '10px' }}>Live</span>
            </div>
            <div className="card-body" style={{ padding: '12px 18px' }}>
              {mockActivityFeed.map((item: any, i: number) => {
                const colorSet = activityColors[item.type] || activityColors.info;
                const Icon = activityIcons[item.type] || Activity;
                return (
                  <div key={i} className="activity-item">
                    <div className="activity-dot" style={{ background: colorSet.bg }}>
                      <Icon size={14} style={{ color: colorSet.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.35 }}>
                        {item.message}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        {item.time}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Dark Hero Section (Stripe "Scale with confidence" style) ── */}
        <div className="hero-dark-section animate-slide-up">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'rgba(99,91,255,0.20)', color: '#a5b4fc',
                padding: '4px 12px', borderRadius: '999px',
                fontSize: '12px', fontWeight: 600, marginBottom: '18px',
              }}>
                <Zap size={11} /> AI-Powered Engine
              </div>
              <h2 className="hero-dark-title">
                Scale logistics operations<br />
                <span className="text-gradient-hero">with confidence.</span>
              </h2>
              <p className="hero-dark-subtitle" style={{ marginTop: '16px', maxWidth: '380px' }}>
                Handle hundreds of shipments per day with consistent AI-optimized routing,
                consolidation, and real-time cost intelligence.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
                <Link href="/copilot">
                  <button className="btn btn-primary">Ask AI Co-Pilot <ArrowRight size={14} /></button>
                </Link>
                <Link href="/reports">
                  <button className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.08)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.15)' }}>
                    View Reports
                  </button>
                </Link>
              </div>
            </div>
            <div className="hero-stats-row">
              {[
                { value: '150+', label: 'Shipments processed\ndaily', cls: '' },
                { value: '87%', label: 'Avg vehicle\nutilization', cls: 'purple' },
                { value: '31%', label: 'Average cost\nreduction', cls: 'green' },
                { value: '33%', label: 'CO₂ emissions\nreduced', cls: 'amber' },
              ].map((s) => (
                <div key={s.label} className="hero-stat">
                  <div className={`hero-stat-value ${s.cls}`}>{s.value}</div>
                  <div className="hero-stat-label" style={{ whiteSpace: 'pre-line' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
