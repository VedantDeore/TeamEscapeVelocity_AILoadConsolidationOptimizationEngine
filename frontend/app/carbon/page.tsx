'use client';

import { useState, useEffect } from 'react';
import {
  Leaf, TreePine, Car, Factory, Award, Download,
  TrendingDown, Zap
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { mockCarbonMonthly, mockCarbonBreakdown } from '@/lib/mock-data';

function AnimatedNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display.toLocaleString()}</>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '12px',
    }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color || entry.stroke || entry.fill, fontWeight: 600 }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value} kg CO₂
        </p>
      ))}
    </div>
  );
};

export default function CarbonPage() {
  const totalSavings = mockCarbonMonthly.reduce((sum, m) => sum + m.savings, 0);
  const treesEquiv = Math.floor(totalSavings / 22);
  const carKmEquiv = Math.floor(totalSavings * 6.25);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Carbon Impact Dashboard</h1>
          <p className="page-subtitle">ESG-aligned sustainability metrics & environmental impact</p>
        </div>
        <button className="btn btn-primary">
          <Download size={16} /> Download ESG Report
        </button>
      </div>

      <div className="page-body">
        {/* Hero Section: CO2 Saved + Equivalents */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '16px',
          marginBottom: '24px',
        }}>
          {/* Main CO2 Counter */}
          <div className="card" style={{
            gridColumn: '1 / 3',
            textAlign: 'center',
            padding: '36px 24px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)',
            borderColor: 'rgba(16, 185, 129, 0.2)',
          }}>
            <Leaf size={32} style={{ color: '#10b981', margin: '0 auto 12px', display: 'block' }} />
            <div style={{
              fontSize: '56px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1,
            }}>
              <AnimatedNumber value={totalSavings} />
            </div>
            <div style={{ fontSize: '16px', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: 500 }}>
              kg CO₂ Saved (6 Months)
            </div>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <span className="badge badge-success">▼ 33% reduction</span>
              <span className="badge badge-primary">Trend: Improving</span>
            </div>
          </div>

          {/* Equivalent: Trees */}
          <div className="card" style={{ textAlign: 'center', padding: '36px 16px' }}>
            <TreePine size={28} style={{ color: '#10b981', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#10b981' }}>
              <AnimatedNumber value={treesEquiv} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Trees Planted Equivalent
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              1 tree absorbs ~22 kg CO₂/year
            </div>
          </div>

          {/* Equivalent: Car Travel */}
          <div className="card" style={{ textAlign: 'center', padding: '36px 16px' }}>
            <Car size={28} style={{ color: '#06b6d4', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#06b6d4' }}>
              <AnimatedNumber value={carKmEquiv} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              km Car Travel Avoided
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Based on 160g CO₂/km avg car
            </div>
          </div>
        </div>

        {/* Green Score */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '28px 16px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
              Green Score
            </div>
            <div className="green-score">
              <div className="green-score-inner">
                <div style={{ fontSize: '36px', fontWeight: 800, color: '#10b981' }}>A+</div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>EXCELLENT</div>
              </div>
            </div>
            <div style={{ marginTop: '14px' }}>
              <Award size={16} style={{ color: '#fbbf24', display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Top 5% in industry</span>
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Monthly CO₂ Trend</div>
              <div className="card-description">Before vs After consolidation</div>
            </div>
            <div className="card-body" style={{ height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockCarbonMonthly}>
                  <defs>
                    <linearGradient id="carbonBefore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="carbonAfter" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} unit=" kg" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="co2Before" name="Before" stroke="#ef4444" strokeWidth={2} fill="url(#carbonBefore)" dot={{ fill: '#ef4444', r: 3 }} />
                  <Area type="monotone" dataKey="co2After" name="After" stroke="#10b981" strokeWidth={2} fill="url(#carbonAfter)" dot={{ fill: '#10b981', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breakdown */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Emission Breakdown</div>
              <div className="card-description">By vehicle type</div>
            </div>
            <div className="card-body" style={{ height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockCarbonBreakdown} layout="vertical" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                  <XAxis type="number" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="category" type="category" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="before" name="Before" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={12} />
                  <Bar dataKey="after" name="After" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Impact Metrics */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Environmental Impact Summary</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', textAlign: 'center' }}>
              {[
                { label: 'Total Emissions Cut', value: `${totalSavings.toLocaleString()} kg`, color: '#10b981', icon: '🌍' },
                { label: 'Clean Air Days', value: '18', color: '#06b6d4', icon: '💨' },
                { label: 'Energy Saved', value: '2,400 kWh', color: '#8b5cf6', icon: '⚡' },
                { label: 'Fuel Saved', value: '1,850 L', color: '#f59e0b', icon: '⛽' },
                { label: 'Trips Eliminated', value: '96', color: '#0ea5e9', icon: '🚛' },
                { label: 'Green Score', value: 'A+', color: '#10b981', icon: '🏆' },
              ].map((m) => (
                <div key={m.label}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>{m.icon}</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
