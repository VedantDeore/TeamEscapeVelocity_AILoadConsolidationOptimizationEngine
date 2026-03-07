"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Upload,
  Plus,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Trash2,
  Edit,
  ArrowUpDown,
  X,
  FileSpreadsheet,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import { mockShipments, type Shipment } from "@/lib/mock-data";
import { getShipments, uploadShipmentsCSV, createShipment, getCities, downloadCSVTemplate } from "@/lib/api";

const priorityBadge: Record<string, string> = {
  normal: "badge-ghost",
  express: "badge-warning",
  critical: "badge-danger",
};

const cargoIcons: Record<string, string> = {
  general: "📦",
  fragile: "⚡",
  refrigerated: "❄️",
  hazardous: "☢️",
};

const statusBadge: Record<string, string> = {
  pending: "badge-warning",
  consolidated: "badge-primary",
  in_transit: "badge-violet",
  delivered: "badge-success",
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);

  useEffect(() => {
    getShipments()
      .then((data) => {
        if (data?.length) {
          const mapped = data.map((s: any) => ({
            id: s.id,
            shipmentCode: s.shipment_code,
            originCity: s.origin_city,
            originLat: s.origin_lat,
            originLng: s.origin_lng,
            destCity: s.dest_city,
            destLat: s.dest_lat,
            destLng: s.dest_lng,
            weightKg: s.weight_kg,
            volumeM3: s.volume_m3,
            lengthCm: s.length_cm,
            widthCm: s.width_cm,
            heightCm: s.height_cm,
            deliveryWindowStart: s.delivery_window_start,
            deliveryWindowEnd: s.delivery_window_end,
            priority: s.priority,
            cargoType: s.cargo_type,
            status: s.status,
            createdAt: s.created_at,
          }));
          setShipments(mapped);
        } else {
          setShipments(mockShipments);
        }
      })
      .catch(() => {
        setShipments(mockShipments);
      });
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortField, setSortField] = useState<keyof Shipment>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newShipment, setNewShipment] = useState({
    origin_city: "",
    dest_city: "",
    weight_kg: 0,
    volume_m3: 0,
    length_cm: 0,
    width_cm: 0,
    height_cm: 0,
    priority: "normal",
    cargo_type: "general",
    delivery_window: "same",
    special_instructions: "",
  });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [cities, setCities] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const perPage = 15;

  useEffect(() => {
    getCities()
      .then((data) => {
        if (data?.length) {
          setCities(data.map((c: any) => ({ name: c.name, lat: c.lat, lng: c.lng })));
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshShipments = () => {
    getShipments()
      .then((data) => {
        if (data?.length) {
          const mapped = data.map((s: any) => ({
            id: s.id,
            shipmentCode: s.shipment_code,
            originCity: s.origin_city,
            originLat: s.origin_lat,
            originLng: s.origin_lng,
            destCity: s.dest_city,
            destLat: s.dest_lat,
            destLng: s.dest_lng,
            weightKg: s.weight_kg,
            volumeM3: s.volume_m3,
            lengthCm: s.length_cm,
            widthCm: s.width_cm,
            heightCm: s.height_cm,
            deliveryWindowStart: s.delivery_window_start,
            deliveryWindowEnd: s.delivery_window_end,
            priority: s.priority,
            cargoType: s.cargo_type,
            status: s.status,
            createdAt: s.created_at,
          }));
          setShipments(mapped);
        }
      })
      .catch(() => {});
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    setIsUploading(true);
    setUploadMsg(null);
    try {
      const result = await uploadShipmentsCSV(csvFile);
      const inserted = result?.inserted ?? 0;
      const skipped = result?.skipped ?? 0;
      let message = `Successfully imported ${inserted} shipments`;
      if (skipped > 0) {
        message += ` (${skipped} duplicates skipped)`;
      }
      showToast(message);
      setShowUploadModal(false);
      setCsvFile(null);
      refreshShipments();
    } catch (err: any) {
      const msg = err?.message || "Failed to upload CSV. Check the file format.";
      showToast(msg, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!newShipment.origin_city || !newShipment.dest_city) {
      showToast("Origin and Destination cities are required.", "error");
      return;
    }
    setIsCreating(true);
    try {
      // Try to find city in cities list (case-insensitive, partial match)
      const findCity = (cityName: string) => {
        if (!cityName) return null;
        const lowerName = cityName.toLowerCase().trim();
        return cities.find((c) => 
          c.name.toLowerCase() === lowerName || 
          c.name.toLowerCase().includes(lowerName) ||
          lowerName.includes(c.name.toLowerCase())
        );
      };
      
      const originCity = findCity(newShipment.origin_city);
      const destCity = findCity(newShipment.dest_city);
      
      const now = new Date();
      const deliveryEnd = new Date(now);
      if (newShipment.delivery_window === "same") {
        deliveryEnd.setHours(18, 0, 0, 0);
      } else if (newShipment.delivery_window === "next") {
        deliveryEnd.setDate(deliveryEnd.getDate() + 1);
        deliveryEnd.setHours(18, 0, 0, 0);
      } else {
        deliveryEnd.setDate(deliveryEnd.getDate() + 2);
        deliveryEnd.setHours(18, 0, 0, 0);
      }

      const shipmentData: any = {
        origin_city: newShipment.origin_city.trim(),
        dest_city: newShipment.dest_city.trim(),
        weight_kg: newShipment.weight_kg || 100,
        volume_m3: newShipment.volume_m3 || (newShipment.length_cm * newShipment.width_cm * newShipment.height_cm / 1000000) || 1,
        length_cm: newShipment.length_cm || 100,
        width_cm: newShipment.width_cm || 80,
        height_cm: newShipment.height_cm || 60,
        priority: newShipment.priority,
        cargo_type: newShipment.cargo_type,
        delivery_window_start: now.toISOString(),
        delivery_window_end: deliveryEnd.toISOString(),
        status: "pending",
      };

      // Add coordinates if found, backend will geocode if missing
      if (originCity) {
        shipmentData.origin_lat = originCity.lat;
        shipmentData.origin_lng = originCity.lng;
      }
      if (destCity) {
        shipmentData.dest_lat = destCity.lat;
        shipmentData.dest_lng = destCity.lng;
      }
      // If cities not found, backend will geocode them automatically

      await createShipment(shipmentData);
      showToast("Shipment created successfully!");
      setShowAddModal(false);
      setNewShipment({
        origin_city: "",
        dest_city: "",
        weight_kg: 0,
        volume_m3: 0,
        length_cm: 0,
        width_cm: 0,
        height_cm: 0,
        priority: "normal",
        cargo_type: "general",
        delivery_window: "same",
        special_instructions: "",
      });
      refreshShipments();
    } catch (err: any) {
      const msg = err?.message || "Failed to create shipment.";
      showToast(msg, "error");
      console.error("Shipment creation error:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const filtered = shipments.filter((s) => {
    const matchSearch =
      s.shipmentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.originCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.destCity.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPriority =
      priorityFilter === "all" || s.priority === priorityFilter;
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchPriority && matchStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === "string" && typeof bVal === "string")
      return sortDir === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    return sortDir === "asc"
      ? Number(aVal) - Number(bVal)
      : Number(bVal) - Number(aVal);
  });

  const totalPages = Math.ceil(sorted.length / perPage);
  const paged = sorted.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  const toggleSort = (field: keyof Shipment) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === paged.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paged.map((s) => s.id)));
  };

  // Quick stats for the header
  const pending = shipments.filter((s) => s.status === "pending").length;
  const critical = shipments.filter((s) => s.priority === "critical").length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Shipment Manager</h1>
          <p className="page-subtitle">
            {filtered.length} shipments · {pending} pending consolidation ·{" "}
            {critical} critical
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowUploadModal(true)}
          >
            <Upload size={15} /> Upload CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={15} /> Add Shipment
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* ── Quick Stats ── */}
        <div
          className="stat-highlight-bar stagger-children"
          style={{ marginBottom: "20px" }}
        >
          {[
            {
              value: shipments.length.toString(),
              label: "Total shipments",
              cls: "",
            },
            {
              value: pending.toString(),
              label: "Awaiting consolidation",
              cls: "amber",
            },
            {
              value: shipments
                .filter((s) => s.status === "in_transit")
                .length.toString(),
              label: "In transit",
              cls: "purple",
            },
            {
              value: critical.toString(),
              label: "Critical priority",
              cls: "amber",
            },
          ].map((s) => (
            <div key={s.label} className="stat-highlight-item">
              <div className={`stat-highlight-value ${s.cls}`}>{s.value}</div>
              <div className="stat-highlight-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters Bar ── */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "16px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "relative", flex: "1", maxWidth: "360px" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-tertiary)",
              }}
            />
            <input
              className="input"
              placeholder="Search by code, origin, destination..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: "36px" }}
            />
          </div>
          <select
            className="input"
            style={{ width: "150px", flex: "none" }}
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Priorities</option>
            <option value="normal">Normal</option>
            <option value="express">Express</option>
            <option value="critical">Critical</option>
          </select>
          <select
            className="input"
            style={{ width: "150px", flex: "none" }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="consolidated">Consolidated</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
          </select>
          {selectedIds.size > 0 && (
            <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
              <span className="badge badge-primary">
                {selectedIds.size} selected
              </span>
              <button className="btn btn-sm btn-danger">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>

        {/* ── Data Table ── */}
        <div className="data-table-wrapper animate-slide-up">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === paged.length && paged.length > 0
                    }
                    onChange={toggleAll}
                    style={{ accentColor: "var(--lorri-primary)" }}
                  />
                </th>
                {[
                  { key: "shipmentCode", label: "Code" },
                  { key: "originCity", label: "Origin" },
                  { key: "destCity", label: "Destination" },
                  { key: "weightKg", label: "Weight" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key as keyof Shipment)}
                    style={{ cursor: "pointer" }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {col.label} <ArrowUpDown size={11} />
                    </span>
                  </th>
                ))}
                <th>Volume</th>
                <th>Priority</th>
                <th>Cargo</th>
                <th>Status</th>
                <th style={{ width: "40px" }}></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => (
                <tr key={s.id} style={{ cursor: "pointer" }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      style={{ accentColor: "var(--lorri-primary)" }}
                    />
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 650,
                        fontFamily: "monospace",
                        fontSize: "12px",
                        color: "var(--lorri-primary)",
                      }}
                    >
                      {s.shipmentCode}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {s.originCity}
                  </td>
                  <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {s.destCity}
                  </td>
                  <td>{s.weightKg.toLocaleString()} kg</td>
                  <td>{s.volumeM3} m³</td>
                  <td>
                    <span className={`badge ${priorityBadge[s.priority]}`}>
                      {s.priority}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: "13px" }}>
                      {cargoIcons[s.cargoType]}
                    </span>
                    <span
                      style={{
                        marginLeft: "6px",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {s.cargoType}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge[s.status]}`}>
                      {s.status.replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ width: "28px", height: "28px" }}
                    >
                      <MoreVertical size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "14px",
            fontSize: "13px",
            color: "var(--text-secondary)",
          }}
        >
          <span>
            Showing {(currentPage - 1) * perPage + 1}–
            {Math.min(currentPage * perPage, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              className="btn btn-sm btn-secondary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </button>
            {Array.from(
              { length: Math.min(totalPages, 5) },
              (_, i) => i + 1,
            ).map((p) => (
              <button
                key={p}
                className={`btn btn-sm ${p === currentPage ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            ))}
            {totalPages > 5 && <span style={{ padding: "4px 8px" }}>...</span>}
            <button
              className="btn btn-sm btn-secondary"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>

        {/* ── Upload CSV Modal ── */}
        {showUploadModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(10,37,64,0.55)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
            onClick={() => setShowUploadModal(false)}
          >
            <div
              className="card animate-slide-up"
              style={{ width: "540px", maxWidth: "90vw" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header">
                <div>
                  <div className="card-title">Upload Shipments CSV</div>
                  <div className="card-description">
                    Import multiple shipments at once
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setShowUploadModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="card-body">
                <label
                  className="upload-zone"
                  style={{ cursor: "pointer", position: "relative" }}
                >
                  <input
                    type="file"
                    accept=".csv"
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setCsvFile(f);
                    }}
                  />
                  <div className="upload-zone-icon">
                    <FileSpreadsheet
                      size={26}
                      style={{ color: "var(--lorri-primary)" }}
                    />
                  </div>
                  {csvFile ? (
                    <>
                      <p style={{ fontSize: "15px", fontWeight: 650, color: "var(--text-primary)", marginBottom: "6px" }}>
                        {csvFile.name}
                      </p>
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
                        {(csvFile.size / 1024).toFixed(1)} KB · Click to change file
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: "15px", fontWeight: 650, color: "var(--text-primary)", marginBottom: "6px" }}>
                        Drop your CSV file here
                      </p>
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
                        or click to browse files
                      </p>
                    </>
                  )}
                </label>
                <div style={{ display: "flex", justifyContent: "center", marginTop: "14px" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      downloadCSVTemplate();
                    }}
                  >
                    <Download size={13} /> Download Template
                  </button>
                </div>
                <div
                  className="alert-banner alert-info"
                  style={{ marginTop: "14px" }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "12px" }}>
                    Required columns: shipment_id, origin_city, dest_city,
                    weight_kg, volume_m3, priority, cargo_type
                  </span>
                </div>
              </div>
              <div
                className="card-footer"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={() => { setShowUploadModal(false); setCsvFile(null); }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!csvFile || isUploading}
                  onClick={handleCsvUpload}
                >
                  {isUploading ? (
                    <><div className="loading-spinner" style={{ width: "14px", height: "14px" }} /> Uploading...</>
                  ) : (
                    <><Upload size={14} /> Upload</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add Shipment Modal ── */}
        {showAddModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(10,37,64,0.55)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="card animate-slide-up"
              style={{
                width: "640px",
                maxWidth: "90vw",
                maxHeight: "88vh",
                overflowY: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header">
                <div>
                  <div className="card-title">Add New Shipment</div>
                  <div className="card-description">
                    Manually create a shipment record
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setShowAddModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="card-body">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label className="label">Origin City</label>
                    <input className="input" type="text" placeholder="e.g. Delhi" value={newShipment.origin_city} onChange={(e) => setNewShipment((p) => ({ ...p, origin_city: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Destination City</label>
                    <input className="input" type="text" placeholder="e.g. Mumbai" value={newShipment.dest_city} onChange={(e) => setNewShipment((p) => ({ ...p, dest_city: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Weight (kg)</label>
                    <input className="input" type="number" placeholder="0" value={newShipment.weight_kg} onChange={(e) => setNewShipment((p) => ({ ...p, weight_kg: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="label">Volume (m³)</label>
                    <input className="input" type="number" placeholder="0" value={newShipment.volume_m3} onChange={(e) => setNewShipment((p) => ({ ...p, volume_m3: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="label">Length (cm)</label>
                    <input className="input" type="number" placeholder="0" value={newShipment.length_cm} onChange={(e) => setNewShipment((p) => ({ ...p, length_cm: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="label">Width (cm)</label>
                    <input className="input" type="number" placeholder="0" value={newShipment.width_cm} onChange={(e) => setNewShipment((p) => ({ ...p, width_cm: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="label">Height (cm)</label>
                    <input className="input" type="number" placeholder="0" value={newShipment.height_cm} onChange={(e) => setNewShipment((p) => ({ ...p, height_cm: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <select className="input" value={newShipment.priority} onChange={(e) => setNewShipment((p) => ({ ...p, priority: e.target.value }))}>
                      <option value="normal">Normal</option>
                      <option value="express">Express</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Cargo Type</label>
                    <select className="input" value={newShipment.cargo_type} onChange={(e) => setNewShipment((p) => ({ ...p, cargo_type: e.target.value }))}>
                      <option value="general">📦 General</option>
                      <option value="fragile">⚡ Fragile</option>
                      <option value="refrigerated">❄️ Refrigerated</option>
                      <option value="hazardous">☢️ Hazardous</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Delivery Window</label>
                    <select className="input" value={newShipment.delivery_window} onChange={(e) => setNewShipment((p) => ({ ...p, delivery_window: e.target.value }))}>
                      <option value="same">Same Day</option>
                      <option value="next">Next Day</option>
                      <option value="two">2-Day</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label">Special Instructions</label>
                    <textarea
                      className="input textarea"
                      placeholder="Any special handling requirements..."
                      rows={3}
                      value={newShipment.special_instructions}
                      onChange={(e) => setNewShipment((p) => ({ ...p, special_instructions: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div
                className="card-footer"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleCreateShipment} disabled={isCreating}>
                  {isCreating ? (
                    <><div className="loading-spinner" style={{ width: "14px", height: "14px" }} /> Creating...</>
                  ) : (
                    <><Plus size={14} /> Create Shipment</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            padding: "14px 20px",
            borderRadius: "10px",
            background: toast.type === "success" ? "#0CAF60" : "#DF1B41",
            color: "white",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "slide-up 0.3s ease",
          }}
        >
          {toast.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}
    </>
  );
}
