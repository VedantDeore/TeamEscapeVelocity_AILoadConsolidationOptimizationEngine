"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  RotateCcw,
  Play,
  Pause,
  Truck,
  Plus,
  Trash2,
  Crosshair,
  Cpu,
  Printer,
  Copy,
  X,
  Download,
  Upload,
  Shuffle,
  Camera,
  Zap,
  Search,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Flame,
  Move3D,
  ListOrdered,
  Grid3X3,
  Ruler,
  Settings,
} from "lucide-react";
import {
  getShipments,
  getVehicles,
  getLatestPlan,
  clientSidePack,
  type ClientPackingItem,
  type ClientContainer,
} from "@/lib/api";
import type {
  PackingResultData,
  PackingStep,
  ViewPreset,
} from "@/components/packing-3d/PackingVisualizer3D";

const PackingVisualizer3D = dynamic(
  () => import("@/components/packing-3d/PackingVisualizer3D"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          background: "#f5f7fa",
          borderRadius: 12,
        }}
      >
        <Cpu className="animate-spin" size={24} style={{ color: "#94a3b8" }} />
      </div>
    ),
  },
);

/* ═══════════════════════════════════════════════════════════════════════
   Constants & helpers
   ═══════════════════════════════════════════════════════════════════════ */
const COLORS = [
  "#635BFF",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#eab308",
  "#3b82f6",
  "#e11d48",
];

const VIEW_LABELS: { key: ViewPreset; icon: string }[] = [
  { key: "perspective", icon: "⬡" },
  { key: "front", icon: "▣" },
  { key: "back", icon: "▤" },
  { key: "left", icon: "◧" },
  { key: "right", icon: "◨" },
  { key: "top", icon: "⬒" },
  { key: "inside", icon: "◉" },
];

/* ── Cargo item model ─────────────────────────────────────────────── */
interface CargoItem {
  id: string;
  label: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  quantity: number;
  color: string;
  stackable: boolean;
  keepUpright: boolean;
  doNotRotate: boolean;
  cargoType: string;
  priority: string;
}

function seedInitialItems(): CargoItem[] {
  return [];
}

/* ── Build packing data ───────────────────────────────────────────── */
interface VehicleType {
  id: string;
  name: string;
  type?: string;
  widthCm: number;
  heightCm: number;
  lengthCm: number;
  maxWeightKg: number;
}

function buildFromItems(
  items: CargoItem[],
  vehicle: VehicleType,
): PackingResultData {
  const expanded: ClientPackingItem[] = [];
  for (const item of items) {
    for (let q = 0; q < item.quantity; q++) {
      expanded.push({
        id: item.quantity > 1 ? `${item.id}-q${q}` : item.id,
        label: item.quantity > 1 ? `${item.label} #${q + 1}` : item.label,
        width: item.widthCm,
        height: item.heightCm,
        depth: item.lengthCm,
        weight: item.weightKg,
        color: item.color,
        cargoType: item.cargoType,
        priority: item.priority,
        stackable: item.stackable,
        keepUpright: item.keepUpright,
        doNotRotate: item.doNotRotate,
      });
    }
  }

  const container: ClientContainer = {
    width: vehicle.widthCm,
    height: vehicle.heightCm,
    depth: vehicle.lengthCm,
    maxWeight: vehicle.maxWeightKg,
  };

  const t0 = performance.now();
  const result = clientSidePack(container, expanded);
  const compTime = performance.now() - t0;

  const totalWeight = result.placements.reduce((s, p) => s + p.weight, 0);
  const totalVolume = result.placements.reduce(
    (s, p) => s + p.orientedWidth * p.orientedHeight * p.orientedDepth,
    0,
  );
  const containerVolume = container.width * container.height * container.depth;

  let cogX = 0,
    cogY = 0,
    cogZ = 0;
  if (totalWeight > 0) {
    for (const p of result.placements) {
      cogX += (p.x + p.orientedWidth / 2) * p.weight;
      cogY += (p.y + p.orientedHeight / 2) * p.weight;
      cogZ += (p.z + p.orientedDepth / 2) * p.weight;
    }
    cogX /= totalWeight;
    cogY /= totalWeight;
    cogZ /= totalWeight;
  }

  return {
    container: {
      id: vehicle.id,
      name: vehicle.name,
      width: vehicle.widthCm,
      height: vehicle.heightCm,
      depth: vehicle.lengthCm,
      max_weight: vehicle.maxWeightKg,
      volume_m3: parseFloat((containerVolume / 1e6).toFixed(4)),
    },
    placements: result.placements.map((p) => ({
      item: {
        id: p.id,
        label: p.label,
        width: p.width,
        height: p.height,
        depth: p.depth,
        weight: p.weight,
        volume_m3: parseFloat(
          ((p.width * p.height * p.depth) / 1e6).toFixed(4),
        ),
        cargo_type: p.cargoType || "general",
        priority: p.priority || "normal",
        stackable: true,
        color: p.color,
      },
      position: { x: p.x, y: p.y, z: p.z },
      orientation: 0,
      oriented_width: p.orientedWidth,
      oriented_height: p.orientedHeight,
      oriented_depth: p.orientedDepth,
    })),
    unpacked_items: result.unpacked.map((u) => ({
      id: u.id,
      label: u.label,
      width: u.width,
      height: u.height,
      depth: u.depth,
      weight: u.weight,
      color: u.color,
    })),
    steps: result.steps as PackingStep[],
    metrics: {
      total_items: result.placements.length,
      unpacked_count: result.unpacked.length,
      volume_utilization_pct: parseFloat(result.utilization.toFixed(2)),
      weight_utilization_pct: parseFloat(
        ((totalWeight / container.maxWeight) * 100).toFixed(2),
      ),
      total_weight_kg: parseFloat(totalWeight.toFixed(2)),
      total_volume_m3: parseFloat((totalVolume / 1e6).toFixed(4)),
      center_of_gravity: {
        x: parseFloat(cogX.toFixed(2)),
        y: parseFloat(cogY.toFixed(2)),
        z: parseFloat(cogZ.toFixed(2)),
      },
      container_volume_m3: parseFloat((containerVolume / 1e6).toFixed(4)),
      algorithm: "EP · 6-Strategy",
      computation_time_ms: parseFloat(compTime.toFixed(1)),
    },
  };
}

/* ── Micro-components ─────────────────────────────────────────────── */
function UtilRing({
  pct,
  label,
  color = "#635BFF",
  size = 78,
}: {
  pct: number;
  label: string;
  color?: string;
  size?: number;
}) {
  const r = 36,
    C = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="#f0f3f7"
        strokeWidth="7"
      />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={`${(pct / 100) * C} ${C}`}
        strokeLinecap="round"
        style={{
          transform: "rotate(-90deg)",
          transformOrigin: "50% 50%",
          transition: "stroke-dasharray .6s ease",
        }}
      />
      <text
        x="50"
        y="46"
        textAnchor="middle"
        style={{ fontSize: 15, fontWeight: 700, fill: "#0a2540" }}
      >
        {pct.toFixed(1)}%
      </text>
      <text
        x="50"
        y="60"
        textAnchor="middle"
        style={
          {
            fontSize: 7,
            fill: "#8792a2",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          } as React.CSSProperties
        }
      >
        {label}
      </text>
    </svg>
  );
}

