'use client';

import { useState } from 'react';
import {
  Package, Upload, Plus, Search, Filter, Download,
  ChevronDown, ChevronUp, MoreVertical, Trash2, Edit,
  ArrowUpDown, X, FileSpreadsheet, AlertCircle
} from 'lucide-react';
import { mockShipments, type Shipment } from '@/lib/mock-data';

const priorityBadge: Record<string, string> = {
  normal: 'badge-ghost',
  express: 'badge-warning',
  critical: 'badge-danger',
};

const cargoIcons: Record<string, string> = {
  general: '📦',
  fragile: '⚡',
  refrigerated: '❄️',
  hazardous: '☢️',
};

const statusBadge: Record<string, string> = {
  pending: 'badge-warning',
  consolidated: 'badge-primary',
  in_transit: 'badge-violet',
  delivered: 'badge-success',
};

export default function ShipmentsPage() {
  const [shipments] = useState<Shipment[]>(mockShipments);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortField, setSortField] = useState<keyof Shipment>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const perPage = 15;

  const filtered = shipments.filter((s) => {
    const matchSearch = s.shipmentCode.toLowerCase().includes(searchQuery.toLowerCase())
      || s.originCity.toLowerCase().includes(searchQuery.toLowerCase())
      || s.destCity.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPriority = priorityFilter === 'all' || s.priority === priorityFilter;
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchPriority && matchStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
  });

  const totalPages = Math.ceil(sorted.length / perPage);
  const paged = sorted.slice((currentPage - 1) * perPage, currentPage * perPage);

  const toggleSort = (field: keyof Shipment) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map(s => s.id)));
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Shipment Manager</h1>
          <p className="page-subtitle">{filtered.length} shipments · {filtered.filter(s => s.status === 'pending').length} pending consolidation</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setShowUploadModal(true)}>
            <Upload size={16} /> Upload CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Shipment
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Filters Bar */}
        <div style={{
          display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{ position: 'relative', flex: '1', maxWidth: '360px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              className="input"
              placeholder="Search by code, origin, or destination..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <select
            className="input select"
            style={{ width: '160px', flex: 'none' }}
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Priorities</option>
            <option value="normal">Normal</option>
            <option value="express">Express</option>
            <option value="critical">Critical</option>
          </select>
          <select
            className="input select"
            style={{ width: '160px', flex: 'none' }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="consolidated">Consolidated</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
          </select>
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <span className="badge badge-primary">{selectedIds.size} selected</span>
              <button className="btn btn-sm btn-danger">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="data-table-wrapper animate-slide-up">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === paged.length && paged.length > 0}
                    onChange={toggleAll}
                    style={{ accentColor: 'var(--lorri-primary)' }}
                  />
                </th>
                <th onClick={() => toggleSort('shipmentCode')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Code <ArrowUpDown size={12} />
                  </span>
                </th>
                <th onClick={() => toggleSort('originCity')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Origin <ArrowUpDown size={12} />
                  </span>
                </th>
                <th onClick={() => toggleSort('destCity')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Destination <ArrowUpDown size={12} />
                  </span>
                </th>
                <th onClick={() => toggleSort('weightKg')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Weight <ArrowUpDown size={12} />
                  </span>
                </th>
                <th>Volume</th>
                <th>Priority</th>
                <th>Cargo</th>
                <th>Status</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      style={{ accentColor: 'var(--lorri-primary)' }}
                    />
                  </td>
                  <td style={{ fontWeight: 600, fontFamily: 'var(--font-geist-mono)', fontSize: '12px' }}>
                    {s.shipmentCode}
                  </td>
                  <td>{s.originCity}</td>
                  <td>{s.destCity}</td>
                  <td>{s.weightKg.toLocaleString()} kg</td>
                  <td>{s.volumeM3} m³</td>
                  <td>
                    <span className={`badge ${priorityBadge[s.priority]}`}>{s.priority}</span>
                  </td>
                  <td>
                    <span title={s.cargoType}>{cargoIcons[s.cargoType]} {s.cargoType}</span>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge[s.status]}`}>{s.status.replace('_', ' ')}</span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-icon" style={{ width: '28px', height: '28px' }}>
                      <MoreVertical size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '16px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}>
          <span>
            Showing {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-sm btn-secondary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            ))}
            {totalPages > 5 && <span style={{ padding: '4px 8px' }}>...</span>}
            <button
              className="btn btn-sm btn-secondary"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>

        {/* Upload CSV Modal */}
        {showUploadModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          }} onClick={() => setShowUploadModal(false)}>
            <div
              className="card animate-slide-up"
              style={{ width: '560px', maxWidth: '90vw' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header">
                <div className="card-title">Upload Shipments CSV</div>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowUploadModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="card-body">
                <div className="upload-zone">
                  <div className="upload-zone-icon">
                    <FileSpreadsheet size={28} />
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Drop your CSV file here
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    or click to browse files
                  </p>
                  <button className="btn btn-secondary btn-sm">
                    <Download size={14} /> Download Template
                  </button>
                </div>
                <div className="alert-banner alert-info" style={{ marginTop: '16px' }}>
                  <AlertCircle size={16} />
                  <span style={{ fontSize: '12px' }}>
                    Expected columns: shipment_id, origin_city, origin_lat, origin_lng, dest_city, dest_lat, dest_lng, weight_kg, volume_m3, priority, cargo_type
                  </span>
                </div>
              </div>
              <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>Cancel</button>
                <button className="btn btn-primary">
                  <Upload size={14} /> Upload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Shipment Modal */}
        {showAddModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          }} onClick={() => setShowAddModal(false)}>
            <div
              className="card animate-slide-up"
              style={{ width: '640px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header">
                <div className="card-title">Add New Shipment</div>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowAddModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="label">Origin City</label>
                    <input className="input" placeholder="e.g. Delhi" />
                  </div>
                  <div>
                    <label className="label">Destination City</label>
                    <input className="input" placeholder="e.g. Mumbai" />
                  </div>
                  <div>
                    <label className="label">Weight (kg)</label>
                    <input className="input" type="number" placeholder="0" />
                  </div>
                  <div>
                    <label className="label">Volume (m³)</label>
                    <input className="input" type="number" placeholder="0" />
                  </div>
                  <div>
                    <label className="label">Length (cm)</label>
                    <input className="input" type="number" placeholder="0" />
                  </div>
                  <div>
                    <label className="label">Width (cm)</label>
                    <input className="input" type="number" placeholder="0" />
                  </div>
                  <div>
                    <label className="label">Height (cm)</label>
                    <input className="input" type="number" placeholder="0" />
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <select className="input select">
                      <option value="normal">Normal</option>
                      <option value="express">Express</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Cargo Type</label>
                    <select className="input select">
                      <option value="general">General</option>
                      <option value="fragile">Fragile</option>
                      <option value="refrigerated">Refrigerated</option>
                      <option value="hazardous">Hazardous</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Delivery Window</label>
                    <select className="input select">
                      <option value="same">Same Day</option>
                      <option value="next">Next Day</option>
                      <option value="two">2-Day</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="label">Special Instructions</label>
                    <textarea className="input textarea" placeholder="Any special handling requirements..." rows={3} />
                  </div>
                </div>
              </div>
              <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button className="btn btn-primary">
                  <Plus size={14} /> Create Shipment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
