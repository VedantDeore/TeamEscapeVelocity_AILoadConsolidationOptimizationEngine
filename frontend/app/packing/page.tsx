'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box, RotateCcw, Play, Pause, ChevronLeft, ChevronRight,
  Truck, Package, Maximize, Gauge
} from 'lucide-react';
import { mockConsolidationPlan } from '@/lib/mock-data';

interface PackingItem {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  color: string;
  label: string;
  weight: number;
}

const VEHICLE = { width: 240, height: 240, depth: 720 };

const ITEM_COLORS = [
  '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

// Generate packing items for demo
function generatePackingItems(): PackingItem[] {
  const items: PackingItem[] = [];
  let currentX = 10, currentY = 10, currentZ = 10;
  const shipmentIds = mockConsolidationPlan.clusters[0].shipmentIds;

  shipmentIds.forEach((sid, i) => {
    const w = 60 + Math.floor(Math.random() * 80);
    const h = 40 + Math.floor(Math.random() * 60);
    const d = 80 + Math.floor(Math.random() * 120);

    if (currentX + w > VEHICLE.width - 10) {
      currentX = 10;
      currentY += h + 10;
    }
    if (currentY + h > VEHICLE.height - 10) {
      currentY = 10;
      currentZ += d + 10;
    }

    items.push({
      id: sid,
      x: currentX,
      y: currentY,
      z: currentZ,
      width: w,
      height: h,
      depth: d,
      color: ITEM_COLORS[i % ITEM_COLORS.length],
      label: sid.toUpperCase(),
      weight: 500 + Math.floor(Math.random() * 2000),
    });
    currentX += w + 10;
  });
  return items;
}

function project3D(x: number, y: number, z: number, rotY: number, rotX: number): { px: number; py: number } {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);

  // Rotate around Y axis
  let rx = x * cosY - z * sinY;
  let rz = x * sinY + z * cosY;
  let ry = y;

  // Rotate around X axis
  const ry2 = ry * cosX - rz * sinX;
  const rz2 = ry * sinX + rz * cosX;

  // Simple perspective
  const scale = 600 / (600 + rz2);
  return {
    px: rx * scale + 400,
    py: -ry2 * scale + 300,
  };
}