function Badge({
  label,
  title,
  active,
}: {
  label: string;
  title: string;
  active: boolean;
}) {
  if (!active) return null;
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        padding: "1px 5px",
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        background: "#fef3c7",
        color: "#92400e",
        marginLeft: 3,
      }}
    >
      {label}
    </span>
  );
}

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "7px 0",
        borderBottom: "1px solid #f0f3f7",
        fontSize: 11.5,
      }}
    >
      <span style={{ color: "#425466", fontWeight: 500 }}>{label}</span>
      <div
        onClick={onChange}
        style={{
          width: 34,
          height: 18,
          borderRadius: 9,
          background: value ? "#635BFF" : "#e3e8ee",
          cursor: "pointer",
          position: "relative",
          transition: "background .2s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: value ? 16 : 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,.15)",
            transition: "left .2s",
          }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════════ */
export default function PackingPage() {
  /* ── State: core ───────────────────────────────────────────────── */
  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [selectedVehicleIdx, setSelectedVehicleIdx] = useState(0);
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([]);
  const [packingData, setPackingData] = useState<PackingResultData | null>(
    null,
  );
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── State: view toggles ───────────────────────────────────────── */
  const [viewPreset, setViewPreset] = useState<ViewPreset>("perspective");
  const [showLabels, setShowLabels] = useState(true);
  const [showCOG, setShowCOG] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [explodedView, setExplodedView] = useState(false);
  const [showLoadingOrder, setShowLoadingOrder] = useState(false);
  const [wireframe, setWireframe] = useState(true);
  const [animSpeed, setAnimSpeed] = useState(400);

  /* ── State: UI ──────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<
    "items" | "container" | "report" | "weight" | "settings"
  >("items");
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [undoStack, setUndoStack] = useState<CargoItem[][]>([]);
  const [redoStack, setRedoStack] = useState<CargoItem[][]>([]);
  const screenshotRef = useRef<(() => string | null) | null>(null);
  const [clusters, setClusters] = useState<any[]>([]);
  const [selectedClusterIdx, setSelectedClusterIdx] = useState<number | null>(
    null,
  );

  const vehicle = vehicles[selectedVehicleIdx] || {
    id: "",
    name: "No Vehicle",
    widthCm: 0,
    heightCm: 0,
    lengthCm: 0,
    maxWeightKg: 0,
  };
  const [customDims, setCustomDims] = useState({
    lengthCm: vehicle.lengthCm,
    widthCm: vehicle.widthCm,
    heightCm: vehicle.heightCm,
    maxWeightKg: vehicle.maxWeightKg,
  });

  /* ── Fetch vehicles and shipments ───────────────────────────────── */
  useEffect(() => {
    getVehicles()
      .then((data) => {
        if (data?.length) {
          const mapped = data.map((v: any) => ({
            id: v.id,
            name: v.name,
            widthCm: v.width_cm,
            heightCm: v.height_cm,
            lengthCm: v.length_cm,
            maxWeightKg: v.max_weight_kg,
          }));
          setVehicles(mapped);
          if (mapped.length > 0) {
            setSelectedVehicleIdx(0);
            setCustomDims({
              lengthCm: mapped[0].lengthCm,
              widthCm: mapped[0].widthCm,
              heightCm: mapped[0].heightCm,
              maxWeightKg: mapped[0].maxWeightKg,
            });
          }
        }
      })
      .catch(() => {});

    getShipments({ limit: "12" })
      .then((data) => {
        if (data?.length) {
          const items = data.slice(0, 12).map((s: any, i: number) => ({
            id: s.id,
            label: s.shipment_code || `SHIP-${s.id}`,
            lengthCm: s.length_cm || 100,
            widthCm: s.width_cm || 80,
            heightCm: s.height_cm || 60,
            weightKg: s.weight_kg || 500,
            quantity: 1,
            color: COLORS[i % COLORS.length],
            stackable: true,
            keepUpright: s.cargo_type === "fragile",
            doNotRotate: false,
            cargoType: s.cargo_type || "general",
            priority: s.priority || "normal",
          }));
          setCargoItems(items);
        }
      })
      .catch(() => {});

    // Load clusters from latest consolidation plan
    getLatestPlan()
      .then((data) => {
        if (data?.clusters?.length) {
          setClusters(data.clusters);
        }
      })
      .catch(() => {});
  }, []);

  /* ── Undo / redo helpers ────────────────────────────────────────── */
  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-19), cargoItems]);
    setRedoStack([]);
  }, [cargoItems]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    setRedoStack((prev) => [...prev, cargoItems]);
    setCargoItems(undoStack[undoStack.length - 1]);
    setUndoStack((s) => s.slice(0, -1));
  }, [undoStack, cargoItems]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    setUndoStack((prev) => [...prev, cargoItems]);
    setCargoItems(redoStack[redoStack.length - 1]);
    setRedoStack((s) => s.slice(0, -1));
  }, [redoStack, cargoItems]);

  /* ── Vehicle change → update dims ───────────────────────────────── */
  useEffect(() => {
    if (vehicles[selectedVehicleIdx]) {
      const v = vehicles[selectedVehicleIdx];
      setCustomDims({
        lengthCm: v.lengthCm,
        widthCm: v.widthCm,
        heightCm: v.heightCm,
        maxWeightKg: v.maxWeightKg,
      });
    }
  }, [selectedVehicleIdx, vehicles]);

  /* ── Auto-calculate on items / vehicle change ───────────────────── */
  useEffect(() => {
    if (vehicles[selectedVehicleIdx] && cargoItems.length > 0) {
      const v = { ...vehicles[selectedVehicleIdx], ...customDims };
      const data = buildFromItems(cargoItems, v);
      setPackingData(data);
      setAnimationStep(data.placements.length);
      setIsAnimating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicleIdx, cargoItems, vehicles]);

  const handleRecalculate = useCallback(() => {
    if (vehicles[selectedVehicleIdx]) {
      const v = { ...vehicles[selectedVehicleIdx], ...customDims };
      const data = buildFromItems(cargoItems, v);
      setPackingData(data);
      setAnimationStep(data.placements.length);
      setIsAnimating(false);
    }
  }, [cargoItems, customDims, selectedVehicleIdx, vehicles]);

  /* ── Animate ────────────────────────────────────────────────────── */
  const handleAnimate = useCallback(() => {
    if (!packingData) return;
    if (isAnimating) {
      if (animRef.current) clearInterval(animRef.current);
      setIsAnimating(false);
      return;
    }
    setIsAnimating(true);
    setAnimationStep(0);
    let step = 0;
    animRef.current = setInterval(() => {
      step++;
      setAnimationStep(step);
      if (step >= packingData.placements.length) {
        if (animRef.current) clearInterval(animRef.current);
        setIsAnimating(false);
      }
    }, animSpeed);
  }, [packingData, isAnimating, animSpeed]);

  const handleShowAll = useCallback(() => {
    if (animRef.current) clearInterval(animRef.current);
    setIsAnimating(false);
    if (packingData) setAnimationStep(packingData.placements.length);
  }, [packingData]);

  /* ── Item CRUD ──────────────────────────────────────────────────── */
  const handleAddItem = useCallback(
    (item: Omit<CargoItem, "id" | "color">) => {
      pushUndo();
      const id = `custom-${Date.now()}`;
      const color = COLORS[cargoItems.length % COLORS.length];
      setCargoItems((prev) => [...prev, { ...item, id, color }]);
      setShowAddModal(false);
    },
    [cargoItems, pushUndo],
  );

  const handleDeleteItem = useCallback(
    (id: string) => {
      pushUndo();
      setCargoItems((prev) => prev.filter((i) => i.id !== id));
      if (selectedItem === id) setSelectedItem(null);
    },
    [selectedItem, pushUndo],
  );

  const handleDuplicateItem = useCallback(
    (id: string) => {
      pushUndo();
      const item = cargoItems.find((i) => i.id === id);
      if (!item) return;
      setCargoItems((prev) => [
        ...prev,
        {
          ...item,
          id: `${id}-cp${Date.now()}`,
          label: `${item.label} (copy)`,
          color: COLORS[prev.length % COLORS.length],
        },
      ]);
    },
    [cargoItems, pushUndo],
  );

  const handleToggleConstraint = useCallback(
    (id: string, field: "stackable" | "keepUpright" | "doNotRotate") => {
      pushUndo();
      setCargoItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, [field]: !i[field] } : i)),
      );
    },
    [pushUndo],
  );

  const handleQtyChange = useCallback((id: string, qty: number) => {
    setCargoItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, qty) } : i)),
    );
  }, []);

  /* ── Randomize ──────────────────────────────────────────────────── */
  const randCounter = useRef(100);
  const randomize = useCallback(() => {
    pushUndo();
    const n = 8 + Math.floor(Math.random() * 12);
    const items: CargoItem[] = [];
    for (let i = 0; i < n; i++) {
      randCounter.current++;
      items.push({
        id: `rand-${randCounter.current}`,
        label: `PKG-${String(randCounter.current).padStart(3, "0")}`,
        lengthCm: 50 + Math.floor(Math.random() * 200),
        widthCm: 40 + Math.floor(Math.random() * 150),
        heightCm: 30 + Math.floor(Math.random() * 150),
        weightKg: 50 + Math.floor(Math.random() * 800),
        quantity: 1,
        color: COLORS[i % COLORS.length],
        stackable: Math.random() > 0.3,
        keepUpright: Math.random() < 0.2,
        doNotRotate: Math.random() < 0.1,
        cargoType: ["general", "fragile", "refrigerated", "hazardous"][
          Math.floor(Math.random() * 4)
        ],
        priority: ["normal", "express", "critical"][
          Math.floor(Math.random() * 3)
        ],
      });
    }
    setCargoItems(items);
    setSelectedItem(null);
  }, [pushUndo]);

  /* ── Auto-select best vehicle ───────────────────────────────────── */
  const autoSelectBest = useCallback(() => {
    if (vehicles.length === 0) return;
    let bestIdx = 0,
      bestUtil = -1;
    for (let i = 0; i < vehicles.length; i++) {
      const data = buildFromItems(cargoItems, vehicles[i]);
      const allFit = data.unpacked_items.length === 0;
      const util = data.metrics.volume_utilization_pct;
      if (allFit && util > bestUtil) {
        bestUtil = util;
        bestIdx = i;
      }
    }
    if (bestUtil < 0) {
      let bestCap = 0;
      for (let i = 0; i < vehicles.length; i++) {
        const cap =
          vehicles[i].lengthCm * vehicles[i].widthCm * vehicles[i].heightCm;
        if (cap > bestCap) {
          bestCap = cap;
          bestIdx = i;
        }
      }
    }
    setSelectedVehicleIdx(bestIdx);
  }, [cargoItems, vehicles]);

  /* ── Export / Import JSON ───────────────────────────────────────── */
  const exportJSON = useCallback(() => {
    const json = JSON.stringify(cargoItems, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cargo-items.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [cargoItems]);

  const importJSON = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const items = JSON.parse(ev.target?.result as string);
          if (Array.isArray(items)) {
            pushUndo();
            setCargoItems(items);
          }
        } catch {
          /* ignore */
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [pushUndo]);

  /* ── Screenshot ─────────────────────────────────────────────────── */
  const takeScreenshot = useCallback(() => {
    const dataUrl = screenshotRef.current?.();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `packing-3d-${Date.now()}.png`;
    a.click();
  }, []);

  /* ── Keyboard shortcuts ─────────────────────────────────────────── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      switch (e.key.toLowerCase()) {
        case "r":
          setAutoRotate((a) => !a);
          break;
        case " ":
          e.preventDefault();
          handleAnimate();
          break;
        case "escape":
          setSelectedItem(null);
          break;
        case "l":
          setShowLabels((l) => !l);
          break;
        case "g":
          setShowGrid((g) => !g);
          break;
        case "h":
          setHeatmapMode((h) => !h);
          break;
        case "e":
          setExplodedView((v) => !v);
          break;
        case "z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            undo();
          }
          break;
        case "y":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            redo();
          }
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleAnimate, undo, redo]);

  /* ── Computed ────────────────────────────────────────────────────── */
  const m = packingData?.metrics;
  const step =
    isAnimating && packingData?.steps?.[animationStep - 1]
      ? packingData.steps[animationStep - 1]
      : null;
  const selectedPlacement = packingData?.placements.find(
    (p) => p.item.id === selectedItem,
  );

  const weightDist = useMemo(() => {
    if (!packingData || !m) return { front: 50, rear: 50 };
    const totalD = packingData.container.depth;
    const rearPct = totalD > 0 ? (m.center_of_gravity.z / totalD) * 100 : 50;
    return {
      front: parseFloat((100 - rearPct).toFixed(1)),
      rear: parseFloat(rearPct.toFixed(1)),
    };
  }, [packingData, m]);

  const freeVolM3 = (m?.container_volume_m3 || 0) - (m?.total_volume_m3 || 0);
  const remainingWt = customDims.maxWeightKg - (m?.total_weight_kg || 0);
  const utilColor = (pct: number) =>
    pct > 85 ? "#10b981" : pct > 60 ? "#f59e0b" : "#ef4444";

  const filteredItems = searchQuery
    ? cargoItems.filter(
        (i) =>
          i.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.cargoType.includes(searchQuery.toLowerCase()),
      )
    : cargoItems;

  const placedIds = useMemo(
    () => new Set(packingData?.placements.map((p) => p.item.id) || []),
    [packingData],
  );

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "#f8f9fc",
      }}
    >
      {/* ────── HEADER ────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid #e3e8ee",
          background: "#fff",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              background: "linear-gradient(135deg,#635BFF,#10b981)",
              borderRadius: 8,
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
            }}
          >
            📦
          </div>
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "#0a2540",
                letterSpacing: ".5px",
              }}
            >
              LORRI · 3D PACK SIM
            </div>
            <div
              style={{
                fontSize: 9,
                color: "#8792a2",
                letterSpacing: ".5px",
              }}
            >
              AI LOAD CONSOLIDATION ENGINE
            </div>
          </div>
        </div>

        {/* Truck pills */}
        <div style={{ display: "flex", gap: 4 }}>
          {vehicles.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setSelectedVehicleIdx(i)}
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 550,
                border: "1px solid",
                cursor: "pointer",
                transition: "all .15s",
                background: selectedVehicleIdx === i ? "#635BFF" : "#fff",
                color: selectedVehicleIdx === i ? "#fff" : "#425466",
                borderColor: selectedVehicleIdx === i ? "#635BFF" : "#e3e8ee",
              }}
            >
              <Truck size={10} style={{ marginRight: 3, verticalAlign: -1 }} />
              {v.name}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Btn
            onClick={() => setAutoRotate((a) => !a)}
            active={autoRotate}
            accent="#635BFF"
            label={autoRotate ? "⏸ AUTO" : "▶ AUTO"}
          />
          <Btn
            onClick={handleAnimate}
            active={isAnimating}
            accent="#f59e0b"
            label={isAnimating ? "⏳ LOADING..." : "▶ ANIMATE"}
          />
          <Btn onClick={handleShowAll} accent="#10b981" label="SHOW ALL" />
          <Btn onClick={handleRecalculate} accent="#0ea5e9" label="⚡ PACK" />
          <button
            onClick={takeScreenshot}
            title="Screenshot"
            style={iconBtnStyle}
          >
            <Camera size={13} />
          </button>
          <button
            onClick={() => window.print()}
            title="Print"
            style={iconBtnStyle}
          >
            <Printer size={13} />
          </button>
        </div>
      </div>

      {/* ────── MAIN ────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── 3D VIEWPORT ── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <PackingVisualizer3D
            data={packingData}
            isAnimating={isAnimating}
            animationStep={animationStep}
            onHoverItem={setHoveredItem}
            hoveredItem={hoveredItem}
            showLabels={showLabels}
            showCOG={showCOG}
            showGrid={showGrid}
            viewPreset={viewPreset}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            showDimensions={showDimensions}
            autoRotate={autoRotate}
            autoRotateSpeed={2}
            explodedView={explodedView}
            heatmapMode={heatmapMode}
            showLoadingOrder={showLoadingOrder}
            wireframe={wireframe}
            screenshotRef={screenshotRef}
          />

          {/* View presets overlay */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              display: "flex",
              flexDirection: "column",
              gap: 3,
              zIndex: 10,
            }}
          >
            {VIEW_LABELS.map((v) => (
              <button
                key={v.key}
                onClick={() => setViewPreset(v.key)}
                style={{
                  padding: "3px 8px",
                  borderRadius: 5,
                  fontSize: 9.5,
                  fontWeight: 600,
                  background:
                    viewPreset === v.key ? "#635BFF" : "rgba(255,255,255,.88)",
                  color: viewPreset === v.key ? "#fff" : "#425466",
                  border: `1px solid ${viewPreset === v.key ? "#635BFF" : "rgba(227,232,238,.6)"}`,
                  cursor: "pointer",
                  backdropFilter: "blur(4px)",
                  letterSpacing: ".5px",
                }}
              >
                <span style={{ marginRight: 3 }}>{v.icon}</span>
                {v.key.toUpperCase()}
              </button>
            ))}
            <button
              onClick={() => {
                setViewPreset("perspective");
                setAutoRotate(false);
              }}
              style={{
                padding: "3px 8px",
                borderRadius: 5,
                fontSize: 9.5,
                fontWeight: 600,
                marginTop: 2,
                background: "rgba(255,255,255,.88)",
                color: "#8792a2",
                border: "1px solid rgba(227,232,238,.6)",
                cursor: "pointer",
                backdropFilter: "blur(4px)",
                letterSpacing: ".5px",
              }}
            >
              ↺ RESET
            </button>
          </div>

          {/* Utilization overlay */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              background: "rgba(255,255,255,.92)",
              border: "1px solid #e3e8ee",
              borderRadius: 10,
              padding: "10px 14px",
              backdropFilter: "blur(8px)",
              minWidth: 190,
              zIndex: 10,
            }}
          >
            <div
              style={{
                fontSize: 8,
                letterSpacing: 2,
                color: "#8792a2",
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              UTILIZATION
            </div>
            {[
              {
                label: "VOLUME",
                value: m?.volume_utilization_pct || 0,
                suffix: "%",
              },
              {
                label: "WEIGHT",
                value: m?.weight_utilization_pct || 0,
                suffix: "%",
              },
              {
                label: "PLACED",
                value: m?.total_items || 0,
                suffix: `/${(m?.total_items || 0) + (m?.unpacked_count || 0)} pkgs`,
              },
            ].map((s) => (
              <div key={s.label} style={{ marginBottom: 5 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ color: "#8792a2" }}>{s.label}</span>
                  <span
                    style={{
                      color: utilColor(
                        typeof s.value === "number" ? s.value : 0,
                      ),
                      fontWeight: 700,
                    }}
                  >
                    {typeof s.value === "number" ? s.value.toFixed(1) : s.value}
                    {s.suffix}
                  </span>
                </div>
                {s.suffix === "%" && (
                  <div
                    style={{
                      height: 4,
                      background: "#f0f3f7",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(s.value as number, 100)}%`,
                        height: "100%",
                        background: utilColor(s.value as number),
                        borderRadius: 2,
                        transition: "width .5s ease",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Animation step overlay */}
          {isAnimating && step && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "rgba(255,255,255,.92)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12,
                color: "#0a2540",
                boxShadow: "0 4px 16px rgba(0,0,0,.10)",
                border: "1px solid #e3e8ee",
                maxWidth: 220,
                zIndex: 10,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: "#635BFF",
                  marginBottom: 4,
                }}
              >
                Step {step.step_number} / {step.total_items}
              </div>
              <div>
                Placing{" "}
                <span style={{ color: step.color, fontWeight: 600 }}>
                  {step.item_label}
                </span>
              </div>
              <div style={{ marginTop: 3, color: "#8792a2", fontSize: 11 }}>
                Util:{" "}
                <span style={{ color: "#10b981", fontWeight: 600 }}>
                  {step.utilization_pct.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Selected item overlay */}
          {selectedItem && selectedPlacement && !isAnimating && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "rgba(255,255,255,.95)",
                border: `1px solid ${selectedPlacement.item.color}44`,
                borderRadius: 10,
                padding: "12px 16px",
                backdropFilter: "blur(8px)",
                minWidth: 190,
                zIndex: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: selectedPlacement.item.color,
                  }}
                />
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#0a2540",
                  }}
                >
                  {selectedPlacement.item.label}
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#8792a2",
                    padding: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              {(
                [
                  [
                    "Dimensions",
                    `${selectedPlacement.oriented_width}×${selectedPlacement.oriented_height}×${selectedPlacement.oriented_depth} cm`,
                  ],
                  [
                    "Position",
                    `(${selectedPlacement.position.x.toFixed(0)}, ${selectedPlacement.position.y.toFixed(0)}, ${selectedPlacement.position.z.toFixed(0)})`,
                  ],
                  ["Weight", `${selectedPlacement.item.weight} kg`],
                  [
                    "Volume",
                    `${selectedPlacement.item.volume_m3.toFixed(4)} m³`,
                  ],
                  ["Type", selectedPlacement.item.cargo_type],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10.5,
                    marginBottom: 3,
                  }}
                >
                  <span style={{ color: "#8792a2" }}>{k}</span>
                  <span
                    style={{ fontWeight: 600, textTransform: "capitalize" }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Controls hint */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              fontSize: 9,
              color: "#8792a2",
              textAlign: "right",
              lineHeight: 1.8,
              letterSpacing: ".3px",
              zIndex: 10,
            }}
          >
            LEFT DRAG · ROTATE
            <br />
            RIGHT DRAG · PAN
            <br />
            SCROLL · ZOOM
            <br />
            CLICK · SELECT
            <br />
            R=Rotate · Space=Animate · E=Explode
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            borderLeft: "1px solid #e3e8ee",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #e3e8ee",
              flexShrink: 0,
            }}
          >
            {(
              ["items", "container", "report", "weight", "settings"] as const
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  fontSize: 9,
                  fontWeight: 650,
                  border: "none",
                  borderBottom: `2px solid ${activeTab === tab ? "#635BFF" : "transparent"}`,
                  cursor: "pointer",
                  color: activeTab === tab ? "#635BFF" : "#8792a2",
                  background: "none",
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                }}
              >
                {tab === "settings" ? "⚙" : tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {/* ────── ITEMS TAB ────── */}
            {activeTab === "items" && (
              <>
                {/* Cluster selector */}
                {clusters.length > 0 && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #f0f3f7",
                      background: "rgba(99,91,255,0.03)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#635BFF",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "6px",
                      }}
                    >
                      Load from Consolidation
                    </div>
                    <select
                      style={{
                        width: "100%",
                        fontSize: "11px",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #e3e8ee",
                        background: "#fff",
                        color: "#1a1f36",
                      }}
                      value={selectedClusterIdx ?? ""}
                      onChange={(e) => {
                        const idx =
                          e.target.value === ""
                            ? null
                            : parseInt(e.target.value);
                        setSelectedClusterIdx(idx);
                        if (idx !== null && clusters[idx]) {
                          const cluster = clusters[idx];
                          // Load shipment IDs from cluster and fetch their details
                          const shipmentIds = cluster.shipment_ids || [];
                          if (shipmentIds.length > 0) {
                            getShipments()
                              .then((allShipments: any[]) => {
                                if (!allShipments) return;
                                const clusterShipments = allShipments.filter(
                                  (s: any) => shipmentIds.includes(s.id),
                                );
                                const items = clusterShipments.map(
                                  (s: any, i: number) => ({
                                    id: s.id,
                                    label:
                                      s.shipment_code ||
                                      `SHIP-${s.id.substring(0, 6)}`,
                                    lengthCm: s.length_cm || 100,
                                    widthCm: s.width_cm || 80,
                                    heightCm: s.height_cm || 60,
                                    weightKg: s.weight_kg || 500,
                                    quantity: 1,
                                    color: COLORS[i % COLORS.length],
                                    stackable: true,
                                    keepUpright: s.cargo_type === "fragile",
                                    doNotRotate: false,
                                    cargoType: s.cargo_type || "general",
                                    priority: s.priority || "normal",
                                  }),
                                );
                                setCargoItems(items);
                                // Also try to match vehicle
                                if (cluster.vehicle_id) {
                                  const vIdx = vehicles.findIndex(
                                    (v) => v.id === cluster.vehicle_id,
                                  );
                                  if (vIdx >= 0) setSelectedVehicleIdx(vIdx);
                                }
                              })
                              .catch(() => {});
                          }
                        }
                      }}
                    >
                      <option value="">Select a cluster...</option>
                      {clusters.map((c: any, idx: number) => (
                        <option key={c.id} value={idx}>
                          Cluster {idx + 1} — {(c.shipment_ids || []).length}{" "}
                          shipments · {Math.round(c.utilization_pct || 0)}% util
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div
                  style={{
                    padding: "8px 12px",
                    display: "flex",
                    gap: 4,
                    flexWrap: "wrap",
                    borderBottom: "1px solid #f0f3f7",
                  }}
                >
                  <button
                    onClick={() => setShowAddModal(true)}
                    style={sideBtnStyle("#635BFF")}
                  >
                    <Plus size={10} /> ADD
                  </button>
                  <button onClick={randomize} style={sideBtnStyle("#0ea5e9")}>
                    <Shuffle size={10} /> RANDOM
                  </button>
                  <button onClick={importJSON} style={sideBtnStyle("#10b981")}>
                    <Upload size={10} /> IMPORT
                  </button>
                  <button onClick={exportJSON} style={sideBtnStyle("#f59e0b")}>
                    <Download size={10} /> EXPORT
                  </button>
                </div>
                <div
                  style={{
                    padding: "6px 12px",
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                    borderBottom: "1px solid #f0f3f7",
                  }}
                >
                  <Search size={12} style={{ color: "#8792a2" }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search items..."
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      fontSize: 11,
                      color: "#0a2540",
                      background: "transparent",
                    }}
                  />
                  <button
                    onClick={undo}
                    disabled={undoStack.length === 0}
                    title="Undo (Ctrl+Z)"
                    style={{
                      ...iconBtnStyle,
                      opacity: undoStack.length > 0 ? 1 : 0.3,
                    }}
                  >
                    <Undo2 size={11} />
                  </button>
                  <button
                    onClick={redo}
                    disabled={redoStack.length === 0}
                    title="Redo (Ctrl+Y)"
                    style={{
                      ...iconBtnStyle,
                      opacity: redoStack.length > 0 ? 1 : 0.3,
                    }}
                  >
                    <Redo2 size={11} />
                  </button>
                </div>

                {/* Unplaced warning */}
                {(packingData?.unpacked_items?.length || 0) > 0 && (
                  <div
                    style={{
                      margin: "6px 12px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 10,
                      color: "#dc2626",
                    }}
                  >
                    ⚠ {packingData!.unpacked_items.length} item
                    {packingData!.unpacked_items.length > 1 ? "s" : ""}{" "}
                    don&apos;t fit! Try a larger vehicle.
                  </div>
                )}

                {/* Item list */}
                <div>
                  {filteredItems.map((item) => {
                    const isPlaced = placedIds.has(item.id);
                    const isSel = selectedItem === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() =>
                          setSelectedItem((prev) =>
                            prev === item.id ? null : item.id,
                          )
                        }
                        onMouseEnter={() => setHoveredItem(item.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "7px 12px",
                          borderBottom: "1px solid #f5f7fa",
                          cursor: "pointer",
                          transition: "background .1s",
                          background: isSel
                            ? "#f0f3ff"
                            : hoveredItem === item.id
                              ? "#fafbfc"
                              : "transparent",
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: item.color,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            {item.label}
                            {item.quantity > 1 && (
                              <span
                                style={{
                                  color: "#635BFF",
                                  fontSize: 9,
                                  marginLeft: 3,
                                }}
                              >
                                ×{item.quantity}
                              </span>
                            )}
                            <Badge
                              label="NS"
                              title="Non-stackable"
                              active={!item.stackable}
                            />
                            <Badge
                              label="KU"
                              title="Keep upright"
                              active={item.keepUpright}
                            />
                            <Badge
                              label="NR"
                              title="No rotate"
                              active={item.doNotRotate}
                            />
                          </div>
                          <div style={{ fontSize: 9, color: "#8792a2" }}>
                            {item.lengthCm}×{item.widthCm}×{item.heightCm}cm ·{" "}
                            {item.weightKg}kg
                            {item.cargoType !== "general" &&
                              ` · ${item.cargoType}`}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            padding: "2px 5px",
                            borderRadius: 3,
                            background: isPlaced
                              ? "rgba(16,185,129,.12)"
                              : "rgba(239,68,68,.12)",
                            color: isPlaced ? "#10b981" : "#ef4444",
                            fontWeight: 700,
                          }}
                        >
                          {isPlaced ? "OK" : "NO FIT"}
                        </div>
                        <input
                          type="number"
                          value={item.quantity}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleQtyChange(item.id, +e.target.value)
                          }
                          min={1}
                          max={99}
                          style={{
                            width: 30,
                            padding: "1px 3px",
                            borderRadius: 4,
                            border: "1px solid #e3e8ee",
                            fontSize: 10,
                            textAlign: "center",
                            fontWeight: 600,
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateItem(item.id);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 1,
                            color: "#8792a2",
                          }}
                        >
                          <Copy size={10} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 1,
                            color: "#ef4444",
                          }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    );
                  })}
                  {cargoItems.length === 0 && (
                    <div
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#8792a2",
                        fontSize: 11,
                      }}
                    >
                      No items. Click ADD to start.
                    </div>
                  )}
                </div>

                {/* Quick constraints */}
                {selectedItem &&
                  cargoItems.find((i) => i.id === selectedItem) && (
                    <div
                      style={{
                        padding: "8px 12px",
                        borderTop: "1px solid #f0f3f7",
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          color: "#8792a2",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          width: "100%",
                          marginBottom: 2,
                        }}
                      >
                        Constraints
                      </span>
                      {(
                        ["stackable", "keepUpright", "doNotRotate"] as const
                      ).map((field) => {
                        const item = cargoItems.find(
                          (i) => i.id === selectedItem,
                        )!;
                        const labels = {
                          stackable: "Stackable",
                          keepUpright: "Keep Upright",
                          doNotRotate: "No Rotate",
                        };
                        const val =
                          field === "stackable" ? item.stackable : item[field];
                        return (
                          <button
                            key={field}
                            onClick={() =>
                              handleToggleConstraint(selectedItem, field)
                            }
                            style={{
                              padding: "3px 8px",
                              borderRadius: 5,
                              fontSize: 10,
                              fontWeight: 600,
                              border: "1px solid",
                              cursor: "pointer",
                              background: val ? "#ede9ff" : "#fff",
                              color: val ? "#635BFF" : "#8792a2",
                              borderColor: val ? "#c4b5fd" : "#e3e8ee",
                            }}
                          >
                            {labels[field]}
                          </button>
                        );
                      })}
                    </div>
                  )}
              </>
            )}

            {/* ────── CONTAINER TAB ────── */}
            {activeTab === "container" && (
              <div
                style={{
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "#0a2540" }}
                >
                  {vehicle.name}{" "}
                  {vehicle.type && (
                    <span style={{ color: "#8792a2", fontWeight: 400 }}>
                      ({vehicle.type})
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {(
                    [
                      { label: "Length (cm)", key: "lengthCm" as const },
                      { label: "Width (cm)", key: "widthCm" as const },
                      { label: "Height (cm)", key: "heightCm" as const },
                      {
                        label: "Max Weight (kg)",
                        key: "maxWeightKg" as const,
                      },
                    ] as const
                  ).map((f) => (
                    <div key={f.key}>
                      <label
                        style={{
                          fontSize: 9,
                          color: "#8792a2",
                          display: "block",
                          marginBottom: 2,
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        {f.label}
                      </label>
                      <input
                        type="number"
                        value={customDims[f.key]}
                        onChange={(e) =>
                          setCustomDims((prev) => ({
                            ...prev,
                            [f.key]: +e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #e3e8ee",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#0a2540",
                          background: "#fafbfc",
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    padding: 10,
                    background: "#f8f9fc",
                    borderRadius: 6,
                  }}
                >
                  {(
                    [
                      [
                        "Volume",
                        `${((customDims.lengthCm * customDims.widthCm * customDims.heightCm) / 1e6).toFixed(2)} m³`,
                      ],
                      [
                        "Max load",
                        `${customDims.maxWeightKg.toLocaleString()} kg`,
                      ],
                      [
                        "Door opening",
                        `${customDims.widthCm}×${customDims.heightCm} cm`,
                      ],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        marginBottom: 3,
                      }}
                    >
                      <span style={{ color: "#8792a2" }}>{k}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleRecalculate}
                  style={{
                    width: "100%",
                    padding: "9px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#635BFF",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Recalculate Custom Dims
                </button>
                <button
                  onClick={autoSelectBest}
                  style={{
                    width: "100%",
                    padding: "9px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Zap
                    size={12}
                    style={{ marginRight: 4, verticalAlign: -1 }}
                  />{" "}
                  Auto-Select Best Vehicle
                </button>
              </div>
            )}

            {/* ────── REPORT TAB ────── */}
            {activeTab === "report" && (
              <>
                <div
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #f0f3f7",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#0a2540",
                    }}
                  >
                    Step-by-Step Loading Plan
                  </span>
                  <button
                    onClick={() => window.print()}
                    style={sideBtnStyle("#425466")}
                  >
                    <Printer size={9} /> Print
                  </button>
                </div>
                <div>
                  {packingData?.steps.map((s, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedItem(s.item_id)}
                      style={{
                        display: "flex",
                        gap: 10,
                        padding: "9px 12px",
                        borderBottom: "1px solid #f5f7fa",
                        cursor: "pointer",
                        transition: "background .1s",
                        background:
                          selectedItem === s.item_id
                            ? "#f0f3ff"
                            : "transparent",
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: s.color || "#635BFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {s.step_number}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "#0a2540",
                          }}
                        >
                          Place {s.item_label}
                        </div>
                        <div
                          style={{
                            fontSize: 9.5,
                            color: "#8792a2",
                            marginTop: 1,
                          }}
                        >
                          at ({s.position.x.toFixed(0)},{" "}
                          {s.position.y.toFixed(0)}, {s.position.z.toFixed(0)})
                          · {s.oriented_dims[0]}×{s.oriented_dims[1]}×
                          {s.oriented_dims[2]} cm
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: "#10b981",
                            fontWeight: 500,
                            marginTop: 1,
                          }}
                        >
                          Util: {s.utilization_pct.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!packingData?.steps || packingData.steps.length === 0) && (
                    <div
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#8792a2",
                        fontSize: 11,
                      }}
                    >
                      Click ⚡ PACK to generate.
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ────── WEIGHT TAB ────── */}
            {activeTab === "weight" && (
              <div
                style={{
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-around",
                  }}
                >
                  <UtilRing
                    pct={m?.volume_utilization_pct || 0}
                    label="Volume"
                    color="#635BFF"
                  />
                  <UtilRing
                    pct={m?.weight_utilization_pct || 0}
                    label="Weight"
                    color="#10b981"
                  />
                </div>
                {/* Weight distribution */}
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 650,
                      color: "#0a2540",
                      marginBottom: 5,
                      textTransform: "uppercase",
                      letterSpacing: ".04em",
                    }}
                  >
                    Weight Distribution (Front ↔ Rear)
                  </div>
                  <div
                    style={{
                      display: "flex",
                      height: 20,
                      borderRadius: 5,
                      overflow: "hidden",
                      background: "#f0f3f7",
                    }}
                  >
                    <div
                      style={{
                        width: `${weightDist.rear}%`,
                        background: "#635BFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        color: "#fff",
                        fontWeight: 600,
                        minWidth: 28,
                      }}
                    >
                      {weightDist.rear}%
                    </div>
                    <div
                      style={{
                        width: `${weightDist.front}%`,
                        background: "#0ea5e9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        color: "#fff",
                        fontWeight: 600,
                        minWidth: 28,
                      }}
                    >
                      {weightDist.front}%
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 9,
                      color: "#8792a2",
                      marginTop: 2,
                    }}
                  >
                    <span>Rear (door)</span>
                    <span>Front (cab)</span>
                  </div>
                </div>
                {/* COG */}
                <div
                  style={{
                    padding: 10,
                    background: "#f8f9fc",
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 650,
                      color: "#0a2540",
                      marginBottom: 6,
                      textTransform: "uppercase",
                    }}
                  >
                    Center of Gravity
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 6,
                    }}
                  >
                    {(
                      [
                        ["X", m?.center_of_gravity.x],
                        ["Y", m?.center_of_gravity.y],
                        ["Z", m?.center_of_gravity.z],
                      ] as [string, number | undefined][]
                    ).map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 8, color: "#8792a2" }}>{k}</div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>
                          {(v || 0).toFixed(0)} cm
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Stats table */}
                <div>
                  {[
                    {
                      k: "Total Weight",
                      v: `${(m?.total_weight_kg || 0).toLocaleString()} kg`,
                    },
                    {
                      k: "Max Capacity",
                      v: `${customDims.maxWeightKg.toLocaleString()} kg`,
                    },
                    {
                      k: "Remaining",
                      v: `${Math.max(0, remainingWt).toLocaleString()} kg`,
                      c: remainingWt < 0 ? "#ef4444" : "#10b981",
                    },
                    {
                      k: "Volume Used",
                      v: `${(m?.total_volume_m3 || 0).toFixed(2)} m³`,
                    },
                    { k: "Free Space", v: `${freeVolM3.toFixed(2)} m³` },
                    { k: "Items Packed", v: `${m?.total_items || 0}` },
                    {
                      k: "Items Unpacked",
                      v: `${m?.unpacked_count || 0}`,
                      c: (m?.unpacked_count || 0) > 0 ? "#ef4444" : "#10b981",
                    },
                    {
                      k: "Compute Time",
                      v: `${m?.computation_time_ms || 0} ms`,
                    },
                    { k: "Algorithm", v: m?.algorithm || "—" },
                  ].map((r) => (
                    <div
                      key={r.k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 0",
                        borderBottom: "1px solid #f0f3f7",
                        fontSize: 11,
                      }}
                    >
                      <span style={{ color: "#8792a2" }}>{r.k}</span>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            (r as { k: string; v: string; c?: string }).c ||
                            "#0a2540",
                        }}
                      >
                        {r.v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ────── SETTINGS TAB ────── */}
            {activeTab === "settings" && (
              <div
                style={{
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 650,
                    color: "#8792a2",
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                    marginBottom: 4,
                  }}
                >
                  Display
                </div>
                <Toggle
                  value={showLabels}
                  onChange={() => setShowLabels((l) => !l)}
                  label="Show Labels (L)"
                />
                <Toggle
                  value={wireframe}
                  onChange={() => setWireframe((w) => !w)}
                  label="Container Walls"
                />
                <Toggle
                  value={showGrid}
                  onChange={() => setShowGrid((g) => !g)}
                  label="Floor Grid (G)"
                />
                <Toggle
                  value={showDimensions}
                  onChange={() => setShowDimensions((d) => !d)}
                  label="Dimension Rulers"
                />
                <Toggle
                  value={showCOG}
                  onChange={() => setShowCOG((c) => !c)}
                  label="Center of Gravity"
                />
                <Toggle
                  value={showLoadingOrder}
                  onChange={() => setShowLoadingOrder((o) => !o)}
                  label="Loading Order #"
                />

                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 650,
                    color: "#8792a2",
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                    marginTop: 10,
                    marginBottom: 4,
                  }}
                >
                  Effects
                </div>
                <Toggle
                  value={autoRotate}
                  onChange={() => setAutoRotate((a) => !a)}
                  label="Auto Rotate (R)"
                />
                <Toggle
                  value={heatmapMode}
                  onChange={() => setHeatmapMode((h) => !h)}
                  label="Heatmap Mode (H)"
                />
                <Toggle
                  value={explodedView}
                  onChange={() => setExplodedView((v) => !v)}
                  label="Exploded View (E)"
                />

                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 650,
                    color: "#8792a2",
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                    marginTop: 10,
                    marginBottom: 4,
                  }}
                >
                  Animation Speed
                </div>
                <input
                  type="range"
                  min={100}
                  max={1000}
                  step={50}
                  value={animSpeed}
                  onChange={(e) => setAnimSpeed(+e.target.value)}
                  style={{ width: "100%", accentColor: "#635BFF" }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 9,
                    color: "#8792a2",
                  }}
                >
                  <span>Fast</span>
                  <span>{animSpeed}ms</span>
                  <span>Slow</span>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    background: "#f8f9fc",
                    border: "1px solid #e3e8ee",
                    borderRadius: 6,
                    padding: "10px 12px",
                    fontSize: 9.5,
                    lineHeight: 1.8,
                    color: "#425466",
                  }}
                >
                  <strong style={{ color: "#635BFF" }}>
                    Extreme Point Method
                  </strong>
                  <br />
                  Items sorted by 6 strategies (FFD)
                  <br />
                  All 6 rotations tested per item
                  <br />
                  Gravity-first + contact-area scoring
                  <br />
                  Support ratio ≥ 25% enforced
                  <br />
                  Weight capacity enforced
                  <br />
                  Constraint-aware (stackable/upright/rotate)
                </div>

                <div
                  style={{
                    marginTop: 8,
                    background: "#f8f9fc",
                    border: "1px solid #e3e8ee",
                    borderRadius: 6,
                    padding: "10px 12px",
                    fontSize: 9.5,
                    lineHeight: 1.8,
                    color: "#425466",
                  }}
                >
                  <strong style={{ color: "#635BFF" }}>
                    Keyboard Shortcuts
                  </strong>
                  <br />
                  <span style={{ color: "#8792a2" }}>R</span> Auto-rotate &nbsp;
                  <span style={{ color: "#8792a2" }}>Space</span> Animate
                  <br />
                  <span style={{ color: "#8792a2" }}>L</span> Labels &nbsp;
                  <span style={{ color: "#8792a2" }}>G</span> Grid &nbsp;
                  <span style={{ color: "#8792a2" }}>H</span> Heatmap
                  <br />
                  <span style={{ color: "#8792a2" }}>E</span> Explode &nbsp;
                  <span style={{ color: "#8792a2" }}>Esc</span> Deselect
                  <br />
                  <span style={{ color: "#8792a2" }}>Ctrl+Z</span> Undo &nbsp;
                  <span style={{ color: "#8792a2" }}>Ctrl+Y</span> Redo
                </div>
              </div>
            )}
          </div>

          {/* Bottom pack button */}
          <div
            style={{
              padding: "10px 12px",
              borderTop: "1px solid #e3e8ee",
              flexShrink: 0,
            }}
          >
            <button
              onClick={handleRecalculate}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: 12,
                fontWeight: 700,
                background: "linear-gradient(135deg, #635BFF, #10b981)",
                border: "none",
                borderRadius: 7,
                color: "#fff",
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              ⚡ OPTIMIZE PACKING
            </button>
          </div>
        </div>
      </div>

      {/* ── Add Item Modal ── */}
      {showAddModal && (
        <AddItemModal
          onAdd={handleAddItem}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Style helpers
   ═══════════════════════════════════════════════════════════════════════ */
function Btn({
  onClick,
  active,
  accent,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  accent: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 10px",
        fontSize: 9.5,
        fontWeight: active ? 700 : 500,
        background: active ? accent + "15" : "#fff",
        border: `1px solid ${active ? accent : "#e3e8ee"}`,
        color: active ? accent : "#425466",
        borderRadius: 6,
        cursor: "pointer",
        letterSpacing: ".5px",
        transition: "all .15s",
      }}
    >
      {label}
    </button>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #e3e8ee",
  borderRadius: 6,
  padding: "4px 6px",
  cursor: "pointer",
  color: "#8792a2",
  display: "flex",
  alignItems: "center",
};

function sideBtnStyle(accent: string): React.CSSProperties {
  return {
    flex: 1,
    padding: "5px 0",
    fontSize: 9,
    fontWeight: 600,
    background: accent + "10",
    border: `1px solid ${accent}33`,
    color: accent,
    borderRadius: 5,
    cursor: "pointer",
    letterSpacing: ".5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Add Item Modal
   ═══════════════════════════════════════════════════════════════════════ */
function AddItemModal({
  onAdd,
  onClose,
}: {
  onAdd: (item: Omit<CargoItem, "id" | "color">) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [lengthCm, setLengthCm] = useState(100);
  const [widthCm, setWidthCm] = useState(80);
  const [heightCm, setHeightCm] = useState(60);
  const [weightKg, setWeightKg] = useState(500);
  const [quantity, setQuantity] = useState(1);
  const [stackable, setStackable] = useState(true);
  const [keepUpright, setKeepUpright] = useState(false);
  const [doNotRotate, setDoNotRotate] = useState(false);
  const [cargoType, setCargoType] = useState("general");
  const [priority, setPriority] = useState("normal");

  const submit = () => {
    if (!label.trim()) return;
    onAdd({
      label: label.trim(),
      lengthCm,
      widthCm,
      heightCm,
      weightKg,
      quantity,
      stackable,
      keepUpright,
      doNotRotate,
      cargoType,
      priority,
    });
  };

  const iS: React.CSSProperties = {
    width: "100%",
    padding: "7px 9px",
    borderRadius: 7,
    border: "1px solid #e3e8ee",
    fontSize: 12.5,
    fontWeight: 500,
    color: "#0a2540",
    background: "#fafbfc",
  };
  const lS: React.CSSProperties = {
    fontSize: 9,
    color: "#8792a2",
    display: "block",
    marginBottom: 2,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".04em",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 400,
          maxHeight: "85vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 16px 48px rgba(0,0,0,.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #f0f3f7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0a2540" }}>
            Add Cargo Item
          </div>
          <button
            onClick={onClose}
            style={{
              cursor: "pointer",
              background: "none",
              border: "none",
              color: "#8792a2",
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div
          style={{
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div>
            <label style={lS}>Item Label *</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Pallet A"
              style={iS}
              autoFocus
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            <div>
              <label style={lS}>Length (cm)</label>
              <input
                type="number"
                value={lengthCm}
                onChange={(e) => setLengthCm(+e.target.value)}
                min={1}
                style={iS}
              />
            </div>
            <div>
              <label style={lS}>Width (cm)</label>
              <input
                type="number"
                value={widthCm}
                onChange={(e) => setWidthCm(+e.target.value)}
                min={1}
                style={iS}
              />
            </div>
            <div>
              <label style={lS}>Height (cm)</label>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(+e.target.value)}
                min={1}
                style={iS}
              />
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <div>
              <label style={lS}>Weight (kg)</label>
              <input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(+e.target.value)}
                min={1}
                style={iS}
              />
            </div>
            <div>
              <label style={lS}>Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(+e.target.value)}
                min={1}
                max={99}
                style={iS}
              />
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <div>
              <label style={lS}>Cargo Type</label>
              <select
                value={cargoType}
                onChange={(e) => setCargoType(e.target.value)}
                style={{ ...iS, cursor: "pointer" }}
              >
                <option value="general">General</option>
                <option value="fragile">Fragile</option>
                <option value="refrigerated">Refrigerated</option>
                <option value="hazardous">Hazardous</option>
              </select>
            </div>
            <div>
              <label style={lS}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{ ...iS, cursor: "pointer" }}
              >
                <option value="normal">Normal</option>
                <option value="express">Express</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ ...lS, marginBottom: 6 }}>Constraints</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                {
                  l: "Stackable",
                  v: stackable,
                  s: setStackable,
                },
                {
                  l: "Keep Upright",
                  v: keepUpright,
                  s: setKeepUpright,
                },
                {
                  l: "No Rotate",
                  v: doNotRotate,
                  s: setDoNotRotate,
                },
              ].map((c) => (
                <button
                  key={c.l}
                  onClick={() => c.s(!c.v)}
                  style={{
                    flex: 1,
                    padding: "7px 0",
                    borderRadius: 7,
                    fontSize: 10.5,
                    fontWeight: 600,
                    border: "1px solid",
                    cursor: "pointer",
                    background: c.v ? "#ede9ff" : "#fff",
                    color: c.v ? "#635BFF" : "#8792a2",
                    borderColor: c.v ? "#c4b5fd" : "#e3e8ee",
                  }}
                >
                  {c.l}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              padding: 8,
              background: "#f8f9fc",
              borderRadius: 6,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
            }}
          >
            <span style={{ color: "#8792a2" }}>Volume</span>
            <span style={{ fontWeight: 600 }}>
              {((lengthCm * widthCm * heightCm) / 1e6).toFixed(4)} m³ ×{" "}
              {quantity}
            </span>
          </div>
        </div>
        <div
          style={{
            padding: "10px 18px 14px",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            borderTop: "1px solid #f0f3f7",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "7px 18px",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              background: "#fff",
              color: "#425466",
              border: "1px solid #e3e8ee",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!label.trim()}
            style={{
              padding: "7px 22px",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              background: label.trim() ? "#635BFF" : "#c4b5fd",
              color: "#fff",
              border: "none",
              cursor: label.trim() ? "pointer" : "not-allowed",
            }}
          >
            <Plus size={13} style={{ marginRight: 3, verticalAlign: -2 }} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
