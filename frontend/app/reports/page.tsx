'use client';

import { useState } from 'react';
import {
  FileText, Download, Layers, Gauge, IndianRupee,
  Leaf, Map, Calendar, FileSpreadsheet, File,
  Clock, ChevronRight
} from 'lucide-react';
import { mockReports, type Report } from '@/lib/mock-data';

const iconMap: Record<string, React.ElementType> = {
  layers: Layers,
  gauge: Gauge,
  'indian-rupee': IndianRupee,
  leaf: Leaf,
  map: Map,
};

const iconColors: Record<string, string> = {
  layers: '#0ea5e9',
  gauge: '#8b5cf6',
  'indian-rupee': '#10b981',
  leaf: '#06b6d4',
  map: '#f59e0b',
};

const iconBgs: Record<string, string> = {
  layers: 'rgba(14, 165, 233, 0.12)',
  gauge: 'rgba(139, 92, 246, 0.12)',
  'indian-rupee': 'rgba(16, 185, 129, 0.12)',
  leaf: 'rgba(6, 182, 212, 0.12)',
  map: 'rgba(245, 158, 11, 0.12)',
};

export default function ReportsPage() {
  const [selectedFormat, setSelectedFormat] = useState<string>('pdf');
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleGenerate = (reportId: string) => {
    setGeneratingId(reportId);
    setTimeout(() => setGeneratingId(null), 2000);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Export</h1>
          <p className="page-subtitle">Generate and download professional logistics reports</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Format:</span>
          <div className="tabs">
            {['pdf', 'csv', 'excel'].map((fmt) => (
              <button
                key={fmt}
                className={`tab ${selectedFormat === fmt ? 'active' : ''}`}
                onClick={() => setSelectedFormat(fmt)}
              >
                {fmt === 'pdf' ? <File size={12} /> : <FileSpreadsheet size={12} />}
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Report Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mockReports.map((report) => {
            const Icon = iconMap[report.icon] || FileText;
            const color = iconColors[report.icon] || '#0ea5e9';
            const bg = iconBgs[report.icon] || 'rgba(14, 165, 233, 0.12)';
            const isGenerating = generatingId === report.id;

            return (
              <div key={report.id} className="report-card">
                <div className="report-icon" style={{ background: bg }}>
                  <Icon size={22} style={{ color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {report.name}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
                    {report.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> Last: {report.lastGenerated}
                    </span>
                    <span className="badge badge-ghost">{report.type}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className={`btn ${isGenerating ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => handleGenerate(report.id)}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <><div className="loading-spinner" style={{ width: '14px', height: '14px' }} /> Generating...</>
                    ) : (
                      <><Download size={14} /> Generate {selectedFormat.toUpperCase()}</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="card" style={{ marginTop: '32px' }}>
          <div className="card-header">
            <div className="card-title">Report Generation History</div>
          </div>
          <div className="card-body">
            <div className="data-table-wrapper" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Type</th>
                    <th>Format</th>
                    <th>Generated</th>
                    <th>Size</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Daily Consolidation - Mar 7', type: 'Consolidation', format: 'PDF', date: '2026-03-07 06:15', size: '2.4 MB' },
                    { name: 'Weekly Utilization - W10', type: 'Utilization', format: 'Excel', date: '2026-03-06 18:30', size: '1.8 MB' },
                    { name: 'Carbon Report - Feb 2026', type: 'Carbon', format: 'PDF', date: '2026-03-01 09:00', size: '3.1 MB' },
                    { name: 'Cost Analysis - Q1 2026', type: 'Cost', format: 'CSV', date: '2026-02-28 12:00', size: '0.9 MB' },
                    { name: 'Route Efficiency - Feb 2026', type: 'Route', format: 'PDF', date: '2026-02-25 15:00', size: '2.7 MB' },
                  ].map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{row.name}</td>
                      <td><span className="badge badge-ghost">{row.type}</span></td>
                      <td>
                        <span className={`badge ${row.format === 'PDF' ? 'badge-danger' : row.format === 'Excel' ? 'badge-success' : 'badge-primary'}`}>
                          {row.format}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.date}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.size}</td>
                      <td>
                        <button className="btn btn-sm btn-ghost">
                          <Download size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