export default function PackingPage() {
  const [items] = useState<PackingItem[]>(generatePackingItems);
  const [selectedVehicle, setSelectedVehicle] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [rotation, setRotation] = useState({ x: -0.4, y: 0.6 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const clusters = mockConsolidationPlan.clusters;
  const cluster = clusters[selectedVehicle];

  const totalVolume = items.reduce((sum, item) => sum + (item.width * item.height * item.depth), 0);
  const vehicleVolume = VEHICLE.width * VEHICLE.height * VEHICLE.depth;
  const utilizationPct = Math.min(((totalVolume / vehicleVolume) * 100), 100).toFixed(1);

  // Draw 3D scene using canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const { x: rotX, y: rotY } = rotation;

    // Center offset
    const cx = -VEHICLE.width / 2;
    const cy = -VEHICLE.height / 2;
    const cz = -VEHICLE.depth / 2;

    // Draw vehicle wireframe
    const verts = [
      [0, 0, 0], [VEHICLE.width, 0, 0], [VEHICLE.width, VEHICLE.height, 0], [0, VEHICLE.height, 0],
      [0, 0, VEHICLE.depth], [VEHICLE.width, 0, VEHICLE.depth], [VEHICLE.width, VEHICLE.height, VEHICLE.depth], [0, VEHICLE.height, VEHICLE.depth],
    ].map(([vx, vy, vz]) => project3D(vx + cx, vy + cy, vz + cz, rotY, rotX));

    const edges = [
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7],
    ];

    // Vehicle edges
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.25)';
    ctx.lineWidth = 1;
    edges.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(verts[a].px, verts[a].py);
      ctx.lineTo(verts[b].px, verts[b].py);
      ctx.stroke();
    });

    // Draw items
    const visibleItems = items.slice(0, visibleCount);

    // Sort by depth for painter's algorithm
    const sortedItems = [...visibleItems].sort((a, b) => {
      const aCenter = project3D(a.x + a.width/2 + cx, a.y + a.height/2 + cy, a.z + a.depth/2 + cz, rotY, rotX);
      const bCenter = project3D(b.x + b.width/2 + cx, b.y + b.height/2 + cy, b.z + b.depth/2 + cz, rotY, rotX);
      return bCenter.py - aCenter.py; // rough depth sort
    });

    sortedItems.forEach((item) => {
      const isHovered = hoveredItem === item.id;
      const ix = item.x + cx;
      const iy = item.y + cy;
      const iz = item.z + cz;

      // Box faces (front, top, right - visible faces only for now)
      const boxVerts = [
        project3D(ix, iy, iz, rotY, rotX),
        project3D(ix + item.width, iy, iz, rotY, rotX),
        project3D(ix + item.width, iy + item.height, iz, rotY, rotX),
        project3D(ix, iy + item.height, iz, rotY, rotX),
        project3D(ix, iy, iz + item.depth, rotY, rotX),
        project3D(ix + item.width, iy, iz + item.depth, rotY, rotX),
        project3D(ix + item.width, iy + item.height, iz + item.depth, rotY, rotX),
        project3D(ix, iy + item.height, iz + item.depth, rotY, rotX),
      ];

      const faces = [
        { verts: [0,1,2,3], shade: 1.0 },    // front
        { verts: [4,5,6,7], shade: 0.7 },    // back
        { verts: [0,1,5,4], shade: 0.85 },   // bottom
        { verts: [2,3,7,6], shade: 0.85 },   // top
        { verts: [1,2,6,5], shade: 0.6 },    // right
        { verts: [0,3,7,4], shade: 0.9 },    // left
      ];

      faces.forEach((face) => {
        ctx.beginPath();
        face.verts.forEach((vi, fi) => {
          const p = boxVerts[vi];
          if (fi === 0) ctx.moveTo(p.px, p.py);
          else ctx.lineTo(p.px, p.py);
        });
        ctx.closePath();

        // Parse color for shading
        const alpha = isHovered ? 0.95 : 0.8;
        ctx.fillStyle = item.color + (isHovered ? 'ee' : 'bb');
        ctx.fill();
        ctx.strokeStyle = isHovered ? 'white' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = isHovered ? 2 : 0.5;
        ctx.stroke();
      });

      // Label on front face
      if (isHovered) {
        const center = project3D(ix + item.width/2, iy + item.height/2, iz, rotY, rotX);
        ctx.font = 'bold 11px system-ui';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, center.px, center.py);
      }
    });

    // Grid floor
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx <= VEHICLE.width; gx += 40) {
      const p1 = project3D(gx + cx, cy, cz, rotY, rotX);
      const p2 = project3D(gx + cx, cy, VEHICLE.depth + cz, rotY, rotX);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }
  }, [rotation, hoveredItem, items, visibleCount]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setRotation(prev => ({
      x: Math.max(-1.2, Math.min(0.2, prev.x + dy * 0.005)),
      y: prev.y + dx * 0.005,
    }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleAnimate = () => {
    setIsAnimating(true);
    setVisibleCount(0);
    let count = 0;
    const timer = setInterval(() => {
      count++;
      setVisibleCount(count);
      if (count >= items.length) {
        clearInterval(timer);
        setIsAnimating(false);
      }
    }, 500);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">3D Bin Packing Visualizer</h1>
          <p className="page-subtitle">Interactive 3D view of cargo placement inside vehicles</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setRotation({ x: -0.4, y: 0.6 })}>
            <RotateCcw size={16} /> Reset View
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAnimate}
            disabled={isAnimating}
          >
            <Play size={16} /> Play Loading Sequence
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Vehicle Selector */}
        <div className="packing-controls">
          {clusters.map((cl, i) => (
            <button
              key={cl.id}
              className={`btn ${selectedVehicle === i ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedVehicle(i)}
            >
              <Truck size={14} /> {cl.vehicleName}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
          {/* 3D Canvas */}
          <div className="viewer-3d" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              style={{ width: '100%', height: '100%' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <div style={{
              position: 'absolute', bottom: '12px', left: '12px',
              background: 'rgba(0,0,0,0.7)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}>
              🖱️ Click & drag to rotate · Scroll to zoom
            </div>
          </div>

          {/* Info Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Utilization Donut */}
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '24px' }}>
                <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 16px' }}>
                  <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-elevated)" strokeWidth="12" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke="url(#utilGrad)"
                      strokeWidth="12"
                      strokeDasharray={`${parseFloat(utilizationPct) * 3.14} 314`}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="utilGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{utilizationPct}%</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>UTILIZED</div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Volume Utilization</div>
              </div>
            </div>

            {/* Item List */}
            <div className="card" style={{ flex: 1 }}>
              <div className="card-header">
                <div className="card-title">Cargo Items ({items.length})</div>
              </div>
              <div className="card-body" style={{ padding: '0', maxHeight: '300px', overflowY: 'auto' }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-secondary)',
                      cursor: 'pointer',
                      background: hoveredItem === item.id ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div style={{
                      width: '12px', height: '12px', borderRadius: '3px',
                      background: item.color,
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                        {item.width}×{item.height}×{item.depth} cm
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {item.weight} kg
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="packing-info-grid" style={{ marginTop: '20px' }}>
          {[
            { label: 'Vehicle', value: cluster.vehicleName, icon: Truck, color: 'blue' },
            { label: 'Total Weight', value: `${cluster.totalWeight.toLocaleString()} kg`, icon: Package, color: 'violet' },
            { label: 'Total Volume', value: `${cluster.totalVolume} m³`, icon: Box, color: 'cyan' },
            { label: 'Utilization', value: `${cluster.utilizationPct}%`, icon: Gauge, color: 'green' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="kpi-card">
                <div className={`kpi-icon ${stat.color}`} style={{ marginBottom: '10px' }}>
                  <Icon size={18} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {stat.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
