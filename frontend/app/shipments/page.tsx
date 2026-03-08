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
  Zap,
  Info,
  Box,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { type Shipment } from "@/lib/mock-data";
import {
  getShipments,
  uploadShipmentsCSV,
  createShipment,
  updateShipment,
  getCities,
  downloadCSVTemplate,
  deleteShipment,
  getVehicles,
  progressShipmentStatus,
  previewCSV,
  aiFixCSVRows,
  insertBatchShipments,
} from "@/lib/api";

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
    refreshShipments();
  }, []);
  useEffect(() => {
    // Auto-progress statuses on load, then every 60s
    const tick = () =>
      progressShipmentStatus()
        .then(() => refreshShipments())
        .catch(() => {});
    tick();
    const iv = setInterval(tick, 60_000);
    return () => clearInterval(iv);
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
  const [isDeleting, setIsDeleting] = useState(false);
  // CSV Preview state
  const [uploadStep, setUploadStep] = useState<"upload" | "preview">("upload");
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewIssues, setPreviewIssues] = useState(0);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isAiFixing, setIsAiFixing] = useState(false);
  const [aiFixMsg, setAiFixMsg] = useState<string | null>(null);
  const [isInserting, setIsInserting] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [essentialMissing, setEssentialMissing] = useState(0);
  const previewPerPage = 10;
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
    pickup_date: new Date().toISOString().slice(0, 10),
    pickup_time: "09:00",
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_time: "18:00",
  });
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [cities, setCities] = useState<
    Array<{ name: string; lat: number; lng: number }>
  >([]);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    origin_city: "",
    dest_city: "",
    weight_kg: 0,
    volume_m3: 0,
    length_cm: 0,
    width_cm: 0,
    height_cm: 0,
    priority: "normal",
    cargo_type: "general",
    delivery_date: "",
    delivery_time: "",
  });
  const perPage = 15;
  const [maxTruckCapacity, setMaxTruckCapacity] = useState(0);

  useEffect(() => {
    getVehicles()
      .then((data) => {
        if (data?.length) {
          const maxW = Math.max(...data.map((v: any) => v.max_weight_kg || 0));
          setMaxTruckCapacity(maxW);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getCities()
      .then((data) => {
        if (data?.length) {
          setCities(
            data.map((c: any) => ({ name: c.name, lat: c.lat, lng: c.lng })),
          );
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshShipments = async () => {
    try {
      const data = await getShipments();
      if (data && Array.isArray(data)) {
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
        // No data from API - set empty array (not mock data)
        setShipments([]);
      }
    } catch (err) {
      console.error("Failed to fetch shipments:", err);
      // On error, keep empty array - don't show mock data
      setShipments([]);
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    setIsPreviewLoading(true);
    setUploadMsg(null);
    setAiFixMsg(null);
    try {
      const result = await previewCSV(csvFile);
      setPreviewRows(result.rows || []);
      setPreviewTotal(result.total || 0);
      setPreviewIssues(result.total_issues || 0);
      setEssentialMissing(result.essential_missing || 0);
      setPreviewPage(1);
      setUploadStep("preview");
    } catch (err: any) {
      const msg =
        err?.message || "Failed to parse CSV. Check the file format.";
      showToast(msg, "error");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleAiFix = async () => {
    if (!previewRows.length) return;
    setIsAiFixing(true);
    setAiFixMsg(null);
    try {
      const result = await aiFixCSVRows(previewRows);
      setPreviewRows(result.rows || previewRows);
      const fixedCount = result.fixed_count || 0;
      const newIssues = (result.rows || []).reduce(
        (sum: number, r: any) => sum + (r._issues?.length || 0),
        0,
      );
      const newEssential = (result.rows || []).reduce(
        (sum: number, r: any) => sum + (r._essential_issues?.length || 0),
        0,
      );
      setPreviewIssues(newIssues);
      setEssentialMissing(newEssential);
      setAiFixMsg(
        fixedCount > 0
          ? `AI fixed ${fixedCount} values successfully!`
          : "No fixable issues found.",
      );
      showToast(
        fixedCount > 0
          ? `AI fixed ${fixedCount} missing values`
          : "All values look good!",
      );
    } catch (err: any) {
      const msg = err?.message || "AI fix failed. You can still edit manually.";
      showToast(msg, "error");
      setAiFixMsg(msg);
    } finally {
      setIsAiFixing(false);
    }
  };

  const handlePreviewCellEdit = (
    rowIndex: number,
    field: string,
    value: string,
  ) => {
    setPreviewRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      const numericFields = [
        "weight_kg",
        "volume_m3",
        "length_cm",
        "width_cm",
        "height_cm",
        "origin_lat",
        "origin_lng",
        "dest_lat",
        "dest_lng",
      ];
      if (numericFields.includes(field)) {
        row[field] = value ? parseFloat(value) || null : null;
      } else {
        row[field] = value;
      }
      // Recompute volume if dimensions changed
      if (["length_cm", "width_cm", "height_cm"].includes(field)) {
        const l = parseFloat(row.length_cm) || 0;
        const w = parseFloat(row.width_cm) || 0;
        const h = parseFloat(row.height_cm) || 0;
        if (l > 0 && w > 0 && h > 0) {
          row.volume_m3 = parseFloat(((l * w * h) / 1000000).toFixed(3));
        }
      }
      // Re-validate
      const issues: string[] = [];
      const essentialIss: string[] = [];
      if (!row.origin_city) { issues.push("origin_city"); essentialIss.push("origin_city"); }
      if (!row.dest_city) { issues.push("dest_city"); essentialIss.push("dest_city"); }
      if (!row.weight_kg || row.weight_kg <= 0) { issues.push("weight_kg"); essentialIss.push("weight_kg"); }
      if (!row.length_cm || row.length_cm <= 0) issues.push("length_cm");
      if (!row.width_cm || row.width_cm <= 0) issues.push("width_cm");
      if (!row.height_cm || row.height_cm <= 0) issues.push("height_cm");
      if (!["normal", "express", "critical"].includes(row.priority))
        issues.push("priority");
      if (
        !["general", "fragile", "refrigerated", "hazardous"].includes(
          row.cargo_type,
        )
      )
        issues.push("cargo_type");
      if (!row.delivery_start) issues.push("delivery_start");
      if (!row.delivery_end) issues.push("delivery_end");
      row._issues = issues;
      row._essential_issues = essentialIss;
      updated[rowIndex] = row;
      // Update global counts
      const totalIssues = updated.reduce(
        (s, r) => s + (r._issues?.length || 0),
        0,
      );
      const totalEssential = updated.reduce(
        (s, r) => s + (r._essential_issues?.length || 0),
        0,
      );
      setPreviewIssues(totalIssues);
      setEssentialMissing(totalEssential);
      return updated;
    });
  };

  const handleInsertPreviewedShipments = async () => {
    if (!previewRows.length) return;
    setIsInserting(true);
    try {
      const result = await insertBatchShipments(previewRows);
      const inserted = result?.inserted ?? 0;
      const skipped = result?.skipped ?? 0;
      let message = `Successfully imported ${inserted} shipments`;
      if (skipped > 0) {
        message += ` (${skipped} duplicates skipped)`;
      }
      showToast(message);
      setShowUploadModal(false);
      setCsvFile(null);
      setUploadStep("upload");
      setPreviewRows([]);
      refreshShipments();
    } catch (err: any) {
      showToast(err?.message || "Failed to insert shipments.", "error");
    } finally {
      setIsInserting(false);
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
        return cities.find(
          (c) =>
            c.name.toLowerCase() === lowerName ||
            c.name.toLowerCase().includes(lowerName) ||
            lowerName.includes(c.name.toLowerCase()),
        );
      };

      const originCity = findCity(newShipment.origin_city);
      const destCity = findCity(newShipment.dest_city);

      // Build pickup/delivery timestamps from date+time inputs
      const pickupStr = `${newShipment.pickup_date}T${newShipment.pickup_time}:00`;
      const deliveryStr = `${newShipment.delivery_date}T${newShipment.delivery_time}:00`;
      const now = new Date(pickupStr);
      const deliveryEnd = new Date(deliveryStr);

      const shipmentData: any = {
        origin_city: newShipment.origin_city.trim(),
        dest_city: newShipment.dest_city.trim(),
        weight_kg: newShipment.weight_kg || 100,
        volume_m3:
          newShipment.volume_m3 ||
          (newShipment.length_cm *
            newShipment.width_cm *
            newShipment.height_cm) /
            1000000 ||
          1,
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
        pickup_date: new Date().toISOString().slice(0, 10),
        pickup_time: "09:00",
        delivery_date: new Date().toISOString().slice(0, 10),
        delivery_time: "18:00",
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

  const openEditModal = (shipment: Shipment) => {
    setEditingShipment(shipment);
    const dEnd = shipment.deliveryWindowEnd
      ? new Date(shipment.deliveryWindowEnd)
      : null;
    setEditData({
      origin_city: shipment.originCity,
      dest_city: shipment.destCity,
      weight_kg: shipment.weightKg,
      volume_m3: shipment.volumeM3,
      length_cm: shipment.lengthCm,
      width_cm: shipment.widthCm,
      height_cm: shipment.heightCm,
      priority: shipment.priority,
      cargo_type: shipment.cargoType,
      delivery_date: dEnd ? dEnd.toISOString().slice(0, 10) : "",
      delivery_time: dEnd ? dEnd.toTimeString().slice(0, 5) : "",
    });
    setShowEditModal(true);
  };

  const handleEditShipment = async () => {
    if (!editingShipment) return;
    setIsEditing(true);
    try {
      const payload: any = { ...editData };
      // Include delivery window update if date/time are set
      if (editData.delivery_date && editData.delivery_time) {
        payload.delivery_window_end = new Date(
          `${editData.delivery_date}T${editData.delivery_time}:00`,
        ).toISOString();
      }
      delete payload.delivery_date;
      delete payload.delivery_time;
      await updateShipment(editingShipment.id, payload);
      showToast("Shipment updated successfully!");
      setShowEditModal(false);
      setEditingShipment(null);
      refreshShipments();
    } catch (err: any) {
      showToast(err?.message || "Failed to update shipment.", "error");
    } finally {
      setIsEditing(false);
    }
  };

  // Compute volume from dimensions
  const computedVolume = (l: number, w: number, h: number) => {
    if (l > 0 && w > 0 && h > 0)
      return parseFloat(((l * w * h) / 1000000).toFixed(3));
    return 0;
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

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    // Confirm deletion
    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.size} shipment${selectedIds.size > 1 ? "s" : ""}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    const idsToDelete = Array.from(selectedIds);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      // Delete all selected shipments sequentially to ensure each deletion completes
      for (const id of idsToDelete) {
        try {
          const result = await deleteShipment(id);
          if (result?.status === "deleted" || result?.id === id) {
            successCount++;
            // Also remove from local state immediately for better UX
            setShipments((prev) => prev.filter((s) => s.id !== id));
          } else {
            errorCount++;
            errors.push(`Shipment ${id}: Unknown error`);
          }
        } catch (err: any) {
          errorCount++;
          const errorMsg = err?.message || `Failed to delete shipment ${id}`;
          errors.push(errorMsg);
          console.error(`Failed to delete shipment ${id}:`, err);
        }
      }

      if (successCount > 0) {
        // Refresh the shipments list from server to ensure consistency
        await refreshShipments();
        showToast(
          `Successfully deleted ${successCount} shipment${successCount > 1 ? "s" : ""}${errorCount > 0 ? ` (${errorCount} failed)` : ""}`,
          errorCount > 0 ? "error" : "success",
        );
        // Clear selection
        setSelectedIds(new Set());
      } else {
        showToast(`Failed to delete shipments. ${errors.join("; ")}`, "error");
      }
    } catch (err: any) {
      showToast(
        err?.message || "An error occurred while deleting shipments.",
        "error",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRevertToPending = async (shipment: Shipment) => {
    if (shipment.status !== "consolidated") return;
    try {
      await updateShipment(shipment.id, { status: "pending" });
      showToast(`${shipment.shipmentCode} reverted to pending`);
      refreshShipments();
    } catch (err: any) {
      showToast(err?.message || "Failed to revert shipment.", "error");
    }
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
          {pending > 0 && (
            <Link href="/consolidate">
              <button
                className="btn btn-lg"
                style={{
                  background: "linear-gradient(135deg, #635BFF, #8B5CF6)",
                  color: "white",
                  border: "none",
                  fontWeight: 700,
                  boxShadow: "0 4px 14px rgba(99,91,255,0.35)",
                }}
              >
                <Zap size={16} /> Run AI Engine <ArrowRight size={14} />
              </button>
            </Link>
          )}
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
              <button
                className="btn btn-sm btn-danger"
                onClick={handleDelete}
                disabled={isDeleting || selectedIds.size === 0}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={13} /> Delete
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ── Data Table ── */}
        <div className="table-responsive-wrapper animate-slide-up">
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
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ width: "28px", height: "28px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(s);
                        }}
                        title="Edit shipment"
                      >
                        <Edit size={13} />
                      </button>
                      {s.status === "consolidated" && (
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{
                            width: "28px",
                            height: "28px",
                            color: "#e5850b",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevertToPending(s);
                          }}
                          title="Revert to pending"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>
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

        {/* ── Upload CSV Modal (Multi-Step: Upload → Preview → Insert) ── */}
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
            onClick={() => {
              setShowUploadModal(false);
              setUploadStep("upload");
              setCsvFile(null);
              setPreviewRows([]);
              setAiFixMsg(null);
            }}
          >
            <div
              className="card animate-slide-up"
              style={{
                width: uploadStep === "preview" ? "95vw" : "540px",
                maxWidth: uploadStep === "preview" ? "1200px" : "90vw",
                maxHeight: "92vh",
                overflowY: "auto",
                transition: "width 0.3s ease",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header">
                <div>
                  <div className="card-title">
                    {uploadStep === "upload"
                      ? "Upload Shipments CSV"
                      : "Preview & Fix Shipments"}
                  </div>
                  <div className="card-description">
                    {uploadStep === "upload"
                      ? "Import multiple shipments at once"
                      : `${previewTotal} rows parsed · ${previewIssues} issues found`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {uploadStep === "preview" && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setUploadStep("upload");
                        setPreviewRows([]);
                        setAiFixMsg(null);
                        setCsvFile(null);
                      }}
                    >
                      <RotateCcw size={13} /> Back
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadStep("upload");
                      setCsvFile(null);
                      setPreviewRows([]);
                      setAiFixMsg(null);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Step 1: Upload File */}
              {uploadStep === "upload" && (
                <>
                  <div className="card-body">
                    <label
                      className="upload-zone"
                      style={{ cursor: "pointer", position: "relative" }}
                    >
                      <input
                        type="file"
                        accept=".csv"
                        style={{
                          position: "absolute",
                          inset: 0,
                          opacity: 0,
                          cursor: "pointer",
                        }}
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
                          <p
                            style={{
                              fontSize: "15px",
                              fontWeight: 650,
                              color: "var(--text-primary)",
                              marginBottom: "6px",
                            }}
                          >
                            {csvFile.name}
                          </p>
                          <p
                            style={{
                              fontSize: "13px",
                              color: "var(--text-secondary)",
                              marginBottom: "14px",
                            }}
                          >
                            {(csvFile.size / 1024).toFixed(1)} KB · Click to
                            change file
                          </p>
                        </>
                      ) : (
                        <>
                          <p
                            style={{
                              fontSize: "15px",
                              fontWeight: 650,
                              color: "var(--text-primary)",
                              marginBottom: "6px",
                            }}
                          >
                            Drop your CSV file here
                          </p>
                          <p
                            style={{
                              fontSize: "13px",
                              color: "var(--text-secondary)",
                              marginBottom: "14px",
                            }}
                          >
                            or click to browse files
                          </p>
                        </>
                      )}
                    </label>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        marginTop: "14px",
                      }}
                    >
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
                        weight_kg, length_cm, width_cm, height_cm, priority,
                        cargo_type, delivery_start, delivery_end. Coordinates
                        are auto-fetched.
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
                      onClick={() => {
                        setShowUploadModal(false);
                        setCsvFile(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={!csvFile || isPreviewLoading}
                      onClick={handleCsvUpload}
                    >
                      {isPreviewLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Parsing...
                        </>
                      ) : (
                        <>
                          <Upload size={14} /> Preview CSV
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Preview Table with AI Fix & Insert */}
              {uploadStep === "preview" && (
                <>
                  <div className="card-body" style={{ padding: "16px" }}>
                    {/* Status Bar */}
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        marginBottom: "14px",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "16px",
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            padding: "8px 14px",
                            background: "rgba(99,91,255,0.06)",
                            borderRadius: "8px",
                            border: "1px solid rgba(99,91,255,0.15)",
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        >
                          <Package
                            size={14}
                            style={{
                              display: "inline",
                              verticalAlign: "middle",
                              marginRight: "6px",
                              color: "var(--lorri-primary)",
                            }}
                          />
                          {previewTotal} rows
                        </div>
                        {previewIssues > 0 ? (
                          <div
                            style={{
                              padding: "8px 14px",
                              background: essentialMissing > 0 ? "rgba(223,27,65,0.08)" : "rgba(245,158,11,0.08)",
                              borderRadius: "8px",
                              border: essentialMissing > 0 ? "1px solid rgba(223,27,65,0.25)" : "1px solid rgba(245,158,11,0.25)",
                              fontSize: "13px",
                              fontWeight: 600,
                              color: essentialMissing > 0 ? "#DF1B41" : "#D97706",
                            }}
                          >
                            <AlertCircle
                              size={14}
                              style={{
                                display: "inline",
                                verticalAlign: "middle",
                                marginRight: "6px",
                              }}
                            />
                            {essentialMissing > 0
                              ? `${essentialMissing} essential + ${previewIssues - essentialMissing} optional missing`
                              : `${previewIssues} optional values missing`}
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: "8px 14px",
                              background: "rgba(12,175,96,0.08)",
                              borderRadius: "8px",
                              border: "1px solid rgba(12,175,96,0.25)",
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#0CAF60",
                            }}
                          >
                            <Check
                              size={14}
                              style={{
                                display: "inline",
                                verticalAlign: "middle",
                                marginRight: "6px",
                              }}
                            />
                            All values valid
                          </div>
                        )}
                      </div>
                      {previewIssues > 0 && (
                        <button
                          className="btn btn-sm"
                          style={{
                            background:
                              "linear-gradient(135deg, #635BFF, #8B5CF6)",
                            color: "white",
                            border: "none",
                            fontWeight: 700,
                            boxShadow: "0 2px 8px rgba(99,91,255,0.3)",
                          }}
                          disabled={isAiFixing}
                          onClick={handleAiFix}
                        >
                          {isAiFixing ? (
                            <>
                              <Loader2 size={13} className="animate-spin" /> AI
                              Fixing...
                            </>
                          ) : (
                            <>
                              <Zap size={13} /> AI Fix Missing Values
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {aiFixMsg && (
                      <div
                        className="alert-banner alert-info"
                        style={{ marginBottom: "12px" }}
                      >
                        <Zap size={14} style={{ flexShrink: 0, color: "#635BFF" }} />
                        <span style={{ fontSize: "12px" }}>{aiFixMsg}</span>
                      </div>
                    )}

                    {/* Legend */}
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        marginBottom: "10px",
                        padding: "8px 12px",
                        background: "rgba(99,91,255,0.03)",
                        borderRadius: "6px",
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Legend:</span>
                      <span><span style={{ color: "#DF1B41", fontWeight: 700 }}>*</span> = Required field</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ display: "inline-block", width: "12px", height: "12px", border: "1.5px solid #DF1B41", borderRadius: "2px", background: "rgba(223,27,65,0.08)" }}></span>
                        Essential missing (blocks insert)
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ display: "inline-block", width: "12px", height: "12px", border: "1.5px solid #D97706", borderRadius: "2px", background: "rgba(245,158,11,0.08)" }}></span>
                        Optional missing (defaults used)
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ display: "inline-block", width: "12px", height: "12px", border: "1px solid #e5e7eb", borderRadius: "2px", background: "white" }}></span>
                        Valid
                      </span>
                      <span style={{ marginLeft: "auto", fontStyle: "italic" }}>Click any cell to edit · Volume auto-calculates from L×W×H</span>
                    </div>

                    {/* Preview Data Table */}
                    <div
                      style={{
                        overflowX: "auto",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color, #e5e7eb)",
                      }}
                    >
                      <table
                        className="data-table"
                        style={{ fontSize: "12px", minWidth: "1100px" }}
                      >
                        <thead>
                          <tr>
                            <th style={{ width: "30px", textAlign: "center" }}>
                              #
                            </th>
                            {[
                              { key: "shipment_id", label: "ID", required: false },
                              { key: "origin_city", label: "Origin", required: true },
                              { key: "dest_city", label: "Destination", required: true },
                              { key: "weight_kg", label: "Weight (kg)", required: true },
                              { key: "length_cm", label: "L (cm)", required: true },
                              { key: "width_cm", label: "W (cm)", required: true },
                              { key: "height_cm", label: "H (cm)", required: true },
                              { key: "volume_m3", label: "Vol (m\u00B3)", required: false },
                              { key: "priority", label: "Priority", required: true },
                              { key: "cargo_type", label: "Cargo", required: true },
                              { key: "delivery_start", label: "Pickup", required: true },
                              { key: "delivery_end", label: "Delivery", required: true },
                            ].map((col) => (
                              <th key={col.key} style={{ whiteSpace: "nowrap" }}>
                                {col.label}
                                {col.required && (
                                  <span style={{ color: "#DF1B41", marginLeft: "2px", fontSize: "11px" }}>*</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows
                            .slice(
                              (previewPage - 1) * previewPerPage,
                              previewPage * previewPerPage,
                            )
                            .map((row, idx) => {
                              const globalIdx =
                                (previewPage - 1) * previewPerPage + idx;
                              const issues: string[] = row._issues || [];
                              return (
                                <tr
                                  key={globalIdx}
                                  style={
                                    issues.length > 0
                                      ? {
                                          background:
                                            "rgba(245,158,11,0.04)",
                                        }
                                      : {}
                                  }
                                >
                                  <td
                                    style={{
                                      textAlign: "center",
                                      color: "var(--text-tertiary)",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {row._row || globalIdx + 1}
                                  </td>
                                  {[
                                    "shipment_id",
                                    "origin_city",
                                    "dest_city",
                                    "weight_kg",
                                    "length_cm",
                                    "width_cm",
                                    "height_cm",
                                    "volume_m3",
                                    "priority",
                                    "cargo_type",
                                    "delivery_start",
                                    "delivery_end",
                                  ].map((field) => {
                                    const hasIssue = issues.includes(field);
                                    const isEssential = (row._essential_issues || []).includes(field);
                                    const val = row[field];
                                    const isSelect =
                                      field === "priority" ||
                                      field === "cargo_type";
                                    return (
                                      <td
                                        key={field}
                                        style={{
                                          padding: "2px 4px",
                                          background: isEssential
                                            ? "rgba(223,27,65,0.08)"
                                            : hasIssue
                                              ? "rgba(245,158,11,0.08)"
                                              : "transparent",
                                        }}
                                      >
                                        {isSelect ? (
                                          <select
                                            value={val || ""}
                                            onChange={(e) =>
                                              handlePreviewCellEdit(
                                                globalIdx,
                                                field,
                                                e.target.value,
                                              )
                                            }
                                            style={{
                                              width: "100%",
                                              padding: "4px 6px",
                                              fontSize: "12px",
                                              border: hasIssue
                                                ? isEssential
                                                  ? "1.5px solid #DF1B41"
                                                  : "1.5px solid #D97706"
                                                : "1px solid #e5e7eb",
                                              borderRadius: "4px",
                                              background: "white",
                                              outline: "none",
                                            }}
                                          >
                                            <option value="">--</option>
                                            {field === "priority" ? (
                                              <>
                                                <option value="normal">
                                                  normal
                                                </option>
                                                <option value="express">
                                                  express
                                                </option>
                                                <option value="critical">
                                                  critical
                                                </option>
                                              </>
                                            ) : (
                                              <>
                                                <option value="general">
                                                  general
                                                </option>
                                                <option value="fragile">
                                                  fragile
                                                </option>
                                                <option value="refrigerated">
                                                  refrigerated
                                                </option>
                                                <option value="hazardous">
                                                  hazardous
                                                </option>
                                              </>
                                            )}
                                          </select>
                                        ) : (
                                          <input
                                            type={
                                              [
                                                "weight_kg",
                                                "length_cm",
                                                "width_cm",
                                                "height_cm",
                                                "volume_m3",
                                              ].includes(field)
                                                ? "number"
                                                : "text"
                                            }
                                            value={
                                              val !== null && val !== undefined
                                                ? val
                                                : ""
                                            }
                                            onChange={(e) =>
                                              handlePreviewCellEdit(
                                                globalIdx,
                                                field,
                                                e.target.value,
                                              )
                                            }
                                            placeholder={
                                              isEssential ? "Required!" : hasIssue ? "Missing" : ""
                                            }
                                            style={{
                                              width: "100%",
                                              minWidth:
                                                field.includes("delivery")
                                                  ? "160px"
                                                  : field === "shipment_id"
                                                    ? "90px"
                                                    : "70px",
                                              padding: "4px 6px",
                                              fontSize: "12px",
                                              border: isEssential
                                                ? "1.5px solid #DF1B41"
                                                : hasIssue
                                                  ? "1.5px solid #D97706"
                                                  : "1px solid #e5e7eb",
                                              borderRadius: "4px",
                                              outline: "none",
                                              background: isEssential
                                                ? "rgba(223,27,65,0.04)"
                                                : hasIssue
                                                  ? "rgba(245,158,11,0.04)"
                                                  : "white",
                                            }}
                                          />
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {/* Preview Pagination */}
                    {previewTotal > previewPerPage && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: "12px",
                          fontSize: "12px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <span>
                          Showing{" "}
                          {(previewPage - 1) * previewPerPage + 1}–
                          {Math.min(
                            previewPage * previewPerPage,
                            previewTotal,
                          )}{" "}
                          of {previewTotal}
                        </span>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            disabled={previewPage === 1}
                            onClick={() =>
                              setPreviewPage((p) => Math.max(1, p - 1))
                            }
                          >
                            Prev
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            disabled={
                              previewPage >=
                              Math.ceil(previewTotal / previewPerPage)
                            }
                            onClick={() => setPreviewPage((p) => p + 1)}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className="card-footer"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {essentialMissing > 0 ? (
                        <span style={{ color: "#DF1B41" }}>
                          <AlertCircle
                            size={12}
                            style={{
                              display: "inline",
                              verticalAlign: "middle",
                              marginRight: "4px",
                            }}
                          />
                          {essentialMissing} essential fields missing (origin, destination, weight) — fix before inserting
                        </span>
                      ) : previewIssues > 0 ? (
                        <span style={{ color: "#D97706" }}>
                          <AlertCircle
                            size={12}
                            style={{
                              display: "inline",
                              verticalAlign: "middle",
                              marginRight: "4px",
                            }}
                          />
                          {previewIssues} optional values missing — defaults will be used. You can still insert.
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowUploadModal(false);
                          setUploadStep("upload");
                          setCsvFile(null);
                          setPreviewRows([]);
                          setAiFixMsg(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        disabled={isInserting || previewTotal === 0 || essentialMissing > 0}
                        onClick={handleInsertPreviewedShipments}
                        title={essentialMissing > 0 ? "Fix essential fields (origin, destination, weight) before inserting" : ""}
                      >
                        {isInserting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />{" "}
                            Inserting...
                          </>
                        ) : (
                          <>
                            <Check size={14} /> Insert {previewTotal} Shipments
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Add Shipment Modal (Enhanced) ── */}
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
                width: "760px",
                maxWidth: "94vw",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#ffffff",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header">
                <div>
                  <div className="card-title">Add New Shipment</div>
                  <div className="card-description">
                    Fill in the shipment details. Example values are shown as
                    placeholders.
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
                {/* Validation Warnings */}
                {(() => {
                  const warns: string[] = [];
                  if (!newShipment.origin_city)
                    warns.push("Origin city is required");
                  if (!newShipment.dest_city)
                    warns.push("Destination city is required");
                  if (newShipment.weight_kg <= 0)
                    warns.push("Weight must be greater than 0");
                  if (
                    newShipment.length_cm <= 0 ||
                    newShipment.width_cm <= 0 ||
                    newShipment.height_cm <= 0
                  )
                    warns.push(
                      "All dimensions (L×W×H) are needed for 3D packing",
                    );
                  if (
                    newShipment.origin_city &&
                    newShipment.dest_city &&
                    newShipment.origin_city.toLowerCase() ===
                      newShipment.dest_city.toLowerCase()
                  )
                    warns.push(
                      "Origin and destination cannot be the same city",
                    );
                  if (newShipment.weight_kg > 25000)
                    warns.push("Weight exceeds max truck capacity (25,000 kg)");
                  return warns.length > 0 ? (
                    <div
                      style={{
                        background: "rgba(245,158,11,0.08)",
                        border: "1px solid rgba(245,158,11,0.25)",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        marginBottom: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      {warns.map((w, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "12px",
                            color: "#D97706",
                          }}
                        >
                          <AlertCircle size={13} style={{ flexShrink: 0 }} />{" "}
                          {w}
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  {/* Route Section */}
                  <div>
                    <label className="label">
                      Origin City <span style={{ color: "#DF1B41" }}>*</span>
                    </label>
                    <input
                      className="input"
                      type="text"
                      placeholder="e.g. Delhi, Mumbai, Bangalore"
                      value={newShipment.origin_city}
                      onChange={(e) =>
                        setNewShipment((p) => ({
                          ...p,
                          origin_city: e.target.value,
                        }))
                      }
                      style={
                        !newShipment.origin_city
                          ? {}
                          : { borderColor: "var(--lorri-success)" }
                      }
                    />
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-tertiary)",
                        marginTop: "4px",
                      }}
                    >
                      Coordinates are auto-fetched from city name
                    </div>
                  </div>
                  <div>
                    <label className="label">
                      Destination City{" "}
                      <span style={{ color: "#DF1B41" }}>*</span>
                    </label>
                    <input
                      className="input"
                      type="text"
                      placeholder="e.g. Chennai, Hyderabad, Pune"
                      value={newShipment.dest_city}
                      onChange={(e) =>
                        setNewShipment((p) => ({
                          ...p,
                          dest_city: e.target.value,
                        }))
                      }
                      style={
                        !newShipment.dest_city
                          ? {}
                          : { borderColor: "var(--lorri-success)" }
                      }
                    />
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="label">
                      Weight (kg) <span style={{ color: "#DF1B41" }}>*</span>
                    </label>
                    <input
                      className="input"
                      type="number"
                      placeholder="e.g. 1200"
                      value={newShipment.weight_kg || ""}
                      onChange={(e) =>
                        setNewShipment((p) => ({
                          ...p,
                          weight_kg: parseFloat(e.target.value) || 0,
                        }))
                      }
                      style={
                        newShipment.weight_kg > 0
                          ? { borderColor: "var(--lorri-success)" }
                          : newShipment.weight_kg < 0
                            ? { borderColor: "#DF1B41" }
                            : {}
                      }
                    />
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-tertiary)",
                        marginTop: "4px",
                      }}
                    >
                      Typical: 50–5000 kg
                    </div>
                    {maxTruckCapacity > 0 &&
                      newShipment.weight_kg > maxTruckCapacity && (
                        <div
                          style={{
                            marginTop: "6px",
                            padding: "6px 10px",
                            background: "rgba(223,27,65,0.08)",
                            border: "1px solid rgba(223,27,65,0.25)",
                            borderRadius: "6px",
                            fontSize: "11px",
                            color: "#DF1B41",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <AlertCircle size={13} />
                          No truck available! Max capacity is{" "}
                          {maxTruckCapacity.toLocaleString()}kg. This item (
                          {newShipment.weight_kg.toLocaleString()}kg) cannot be
                          carried by any vehicle in your fleet.
                        </div>
                      )}
                  </div>

                  {/* Volume (auto-calculated) */}
                  <div>
                    <label className="label">Volume (m³)</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="Auto-calculated from dimensions"
                      value={
                        newShipment.volume_m3 ||
                        computedVolume(
                          newShipment.length_cm,
                          newShipment.width_cm,
                          newShipment.height_cm,
                        ) ||
                        ""
                      }
                      onChange={(e) =>
                        setNewShipment((p) => ({
                          ...p,
                          volume_m3: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-tertiary)",
                        marginTop: "4px",
                      }}
                    >
                      Auto-calculated if dimensions are provided
                    </div>
                  </div>
                </div>

                {/* Dimensions Section - Prominent Visual */}
                <div
                  style={{
                    marginTop: "20px",
                    padding: "20px",
                    background:
                      "linear-gradient(135deg, rgba(99,91,255,0.04), rgba(139,92,246,0.06))",
                    borderRadius: "12px",
                    border: "1px solid rgba(99,91,255,0.15)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "var(--lorri-primary-light)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Box
                        size={16}
                        style={{ color: "var(--lorri-primary)" }}
                      />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        Package Dimensions
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Required for 3D bin packing visualization
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "14px",
                    }}
                  >
                    <div>
                      <label
                        className="label"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        📏 Length (cm)
                      </label>
                      <input
                        className="input"
                        type="number"
                        placeholder="e.g. 200"
                        value={newShipment.length_cm || ""}
                        onChange={(e) =>
                          setNewShipment((p) => ({
                            ...p,
                            length_cm: parseFloat(e.target.value) || 0,
                          }))
                        }
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          textAlign: "center",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-tertiary)",
                          marginTop: "4px",
                          textAlign: "center",
                        }}
                      >
                        50–300 cm typical
                      </div>
                    </div>
                    <div>
                      <label
                        className="label"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        📐 Width (cm)
                      </label>
                      <input
                        className="input"
                        type="number"
                        placeholder="e.g. 150"
                        value={newShipment.width_cm || ""}
                        onChange={(e) =>
                          setNewShipment((p) => ({
                            ...p,
                            width_cm: parseFloat(e.target.value) || 0,
                          }))
                        }
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          textAlign: "center",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-tertiary)",
                          marginTop: "4px",
                          textAlign: "center",
                        }}
                      >
                        40–200 cm typical
                      </div>
                    </div>
                    <div>
                      <label
                        className="label"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        📦 Height (cm)
                      </label>
                      <input
                        className="input"
                        type="number"
                        placeholder="e.g. 120"
                        value={newShipment.height_cm || ""}
                        onChange={(e) =>
                          setNewShipment((p) => ({
                            ...p,
                            height_cm: parseFloat(e.target.value) || 0,
                          }))
                        }
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          textAlign: "center",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-tertiary)",
                          marginTop: "4px",
                          textAlign: "center",
                        }}
                      >
                        30–200 cm typical
                      </div>
                    </div>
                  </div>

                  {/* Visual 3D dimension preview */}
                  {newShipment.length_cm > 0 &&
                    newShipment.width_cm > 0 &&
                    newShipment.height_cm > 0 &&
                    (() => {
                      const maxDim = Math.max(
                        newShipment.length_cm,
                        newShipment.width_cm,
                        newShipment.height_cm,
                      );
                      const scale = 80 / maxDim;
                      const w = Math.max(20, newShipment.length_cm * scale);
                      const h = Math.max(20, newShipment.height_cm * scale);
                      const d = Math.max(
                        10,
                        newShipment.width_cm * scale * 0.5,
                      );
                      return (
                        <div
                          style={{
                            marginTop: "14px",
                            padding: "16px",
                            background: "rgba(255,255,255,0.6)",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "24px",
                          }}
                        >
                          {/* 3D CSS Box */}
                          <div style={{ perspective: "400px", flexShrink: 0 }}>
                            <div
                              style={{
                                width: w,
                                height: h,
                                transformStyle: "preserve-3d",
                                transform: "rotateX(-15deg) rotateY(-30deg)",
                                position: "relative",
                                animation: "spin3d 8s ease-in-out infinite",
                              }}
                            >
                              {/* Front */}
                              <div
                                style={{
                                  position: "absolute",
                                  width: w,
                                  height: h,
                                  background:
                                    "linear-gradient(135deg, rgba(99,91,255,0.25), rgba(99,91,255,0.15))",
                                  border: "1.5px solid rgba(99,91,255,0.5)",
                                  borderRadius: "2px",
                                  transform: `translateZ(${d / 2}px)`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "#635BFF",
                                }}
                              >
                                {newShipment.length_cm}×{newShipment.height_cm}
                              </div>
                              {/* Back */}
                              <div
                                style={{
                                  position: "absolute",
                                  width: w,
                                  height: h,
                                  background: "rgba(99,91,255,0.08)",
                                  border: "1.5px solid rgba(99,91,255,0.25)",
                                  borderRadius: "2px",
                                  transform: `translateZ(${-d / 2}px) rotateY(180deg)`,
                                }}
                              />
                              {/* Left */}
                              <div
                                style={{
                                  position: "absolute",
                                  width: d,
                                  height: h,
                                  background:
                                    "linear-gradient(135deg, rgba(99,91,255,0.20), rgba(99,91,255,0.10))",
                                  border: "1.5px solid rgba(99,91,255,0.35)",
                                  borderRadius: "2px",
                                  transform: `translateX(${-d / 2}px) rotateY(-90deg)`,
                                }}
                              />
                              {/* Right */}
                              <div
                                style={{
                                  position: "absolute",
                                  width: d,
                                  height: h,
                                  background: "rgba(99,91,255,0.12)",
                                  border: "1.5px solid rgba(99,91,255,0.3)",
                                  borderRadius: "2px",
                                  transform: `translateX(${w - d / 2}px) rotateY(90deg)`,
                                }}
                              />
                              {/* Top */}
                              <div
                                style={{
                                  position: "absolute",
                                  width: w,
                                  height: d,
                                  background:
                                    "linear-gradient(135deg, rgba(99,91,255,0.30), rgba(139,92,246,0.18))",
                                  border: "1.5px solid rgba(99,91,255,0.45)",
                                  borderRadius: "2px",
                                  transform: `translateY(${-d / 2}px) rotateX(90deg)`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "9px",
                                  fontWeight: 600,
                                  color: "#635BFF",
                                }}
                              >
                                {newShipment.width_cm}
                              </div>
                              {/* Bottom */}
                              <div
                                style={{
                                  position: "absolute",
                                  width: w,
                                  height: d,
                                  background: "rgba(99,91,255,0.06)",
                                  border: "1.5px solid rgba(99,91,255,0.2)",
                                  borderRadius: "2px",
                                  transform: `translateY(${h - d / 2}px) rotateX(-90deg)`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                color: "var(--text-primary)",
                                fontFamily: "monospace",
                              }}
                            >
                              {newShipment.length_cm} × {newShipment.width_cm} ×{" "}
                              {newShipment.height_cm} cm
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--text-secondary)",
                                marginTop: "4px",
                              }}
                            >
                              Volume:{" "}
                              <strong>
                                {computedVolume(
                                  newShipment.length_cm,
                                  newShipment.width_cm,
                                  newShipment.height_cm,
                                )}{" "}
                                m³
                              </strong>
                              <span
                                style={{
                                  marginLeft: "8px",
                                  color: "var(--lorri-primary)",
                                  fontWeight: 600,
                                }}
                              >
                                (
                                {(
                                  computedVolume(
                                    newShipment.length_cm,
                                    newShipment.width_cm,
                                    newShipment.height_cm,
                                  ) * 1000
                                ).toFixed(0)}{" "}
                                liters)
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "12px",
                                marginTop: "8px",
                                fontSize: "11px",
                                color: "var(--text-tertiary)",
                              }}
                            >
                              <span>L: {newShipment.length_cm}cm</span>
                              <span>W: {newShipment.width_cm}cm</span>
                              <span>H: {newShipment.height_cm}cm</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                </div>

                {/* Other Fields */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "16px",
                    marginTop: "16px",
                  }}
                >
                  <div>
                    <label className="label">Priority</label>
                    <select
                      className="input"
                      value={newShipment.priority}
                      onChange={(e) =>
                        setNewShipment((p) => ({
                          ...p,
                          priority: e.target.value,
                        }))
                      }
                    >
                      <option value="normal">🟢 Normal</option>
                      <option value="express">🟡 Express</option>
                      <option value="critical">🔴 Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Cargo Type</label>
                    <select
                      className="input"
                      value={newShipment.cargo_type}
                      onChange={(e) =>
                        setNewShipment((p) => ({
                          ...p,
                          cargo_type: e.target.value,
                        }))
                      }
                    >
                      <option value="general">📦 General</option>
                      <option value="fragile">⚡ Fragile</option>
                      <option value="refrigerated">❄️ Refrigerated</option>
                      <option value="hazardous">☢️ Hazardous</option>
                    </select>
                  </div>
                </div>

                {/* Schedule — Pickup & Delivery Date/Time */}
                <div
                  style={{
                    marginTop: "16px",
                    padding: "16px",
                    background: "rgba(14,165,233,0.04)",
                    borderRadius: "10px",
                    border: "1px solid rgba(14,165,233,0.12)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    🕐 Schedule
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <label className="label">Pickup Date</label>
                      <input
                        className="input"
                        type="date"
                        value={newShipment.pickup_date}
                        onChange={(e) =>
                          setNewShipment((p) => ({
                            ...p,
                            pickup_date: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Pickup Time</label>
                      <input
                        className="input"
                        type="time"
                        value={newShipment.pickup_time}
                        onChange={(e) =>
                          setNewShipment((p) => ({
                            ...p,
                            pickup_time: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Delivery Date</label>
                      <input
                        className="input"
                        type="date"
                        value={newShipment.delivery_date}
                        onChange={(e) =>
                          setNewShipment((p) => ({
                            ...p,
                            delivery_date: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Delivery Time</label>
                      <input
                        className="input"
                        type="time"
                        value={newShipment.delivery_time}
                        onChange={(e) =>
                          setNewShipment((p) => ({
                            ...p,
                            delivery_time: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  {newShipment.pickup_date &&
                    newShipment.delivery_date &&
                    new Date(
                      `${newShipment.delivery_date}T${newShipment.delivery_time}`,
                    ) <=
                      new Date(
                        `${newShipment.pickup_date}T${newShipment.pickup_time}`,
                      ) && (
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "12px",
                          color: "#ef4444",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <AlertCircle size={13} /> Delivery must be after pickup
                      </div>
                    )}
                </div>

                <div style={{ marginTop: "16px" }}>
                  <label className="label">Special Instructions</label>
                  <textarea
                    className="input textarea"
                    placeholder="e.g. Handle with care, keep dry, stack max 2 layers..."
                    rows={2}
                    value={newShipment.special_instructions}
                    onChange={(e) =>
                      setNewShipment((p) => ({
                        ...p,
                        special_instructions: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Sample Values Helper */}
                <div
                  style={{
                    marginTop: "14px",
                    padding: "10px 14px",
                    background: "rgba(14,165,233,0.06)",
                    borderRadius: "8px",
                    border: "1px solid rgba(14,165,233,0.15)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <Info size={13} style={{ color: "#0ea5e9" }} />
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#0ea5e9",
                      }}
                    >
                      Sample Values
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong>Small parcel:</strong> 50 kg, 80×60×40 cm
                    &nbsp;|&nbsp;
                    <strong>Pallet:</strong> 500 kg, 120×100×150 cm
                    &nbsp;|&nbsp;
                    <strong>Heavy machinery:</strong> 3000 kg, 250×180×200 cm
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
                <button
                  className="btn btn-primary"
                  onClick={handleCreateShipment}
                  disabled={
                    isCreating ||
                    !newShipment.origin_city ||
                    !newShipment.dest_city
                  }
                >
                  {isCreating ? (
                    <>
                      <div
                        className="loading-spinner"
                        style={{ width: "14px", height: "14px" }}
                      />{" "}
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Create Shipment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Shipment Modal ── */}
        {showEditModal && editingShipment && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(10,37,64,0.45)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
            onClick={() => setShowEditModal(false)}
          >
            <div
              className="card animate-slide-up"
              style={{
                width: "640px",
                maxWidth: "90vw",
                maxHeight: "88vh",
                overflowY: "auto",
                background: "#ffffff",
                boxShadow:
                  "0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)",
                border: "1px solid rgba(99,91,255,0.08)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="card-header"
                style={{ padding: "22px 24px 12px" }}
              >
                <div>
                  <div
                    className="card-title"
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#0a2540",
                    }}
                  >
                    Edit Shipment
                  </div>
                  <div
                    className="card-description"
                    style={{
                      fontSize: "13px",
                      color: "#425466",
                      marginTop: "4px",
                    }}
                  >
                    {editingShipment.shipmentCode} · {editingShipment.status}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setShowEditModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="card-body" style={{ padding: "20px 24px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label
                      className="label"
                      style={{
                        color: "#0a2540",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      Origin City
                    </label>
                    <input
                      className="input"
                      type="text"
                      value={editData.origin_city}
                      onChange={(e) =>
                        setEditData((p) => ({
                          ...p,
                          origin_city: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label
                      className="label"
                      style={{
                        color: "#0a2540",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      Destination City
                    </label>
                    <input
                      className="input"
                      type="text"
                      value={editData.dest_city}
                      onChange={(e) =>
                        setEditData((p) => ({
                          ...p,
                          dest_city: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label
                      className="label"
                      style={{
                        color: "#0a2540",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      Weight (kg)
                    </label>
                    <input
                      className="input"
                      type="number"
                      value={editData.weight_kg || ""}
                      onChange={(e) =>
                        setEditData((p) => ({
                          ...p,
                          weight_kg: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Volume (m³)</label>
                    <input
                      className="input"
                      type="number"
                      value={
                        editData.volume_m3 ||
                        computedVolume(
                          editData.length_cm,
                          editData.width_cm,
                          editData.height_cm,
                        ) ||
                        ""
                      }
                      onChange={(e) =>
                        setEditData((p) => ({
                          ...p,
                          volume_m3: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Dimension editor */}
                <div
                  style={{
                    marginTop: "20px",
                    padding: "18px",
                    background: "rgba(99,91,255,0.03)",
                    borderRadius: "12px",
                    border: "1px solid rgba(99,91,255,0.10)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 650,
                      color: "#0a2540",
                      marginBottom: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Box size={15} style={{ color: "var(--lorri-primary)" }} />{" "}
                    Package Dimensions
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <label
                        className="label"
                        style={{
                          color: "#0a2540",
                          fontWeight: 600,
                          fontSize: "13px",
                        }}
                      >
                        Length (cm)
                      </label>
                      <input
                        className="input"
                        type="number"
                        value={editData.length_cm || ""}
                        onChange={(e) =>
                          setEditData((p) => ({
                            ...p,
                            length_cm: parseFloat(e.target.value) || 0,
                          }))
                        }
                        style={{
                          textAlign: "center",
                          fontSize: "15px",
                          fontWeight: 600,
                        }}
                      />
                    </div>
                    <div>
                      <label
                        className="label"
                        style={{
                          color: "#0a2540",
                          fontWeight: 600,
                          fontSize: "13px",
                        }}
                      >
                        Width (cm)
                      </label>
                      <input
                        className="input"
                        type="number"
                        value={editData.width_cm || ""}
                        onChange={(e) =>
                          setEditData((p) => ({
                            ...p,
                            width_cm: parseFloat(e.target.value) || 0,
                          }))
                        }
                        style={{
                          textAlign: "center",
                          fontSize: "15px",
                          fontWeight: 600,
                        }}
                      />
                    </div>
                    <div>
                      <label
                        className="label"
                        style={{
                          color: "#0a2540",
                          fontWeight: 600,
                          fontSize: "13px",
                        }}
                      >
                        Height (cm)
                      </label>
                      <input
                        className="input"
                        type="number"
                        value={editData.height_cm || ""}
                        onChange={(e) =>
                          setEditData((p) => ({
                            ...p,
                            height_cm: parseFloat(e.target.value) || 0,
                          }))
                        }
                        style={{
                          textAlign: "center",
                          fontSize: "15px",
                          fontWeight: 600,
                        }}
                      />
                    </div>
                  </div>
                  {editData.length_cm > 0 &&
                    editData.width_cm > 0 &&
                    editData.height_cm > 0 && (
                      <div
                        style={{
                          marginTop: "10px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--lorri-primary)",
                          fontFamily: "monospace",
                          textAlign: "center",
                        }}
                      >
                        {editData.length_cm} × {editData.width_cm} ×{" "}
                        {editData.height_cm} cm ={" "}
                        {computedVolume(
                          editData.length_cm,
                          editData.width_cm,
                          editData.height_cm,
                        )}{" "}
                        m³
                      </div>
                    )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginTop: "20px",
                  }}
                >
                  <div>
                    <label
                      className="label"
                      style={{
                        color: "#0a2540",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      Priority
                    </label>
                    <select
                      className="input"
                      value={editData.priority}
                      onChange={(e) =>
                        setEditData((p) => ({ ...p, priority: e.target.value }))
                      }
                    >
                      <option value="normal">🟢 Normal</option>
                      <option value="express">🟡 Express</option>
                      <option value="critical">🔴 Critical</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className="label"
                      style={{
                        color: "#0a2540",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      Cargo Type
                    </label>
                    <select
                      className="input"
                      value={editData.cargo_type}
                      onChange={(e) =>
                        setEditData((p) => ({
                          ...p,
                          cargo_type: e.target.value,
                        }))
                      }
                    >
                      <option value="general">📦 General</option>
                      <option value="fragile">⚡ Fragile</option>
                      <option value="refrigerated">❄️ Refrigerated</option>
                      <option value="hazardous">☢️ Hazardous</option>
                    </select>
                  </div>
                </div>

                {/* Delivery Time Edit — only for pending shipments */}
                {editingShipment?.status === "pending" && (
                  <div
                    style={{
                      marginTop: "20px",
                      padding: "18px",
                      background: "rgba(14,165,233,0.03)",
                      borderRadius: "12px",
                      border: "1px solid rgba(14,165,233,0.10)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 650,
                        color: "#0a2540",
                        marginBottom: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      🕐 Delivery Schedule
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <label
                          className="label"
                          style={{
                            color: "#0a2540",
                            fontWeight: 600,
                            fontSize: "13px",
                          }}
                        >
                          Delivery Date
                        </label>
                        <input
                          className="input"
                          type="date"
                          value={editData.delivery_date}
                          onChange={(e) =>
                            setEditData((p) => ({
                              ...p,
                              delivery_date: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label
                          className="label"
                          style={{
                            color: "#0a2540",
                            fontWeight: 600,
                            fontSize: "13px",
                          }}
                        >
                          Delivery Time
                        </label>
                        <input
                          className="input"
                          type="time"
                          value={editData.delivery_time}
                          onChange={(e) =>
                            setEditData((p) => ({
                              ...p,
                              delivery_time: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
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
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleEditShipment}
                  disabled={isEditing}
                >
                  {isEditing ? (
                    <>
                      <div
                        className="loading-spinner"
                        style={{ width: "14px", height: "14px" }}
                      />{" "}
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Save Changes
                    </>
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
          {toast.type === "success" ? (
            <Check size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {toast.message}
        </div>
      )}
    </>
  );
}
