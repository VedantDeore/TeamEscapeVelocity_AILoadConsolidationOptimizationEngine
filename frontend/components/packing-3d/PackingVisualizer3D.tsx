'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* ═══════════════════════════════════════════════════════════════════════
   Types  (exported – consumed by packing page & simulate page)
   ═══════════════════════════════════════════════════════════════════════ */
export interface PackingPlacement {
  item: {
    id: string; label: string;
    width: number; height: number; depth: number;
    weight: number; volume_m3: number;
    cargo_type: string; priority: string;
    stackable: boolean; color: string;
  };
  position: { x: number; y: number; z: number };
  orientation: number;
  oriented_width: number; oriented_height: number; oriented_depth: number;
}

export interface PackingStep {
  step_number: number; action: string; item_id: string; item_label: string;
  position: { x: number; y: number; z: number }; orientation: number;
  oriented_dims: [number, number, number];
  utilization_pct: number; weight_utilization_pct: number;
  items_placed: number; total_items: number;
  center_of_gravity: [number, number, number]; color: string;
}

export interface ContainerData {
  id: string; name: string;
  width: number; height: number; depth: number;
  max_weight: number; volume_m3: number;
}

export interface PackingMetrics {
  total_items: number; unpacked_count: number;
  volume_utilization_pct: number; weight_utilization_pct: number;
  total_weight_kg: number; total_volume_m3: number;
  center_of_gravity: { x: number; y: number; z: number };
  container_volume_m3: number; algorithm: string; computation_time_ms: number;
}

export interface PackingResultData {
  container: ContainerData;
  placements: PackingPlacement[];
  steps: PackingStep[];
  metrics: PackingMetrics;
  unpacked_items: any[];
}

export type ViewPreset = 'perspective' | 'front' | 'back' | 'left' | 'right' | 'top' | 'inside';

/* ═══════════════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════════════ */
interface PackingVisualizer3DProps {
  data: PackingResultData | null;
  isAnimating: boolean;
  animationStep: number;
  onHoverItem: (itemId: string | null) => void;
  hoveredItem: string | null;
  showLabels?: boolean;
  showCOG?: boolean;
  showGrid?: boolean;
  viewPreset?: ViewPreset;
  selectedItem?: string | null;
  onSelectItem?: (itemId: string | null) => void;
  showDimensions?: boolean;
  /* ── new props ── */
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  explodedView?: boolean;
  heatmapMode?: boolean;
  showLoadingOrder?: boolean;
  wireframe?: boolean;
  screenshotRef?: React.MutableRefObject<(() => string | null) | null>;
}

/* ═══════════════════════════════════════════════════════════════════════ */
const SCALE = 0.01;
const ANIM_DUR = 500;
const CONTAINER_COLOR = 0x4f6d7a;
const FLOOR_COLOR = 0x8b7355;

