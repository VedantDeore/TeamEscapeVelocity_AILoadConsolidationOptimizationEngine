'use client';

import { useState, useEffect } from 'react';
import {
  Package, Layers, Gauge, IndianRupee, Leaf, Truck,
  Upload, Zap, MessageSquare, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, AlertCircle, Box, Route,
  ArrowRight, Sparkles
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import Link from 'next/link';
import {
  mockDashboardKPIs, mockUtilizationTrend, mockActivityFeed
} from '@/lib/mock-data';

const iconMap: Record<string, React.ElementType> = {
  package: Package,
  layers: Layers,
  gauge: Gauge,
  'indian-rupee': IndianRupee,
  leaf: Leaf,
  truck: Truck,
  upload: Upload,
  'alert-triangle': AlertTriangle,
  'check-circle': CheckCircle,
  'alert-circle': AlertCircle,
  box: Box,
  route: Route,
};

const kpiColors = ['blue', 'violet', 'cyan', 'amber', 'green', 'rose'];

function AnimatedNumber({ value, suffix, prefix }: { value: number; suffix?: string; prefix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  const formatted = display >= 100000
    ? `${(display / 100000).toFixed(1)}L`
    : display >= 1000
    ? `${(display / 1000).toFixed(1)}K`
    : display.toLocaleString('en-IN');

  return (
    <span>
      {prefix}{formatted}{suffix}
    </span>
  );
}

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
        <p key={i} style={{ color: entry.color, fontWeight: 600 }}>
          {entry.name}: {entry.value}{entry.name === 'Utilization' ? '%' : ''}
        </p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-subtitle">Real-time logistics intelligence — March 7, 2026</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/shipments" className="btn btn-secondary">
            <Upload size={16} /> Upload Shipments
          </Link>
          <Link href="/consolidate" className="btn btn-primary">
            <Zap size={16} /> Run Optimization
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="kpi-grid stagger-children" style={{ marginBottom: '24px' }}>
          {mockDashboardKPIs.map((kpi, i) => {
            const Icon = iconMap[kpi.icon] || Package;
            return (
              <div key={kpi.label} className="kpi-card">
                <div className={`kpi-icon ${kpiColors[i]}`}>
                  <Icon size={20} />
                </div>
                <div className="kpi-value">
                  <AnimatedNumber
                    value={kpi.value}
                    suffix={kpi.suffix !== '₹' ? kpi.suffix : undefined}
                    prefix={kpi.suffix === '₹' ? '₹' : undefined}
                  />
                </div>
                <div className="kpi-label">{kpi.label}</div>
                <div className="kpi-change positive">
                  <TrendingUp size={12} />
                  {kpi.change}% {kpi.changeLabel}
                </div>
              </div>
            );
          })}
        </div>

        {/* Consolidation Alert */}
        <div className="alert-banner alert-warning animate-slide-up" style={{ marginBottom: '24px' }}>
          <AlertTriangle size={18} />
          <span style={{ flex: 1 }}>
            <strong>12 shipments</strong> heading to Chennai tomorrow can be merged — estimated savings: <strong>₹24,000</strong>
          </span>
          <Link href="/consolidate" className="btn btn-sm btn-primary">
            Consolidate Now <ArrowRight size={14} />
          </Link>
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Utilization Trend */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Utilization Trend</div>
                <div className="card-description">Vehicle utilization over last 30 days</div>
              </div>
              <div className="badge badge-success">↑ +29%</div>
            </div>
            <div className="card-body" style={{ height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockUtilizationTrend}>
                  <defs>
                    <linearGradient id="utilGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} domain={[40, 100]} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="utilization"
                    name="Utilization"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    fill="url(#utilGradient)"
                    dot={{ fill: '#0ea5e9', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, stroke: '#0ea5e9', strokeWidth: 2, fill: 'var(--bg-primary)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost Savings */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Cost Savings (₹)</div>
                <div className="card-description">Before vs After consolidation</div>
              </div>
            </div>
            <div className="card-body" style={{ height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockUtilizationTrend.slice(-6)} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cost" name="Cost" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Row: Activity Feed + Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          {/* Activity Feed */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Activity</div>
              <span className="badge badge-primary">{mockActivityFeed.length} updates</span>
            </div>
            <div className="card-body" style={{ padding: '0' }}>
              {mockActivityFeed.map((item) => {
                const Icon = iconMap[item.icon] || Package;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      padding: '14px 22px',
                      borderBottom: '1px solid var(--border-secondary)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: 'var(--radius-md)',
                      background: item.type === 'alert'
                        ? 'rgba(245, 158, 11, 0.1)'
                        : item.type === 'consolidation'
                        ? 'rgba(14, 165, 233, 0.1)'
                        : item.type === 'optimization'
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(139, 92, 246, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={16} style={{
                        color: item.type === 'alert' ? '#fbbf24'
                          : item.type === 'consolidation' ? '#38bdf8'
                          : item.type === 'optimization' ? '#34d399'
                          : '#a78bfa',
                      }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {item.message}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                        {item.timestamp}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Quick Actions</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Upload Shipments', desc: 'Import CSV or add manually', icon: Upload, href: '/shipments', color: 'blue' },
                { label: 'Run Optimization', desc: 'AI-powered consolidation', icon: Zap, href: '/consolidate', color: 'violet' },
                { label: 'View Routes', desc: 'Interactive map view', icon: Route, href: '/routes', color: 'cyan' },
                { label: 'AI Co-Pilot', desc: 'Ask anything about logistics', icon: MessageSquare, href: '/copilot', color: 'green' },
                { label: '3D Packing', desc: 'Visualize cargo loading', icon: Box, href: '/packing', color: 'amber' },
                { label: 'Carbon Report', desc: 'ESG sustainability metrics', icon: Leaf, href: '/carbon', color: 'rose' },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-secondary)',
                      transition: 'all 0.2s ease',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                    className="glow-border"
                  >
                    <div className={`kpi-icon ${action.color}`} style={{ width: '36px', height: '36px', marginBottom: 0 }}>
                      <Icon size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{action.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{action.desc}</div>
                    </div>
                    <ArrowRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Branding */}
        <div style={{
          textAlign: 'center',
          padding: '32px 0 16px',
          fontSize: '12px',
          color: 'var(--text-tertiary)',
        }}>
          <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
          Powered by LORRI AI Engine — Team Escape Velocity
        </div>
      </div>
    </>
  );
}