/* ═══════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════ */
export default function PackingVisualizer3D({
  data, isAnimating, animationStep, onHoverItem, hoveredItem,
  showLabels = true, showCOG = false, showGrid = true,
  viewPreset = 'perspective', selectedItem = null, onSelectItem,
  showDimensions = false,
  autoRotate = false, autoRotateSpeed = 2, explodedView = false,
  heatmapMode = false, showLoadingOrder = false, wireframe = true,
  screenshotRef,
}: PackingVisualizer3DProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const ctrlRef = useRef<OrbitControls | null>(null);
  const boxesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const edgesRef = useRef<Map<string, THREE.LineSegments>>(new Map());
  const labelsRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const grpRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef<number>(0);
  const dimsRef = useRef({ cw: 0, ch: 0, cd: 0, maxD: 0 });
  const gridRef = useRef<THREE.Group | null>(null);

  /* ── 1. Scene bootstrap ─────────────────────────────────────────── */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef1f8);
    scene.fog = new THREE.Fog(0xeef1f8, 25, 50);
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);
    cam.position.set(8, 6, 12);
    camRef.current = cam;

    const r = new THREE.WebGLRenderer({
      antialias: true, powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // needed for screenshots
    });
    r.setSize(W, H);
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.35;
    el.appendChild(r.domElement);
    rendererRef.current = r;

    const ctrl = new OrbitControls(cam, r.domElement);
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.07;
    ctrl.minDistance = 1;
    ctrl.maxDistance = 40;
    ctrl.maxPolarAngle = Math.PI * 0.85;
    ctrl.target.set(0, 1.2, 0);
    ctrlRef.current = ctrl;

    // Lighting – studio 3-point
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xfff8f0, 1.1);
    key.position.set(10, 16, 10); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 50;
    key.shadow.camera.left = -12; key.shadow.camera.right = 12;
    key.shadow.camera.top = 12; key.shadow.camera.bottom = -12;
    key.shadow.bias = -0.001;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd4e4ff, 0.45); fill.position.set(-6, 8, -4); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe0cc, 0.3); rim.position.set(0, 2, -12); scene.add(rim);

    // Ground + grid group (toggled by showGrid)
    const gg = new THREE.Group();
    const gndGeo = new THREE.PlaneGeometry(40, 40);
    const gndMat = new THREE.MeshStandardMaterial({ color: 0xe6eaf2, roughness: 0.95, metalness: 0 });
    const gnd = new THREE.Mesh(gndGeo, gndMat); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.005; gnd.receiveShadow = true; gg.add(gnd);
    const grid = new THREE.GridHelper(40, 40, 0xc8cdd8, 0xdce1ea); grid.position.y = 0.001; gg.add(grid);
    scene.add(gg);
    gridRef.current = gg;

    const loop = () => { rafRef.current = requestAnimationFrame(loop); ctrl.update(); r.render(scene, cam); };
    loop();

    const onResize = () => { if (!el) return; const w = el.clientWidth, h = el.clientHeight; cam.aspect = w / h; cam.updateProjectionMatrix(); r.setSize(w, h); };
    window.addEventListener('resize', onResize);

    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(rafRef.current); ctrl.dispose(); r.dispose(); if (el && r.domElement.parentNode === el) el.removeChild(r.domElement); };
  }, []);

  /* ── 1b. Toggle grid visibility ──────────────────────────────────── */
  useEffect(() => { if (gridRef.current) gridRef.current.visible = showGrid; }, [showGrid]);

  /* ── 1c. Auto-rotate ─────────────────────────────────────────────── */
  useEffect(() => { const c = ctrlRef.current; if (c) { c.autoRotate = autoRotate; c.autoRotateSpeed = autoRotateSpeed; } }, [autoRotate, autoRotateSpeed]);

  /* ── 1d. Screenshot ref ──────────────────────────────────────────── */
  useEffect(() => {
    if (!screenshotRef) return;
    screenshotRef.current = () => {
      const r = rendererRef.current; const s = sceneRef.current; const c = camRef.current;
      if (!r || !s || !c) return null;
      r.render(s, c);
      return r.domElement.toDataURL('image/png');
    };
  }, [screenshotRef]);

  /* ── 2. Build truck container & cargo boxes ──────────────────────── */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !data) return;
    if (grpRef.current) scene.remove(grpRef.current);
    boxesRef.current.clear(); edgesRef.current.clear(); labelsRef.current.clear();

    const g = new THREE.Group();
    grpRef.current = g;
    const { container, placements } = data;
    const cw = container.width * SCALE, ch = container.height * SCALE, cd = container.depth * SCALE;
    const maxD = Math.max(cw, ch, cd);
    dimsRef.current = { cw, ch, cd, maxD };
    g.position.set(-cw / 2, 0, -cd / 2);

    // Container walls
    buildTruckContainer(g, cw, ch, cd, showDimensions, wireframe, container);

    // Heatmap prep
    let minDens = Infinity, maxDens = 0;
    if (heatmapMode) {
      for (const pl of placements) {
        const vol = (pl.oriented_width * pl.oriented_height * pl.oriented_depth) / 1e6;
        const d = vol > 0 ? pl.item.weight / vol : 0;
        if (d < minDens) minDens = d;
        if (d > maxDens) maxDens = d;
      }
    }

    const visible = isAnimating ? placements.slice(0, animationStep) : placements;
    const explodeFactor = explodedView ? 0.45 : 0;

    visible.forEach((pl, idx) => {
      const { item, position: pos, oriented_width: ow, oriented_height: oh, oriented_depth: od } = pl;
      const bw = ow * SCALE, bh = oh * SCALE, bd = od * SCALE;

      // Compute position (with optional explosion offset)
      let bx = pos.x * SCALE + bw / 2;
      let by = pos.y * SCALE + bh / 2;
      let bz = pos.z * SCALE + bd / 2;
      if (explodeFactor > 0) {
        bx += (bx - cw / 2) * explodeFactor;
        bz += (bz - cd / 2) * explodeFactor;
        by += (pos.y * SCALE) * explodeFactor * 0.3;
      }

      // Color (heatmap or original)
      let col: THREE.Color;
      if (heatmapMode) {
        const vol = (ow * oh * od) / 1e6;
        const dens = vol > 0 ? item.weight / vol : 0;
        col = densityToColor(dens, minDens, maxDens);
      } else {
        col = new THREE.Color(item.color);
      }

      const geo = new THREE.BoxGeometry(bw, bh, bd);
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.08, transparent: true, opacity: 0.92 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(bx, by, bz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData = { itemId: item.id, itemLabel: item.label };

      // Drop animation for latest step
      if (isAnimating && idx === animationStep - 1) {
        const finalY = by;
        mesh.position.y = finalY + 2; mesh.scale.set(0.8, 0.8, 0.8);
        const t0 = performance.now();
        const drop = (t: number) => {
          const p = Math.min((t - t0) / ANIM_DUR, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          mesh.position.y = finalY + 2 * (1 - ease);
          mesh.scale.setScalar(0.8 + 0.2 * ease);
          if (p < 1) requestAnimationFrame(drop);
        };
        requestAnimationFrame(drop);
      }

      g.add(mesh); boxesRef.current.set(item.id, mesh);

      // Edges
      const eMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 });
      const eLine = new THREE.LineSegments(new THREE.EdgesGeometry(geo), eMat);
      eLine.position.copy(mesh.position); g.add(eLine); edgesRef.current.set(item.id, eLine);

      // Cargo label
      if (showLabels) {
        const sprite = makeLabel(item.label, item.color);
        sprite.position.set(bx, by + bh / 2 + 0.18, bz);
        sprite.visible = false; g.add(sprite); labelsRef.current.set(item.id, sprite);
      }

      // Loading order number
      if (showLoadingOrder) {
        const numSprite = makeOrderSprite(idx + 1);
        numSprite.position.set(bx, by + bh / 2 + 0.06, bz);
        g.add(numSprite);
      }
    });

    // COG sphere
    if (showCOG && data.metrics.center_of_gravity) {
      const c = data.metrics.center_of_gravity;
      const cogGeo = new THREE.SphereGeometry(0.07, 16, 16);
      const cogMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const cogMesh = new THREE.Mesh(cogGeo, cogMat);
      cogMesh.position.set(c.x * SCALE, c.y * SCALE, c.z * SCALE);
      g.add(cogMesh);
    }

    scene.add(g);

    // Camera fit
    if (camRef.current && ctrlRef.current) {
      camRef.current.position.set(maxD * 0.95, maxD * 0.75, maxD * 1.15);
      ctrlRef.current.target.set(0, ch / 2, 0);
      ctrlRef.current.update();
    }
  }, [data, isAnimating, animationStep, showLabels, showCOG, showDimensions, heatmapMode, explodedView, showLoadingOrder, wireframe]);

  /* ── 3. View preset camera ──────────────────────────────────────── */
  useEffect(() => {
    const cam = camRef.current; const ctrl = ctrlRef.current;
    if (!cam || !ctrl || !data) return;
    const { cw, ch, cd, maxD } = dimsRef.current;
    if (maxD === 0) return;

    const target = new THREE.Vector3(0, ch / 2, 0);
    let pos: THREE.Vector3;
    switch (viewPreset) {
      case 'front':  pos = new THREE.Vector3(0, ch / 2, -(maxD * 0.95)); break;
      case 'back':   pos = new THREE.Vector3(0, ch / 2, maxD * 0.95); break;
      case 'left':   pos = new THREE.Vector3(-(maxD * 0.95), ch / 2, 0); break;
      case 'right':  pos = new THREE.Vector3(maxD * 0.95, ch / 2, 0); break;
      case 'top':    pos = new THREE.Vector3(0.01, maxD * 1.3, 0.01); target.set(0, 0, 0); break;
      case 'inside': pos = new THREE.Vector3(0, ch * 0.35, -cd * 0.35); target.set(0, ch * 0.35, cd * 0.3); break;
      default:       pos = new THREE.Vector3(maxD * 0.95, maxD * 0.75, maxD * 1.15); break;
    }
    const sP = cam.position.clone(); const sT = ctrl.target.clone();
    let f = 0; const N = 20;
    const anim = () => { f++; const t = Math.min(f / N, 1); const e = 1 - Math.pow(1 - t, 3); cam.position.lerpVectors(sP, pos, e); ctrl.target.lerpVectors(sT, target, e); ctrl.update(); if (t < 1) requestAnimationFrame(anim); };
    requestAnimationFrame(anim);
  }, [viewPreset, data]);

  /* ── 4. Hover & select highlight ─────────────────────────────────── */
  useEffect(() => {
    boxesRef.current.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const edge = edgesRef.current.get(id); const lbl = labelsRef.current.get(id);
      const isSel = id === selectedItem; const isHov = id === hoveredItem;
      if (isSel) {
        mat.opacity = 1; mat.emissive = new THREE.Color(mat.color).multiplyScalar(0.3);
        if (edge) (edge.material as THREE.LineBasicMaterial).opacity = 0.7;
        if (lbl) lbl.visible = true;
      } else if (isHov) {
        mat.opacity = 0.95; mat.emissive = new THREE.Color(mat.color).multiplyScalar(0.15);
        if (edge) (edge.material as THREE.LineBasicMaterial).opacity = 0.4;
        if (lbl) lbl.visible = true;
      } else {
        mat.opacity = (selectedItem || hoveredItem) ? 0.35 : 0.92;
        mat.emissive = new THREE.Color(0x000000);
        if (edge) (edge.material as THREE.LineBasicMaterial).opacity = 0.12;
        if (lbl) lbl.visible = false;
      }
    });
  }, [hoveredItem, selectedItem]);

  /* ── 5. Raycaster hover ──────────────────────────────────────────── */
  const onMove = useCallback((e: React.MouseEvent) => {
    const el = wrapRef.current; if (!el || !camRef.current) return;
    const rect = el.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.current.setFromCamera(mouse.current, camRef.current);
    const hits = raycaster.current.intersectObjects(Array.from(boxesRef.current.values()), false);
    onHoverItem(hits.length > 0 ? hits[0].object.userData.itemId : null);
  }, [onHoverItem]);

  /* ── 6. Click to select ──────────────────────────────────────────── */
  const onClick = useCallback((e: React.MouseEvent) => {
    if (!onSelectItem) return;
    const el = wrapRef.current; if (!el || !camRef.current) return;
    const rect = el.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.current.setFromCamera(mouse.current, camRef.current);
    const hits = raycaster.current.intersectObjects(Array.from(boxesRef.current.values()), false);
    onSelectItem(hits.length > 0 ? hits[0].object.userData.itemId : null);
  }, [onSelectItem]);

  return (
    <div ref={wrapRef} onMouseMove={onMove} onClick={onClick}
      style={{ width: '100%', height: '100%', minHeight: 460, borderRadius: 12, overflow: 'hidden', cursor: 'grab', background: '#f5f7fa' }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */

function densityToColor(d: number, min: number, max: number): THREE.Color {
  const t = max > min ? (d - min) / (max - min) : 0.5;
  const c = new THREE.Color();
  c.setHSL((1 - t) * 0.66, 0.82, 0.55); // blue(0.66) → red(0)
  return c;
}

function buildTruckContainer(g: THREE.Group, cw: number, ch: number, cd: number, showDims: boolean, showWalls: boolean, container?: ContainerData) {
  const WALL = 0.035;

  const frameMat = new THREE.MeshStandardMaterial({ color: CONTAINER_COLOR, roughness: 0.65, metalness: 0.35, transparent: true, opacity: showWalls ? 0.16 : 0, side: THREE.DoubleSide });
  const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.85, metalness: 0.05 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xc8dce8, transparent: true, opacity: showWalls ? 0.08 : 0, roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide });

  // Floor
  const flr = new THREE.Mesh(new THREE.BoxGeometry(cw, WALL, cd), floorMat);
  flr.position.set(cw / 2, -WALL / 2, cd / 2); flr.receiveShadow = true; g.add(flr);

  // Walls
  const lw = new THREE.Mesh(new THREE.BoxGeometry(WALL, ch, cd), frameMat); lw.position.set(-WALL / 2, ch / 2, cd / 2); lw.castShadow = true; g.add(lw);
  const rw = new THREE.Mesh(new THREE.BoxGeometry(WALL, ch, cd), frameMat); rw.position.set(cw + WALL / 2, ch / 2, cd / 2); rw.castShadow = true; g.add(rw);
  const fw = new THREE.Mesh(new THREE.BoxGeometry(cw + WALL * 2, ch, WALL), frameMat); fw.position.set(cw / 2, ch / 2, cd + WALL / 2); fw.castShadow = true; g.add(fw);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cw + WALL * 2, WALL, cd + WALL), frameMat); roof.position.set(cw / 2, ch + WALL / 2, cd / 2 + WALL / 2); roof.castShadow = true; g.add(roof);
  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), glassMat); rearGlass.position.set(cw / 2, ch / 2, 0); g.add(rearGlass);

  // Corner beams
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.3, transparent: true, opacity: 0.45 });
  const beamGeo = new THREE.BoxGeometry(WALL * 0.6, ch, WALL * 0.6);
  for (const [x, y, z] of [[-WALL / 2, ch / 2, 0], [cw + WALL / 2, ch / 2, 0], [-WALL / 2, ch / 2, cd + WALL / 2], [cw + WALL / 2, ch / 2, cd + WALL / 2]] as [number, number, number][]) {
    const b = new THREE.Mesh(beamGeo, beamMat); b.position.set(x, y, z); g.add(b);
  }

  // Edge wireframe (always visible)
  const edgeLine = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(cw, ch, cd)),
    new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 }),
  );
  edgeLine.position.set(cw / 2, ch / 2, cd / 2); g.add(edgeLine);

  // Dimension labels
  if (showDims && container) {
    const wCm = Math.round(container.width), hCm = Math.round(container.height), dCm = Math.round(container.depth);
    const ws = makeDimLabel(`${wCm} cm`); ws.position.set(cw / 2, -0.12, -0.15); g.add(ws);
    const ds = makeDimLabel(`${dCm} cm`); ds.position.set(cw + 0.15, -0.12, cd / 2); g.add(ds);
    const hs = makeDimLabel(`${hCm} cm`); hs.position.set(cw + 0.15, ch / 2, -0.15); g.add(hs);

    const rulerMat = new THREE.LineBasicMaterial({ color: 0x635BFF, transparent: true, opacity: 0.45 });
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.06, -0.08), new THREE.Vector3(cw, -0.06, -0.08)]), rulerMat));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(cw + 0.08, -0.06, 0), new THREE.Vector3(cw + 0.08, -0.06, cd)]), rulerMat));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(cw + 0.08, 0, -0.08), new THREE.Vector3(cw + 0.08, ch, -0.08)]), rulerMat));
  }
}

/* ── Sprites ─────────────────────────────────────────────────────── */
function makeLabel(text: string, accent: string): THREE.Sprite {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 56;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = 'rgba(15,23,42,0.82)'; ctx.beginPath(); ctx.roundRect(0, 0, 256, 56, 28); ctx.fill();
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(24, 28, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = '600 22px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, 40, 28);
  const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat); s.scale.set(0.55, 0.12, 1); return s;
}

function makeDimLabel(text: string): THREE.Sprite {
  const cv = document.createElement('canvas'); cv.width = 200; cv.height = 44;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = 'rgba(99,91,255,0.85)'; ctx.beginPath(); ctx.roundRect(0, 0, 200, 44, 22); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = '600 20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 100, 22);
  const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat); s.scale.set(0.45, 0.1, 1); return s;
}

function makeOrderSprite(num: number): THREE.Sprite {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = 'rgba(99,91,255,0.92)'; ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(num), 32, 33);
  const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat); s.scale.set(0.2, 0.2, 1); return s;
}
