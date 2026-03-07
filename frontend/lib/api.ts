const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
    if (!res.ok) {
      let errorMessage = `API error: ${res.status}`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = res.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  } catch (error: any) {
    // Handle network errors (backend not running, CORS, etc.)
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error(
        "Cannot connect to backend server. Please ensure the Flask backend is running on http://localhost:5000",
      );
    }
    throw error;
  }
}

// ---- Shipments ----

export async function getShipments(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return fetchApi<any[]>(`/api/shipments${qs}`);
}

export async function createShipment(data: any) {
  return fetchApi<any>("/api/shipments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateShipment(id: string, data: any) {
  return fetchApi<any>(`/api/shipments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteShipment(id: string) {
  return fetchApi<any>(`/api/shipments/${id}`, { method: "DELETE" });
}

export async function uploadShipmentsCSV(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch(`${API_BASE}/api/shipments/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      let errorMessage = `Upload error: ${res.status}`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = res.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  } catch (error: any) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error(
        "Cannot connect to backend server. Please ensure the Flask backend is running on http://localhost:5000",
      );
    }
    throw error;
  }
}

// ---- Consolidation ----

export async function getLatestPlan() {
  return fetchApi<any>("/api/consolidate/latest");
}

export async function runConsolidation() {
  return fetchApi<any>("/api/consolidate", { method: "POST" });
}

export async function submitClusterFeedback(
  clusterId: string,
  action: string,
  reason?: string,
) {
  return fetchApi<any>(`/api/clusters/${clusterId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
}

// ---- Routes ----

export async function getRoutes() {
  return fetchApi<any[]>("/api/routes");
}

// ---- Packing ----

export async function getPackingData(clusterId: string) {
  return fetchApi<any>(`/api/packing/${clusterId}`);
}

// ---- Analytics / Dashboard ----

export async function getDashboardData() {
  return fetchApi<{
    kpis: any[];
    utilization_trend: any[];
    activity_feed: any[];
  }>("/api/analytics/dashboard");
}

export async function getCarbonMetrics() {
  return fetchApi<{ monthly: any[]; breakdown: any[] }>(
    "/api/analytics/carbon",
  );
}

// ---- Scenarios ----

export async function getScenarios() {
  return fetchApi<any[]>("/api/scenarios");
}

// ---- Copilot ----

export async function sendChatMessage(message: string, sessionId = "default") {
  return fetchApi<any>("/api/copilot/chat", {
    method: "POST",
    body: JSON.stringify({ message, session_id: sessionId }),
  });
}

export async function getChatHistory(sessionId = "default") {
  return fetchApi<any[]>(`/api/copilot/history?session_id=${sessionId}`);
}

export async function getChatSuggestions() {
  return fetchApi<string[]>("/api/copilot/suggestions");
}

// ---- Reports ----

export async function getReports() {
  return fetchApi<any[]>("/api/reports");
}

// ---- Settings ----

export async function getVehicles() {
  return fetchApi<any[]>("/api/vehicles");
}

export async function createVehicle(data: any) {
  return fetchApi<any>("/api/vehicles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateVehicle(id: string, data: any) {
  return fetchApi<any>(`/api/vehicles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getDepots() {
  return fetchApi<any[]>("/api/depots");
}

export async function createDepot(data: any) {
  return fetchApi<any>("/api/depots", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDepot(id: string, data: any) {
  return fetchApi<any>(`/api/depots/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteDepot(id: string) {
  return fetchApi<any>(`/api/depots/${id}`, { method: "DELETE" });
}

export async function deleteVehicle(id: string) {
  return fetchApi<any>(`/api/vehicles/${id}`, { method: "DELETE" });
}

export async function geocodeAddress(address: string) {
  const qs = new URLSearchParams({ address }).toString();
  return fetchApi<{ lat: number; lng: number; display_name: string }>(
    `/api/geocode?${qs}`,
  );
}

export async function checkReadiness() {
  return fetchApi<{
    ready: boolean;
    issues: Array<{ type: string; field: string; message: string }>;
    warnings: Array<{ type: string; field: string; message: string }>;
    summary: { pending_shipments: number; vehicles: number; depots: number };
  }>("/api/readiness");
}

export async function getCostParams() {
  return fetchApi<any>("/api/settings/costs");
}

export async function updateCostParams(data: any) {
  return fetchApi<any>("/api/settings/costs", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getCities() {
  return fetchApi<any[]>("/api/cities");
}

export async function downloadCSVTemplate() {
  const csvContent = `shipment_id,origin_city,dest_city,weight_kg,volume_m3,length_cm,width_cm,height_cm,priority,cargo_type,delivery_start,delivery_end,origin_lat,origin_lng,dest_lat,dest_lng
SHP-0001,Delhi,Mumbai,1200,5.2,200,150,180,normal,general,2026-03-07T08:00:00+00:00,2026-03-08T18:00:00+00:00,28.6139,77.2090,19.0760,72.8777
SHP-0002,Mumbai,Chennai,850,3.8,180,120,150,express,fragile,2026-03-07T09:00:00+00:00,2026-03-08T20:00:00+00:00,19.0760,72.8777,13.0827,80.2707
SHP-0003,Bangalore,Delhi,2100,8.5,250,180,200,critical,general,2026-03-07T10:00:00+00:00,2026-03-09T18:00:00+00:00,12.9716,77.5946,28.6139,77.2090`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "shipments_template.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------
export async function checkHealth(): Promise<{
  status: string;
  service: string;
}> {
  return fetchApi("/api/health");
}

// ---------------------------------------------------------------------------
// Packing Endpoints
// ---------------------------------------------------------------------------
export interface PackItemsRequest {
  container?: {
    id: string;
    name: string;
    widthCm: number;
    heightCm: number;
    lengthCm: number;
    maxWeightKg: number;
    costPerKm?: number;
    emissionFactor?: number;
  };
  items: {
    id: string;
    shipmentCode?: string;
    widthCm: number;
    heightCm: number;
    lengthCm: number;
    weightKg: number;
    cargoType?: string;
    priority?: string;
  }[];
  algorithm?: "greedy" | "sa" | "hybrid";
  sa_iterations?: number;
  sa_initial_temp?: number;
  sa_cooling_rate?: number;
}

export async function packItems(req: PackItemsRequest) {
  return fetchApi("/api/packing/pack", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function packDemo(
  items?: number,
  vehicle?: string,
  algorithm?: string,
) {
  const params = new URLSearchParams();
  if (items) params.set("items", String(items));
  if (vehicle) params.set("vehicle", vehicle);
  if (algorithm) params.set("algorithm", algorithm);
  return fetchApi(`/api/packing/demo?${params.toString()}`);
}

export async function compareAlgorithms(req: Partial<PackItemsRequest>) {
  return fetchApi("/api/packing/compare", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ---------------------------------------------------------------------------
// Simulation Endpoints
// ---------------------------------------------------------------------------
export async function runSimulation(config: Record<string, unknown>) {
  return fetchApi("/api/simulation/run", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function demoSimulation(items?: number) {
  const params = items ? `?items=${items}` : "";
  return fetchApi(`/api/simulation/demo${params}`);
}

export async function compareScenarios(config: Record<string, unknown>) {
  return fetchApi("/api/simulation/compare-scenarios", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

// ---------------------------------------------------------------------------
// Client-side Packing Fallback (when backend is unavailable)
// ---------------------------------------------------------------------------
export interface ClientPackingItem {
  id: string;
  label: string;
  width: number;
  height: number;
  depth: number;
  weight: number;
  color: string;
  cargoType?: string;
  priority?: string;
  stackable?: boolean;
  keepUpright?: boolean;
  doNotRotate?: boolean;
}

export interface ClientContainer {
  width: number;
  height: number;
  depth: number;
  maxWeight: number;
}

interface PlacedItem extends ClientPackingItem {
  x: number;
  y: number;
  z: number;
  orientedWidth: number;
  orientedHeight: number;
  orientedDepth: number;
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------
function itemVol(it: ClientPackingItem): number {
  return it.width * it.height * it.depth;
}

function maxFace(it: ClientPackingItem): number {
  const d = [it.width, it.height, it.depth].sort((a, b) => b - a);
  return d[0] * d[1];
}

// ---------------------------------------------------------------------------
// Extreme-Point 3D bin-packing engine (single trial)
// ---------------------------------------------------------------------------
interface EP {
  x: number;
  y: number;
  z: number;
}

function epPack(
  cw: number,
  ch: number,
  cd: number,
  maxW: number,
  orderedItems: ClientPackingItem[],
): { placed: PlacedItem[]; totalVol: number; totalWeight: number } {
  const eps: EP[] = [{ x: 0, y: 0, z: 0 }];
  const placed: PlacedItem[] = [];
  let totalVol = 0;
  let totalWeight = 0;

  /* AABB overlap check */
  const overlaps = (
    ax: number,
    ay: number,
    az: number,
    aw: number,
    ah: number,
    ad: number,
  ): boolean => {
    for (const p of placed) {
      if (
        ax < p.x + p.orientedWidth - 0.5 &&
        p.x < ax + aw - 0.5 &&
        ay < p.y + p.orientedHeight - 0.5 &&
        p.y < ay + ah - 0.5 &&
        az < p.z + p.orientedDepth - 0.5 &&
        p.z < az + ad - 0.5
      )
        return true;
    }
    return false;
  };

  /* fraction of bottom face resting on floor or other boxes */
  const supportRatio = (
    ax: number,
    az: number,
    aw: number,
    ad: number,
    ay: number,
  ): number => {
    if (ay < 1) return 1; // on the floor
    const area = aw * ad;
    let supported = 0;
    for (const p of placed) {
      if (Math.abs(p.y + p.orientedHeight - ay) < 1.5) {
        const ox = Math.max(
          0,
          Math.min(ax + aw, p.x + p.orientedWidth) - Math.max(ax, p.x),
        );
        const oz = Math.max(
          0,
          Math.min(az + ad, p.z + p.orientedDepth) - Math.max(az, p.z),
        );
        supported += ox * oz;
      }
    }
    return area > 0 ? Math.min(supported / area, 1) : 0;
  };

  /* contact surface area with walls + neighbouring boxes */
  const contactArea = (
    ax: number,
    ay: number,
    az: number,
    aw: number,
    ah: number,
    ad: number,
  ): number => {
    let c = 0;
    if (ay < 1) c += aw * ad; // floor
    if (ax < 1) c += ah * ad; // left wall
    if (ax + aw > cw - 1) c += ah * ad; // right wall
    if (az + ad > cd - 1) c += aw * ah; // front wall (cab)
    if (az < 1) c += aw * ah; // back wall (rear)
    for (const p of placed) {
      // x-face contact
      if (
        Math.abs(ax - (p.x + p.orientedWidth)) < 1.5 ||
        Math.abs(p.x - (ax + aw)) < 1.5
      ) {
        c +=
          Math.max(
            0,
            Math.min(ay + ah, p.y + p.orientedHeight) - Math.max(ay, p.y),
          ) *
          Math.max(
            0,
            Math.min(az + ad, p.z + p.orientedDepth) - Math.max(az, p.z),
          );
      }
      // z-face contact
      if (
        Math.abs(az - (p.z + p.orientedDepth)) < 1.5 ||
        Math.abs(p.z - (az + ad)) < 1.5
      ) {
        c +=
          Math.max(
            0,
            Math.min(ax + aw, p.x + p.orientedWidth) - Math.max(ax, p.x),
          ) *
          Math.max(
            0,
            Math.min(ay + ah, p.y + p.orientedHeight) - Math.max(ay, p.y),
          );
      }
      // y-face contact (top of item below)
      if (Math.abs(ay - (p.y + p.orientedHeight)) < 1.5) {
        c +=
          Math.max(
            0,
            Math.min(ax + aw, p.x + p.orientedWidth) - Math.max(ax, p.x),
          ) *
          Math.max(
            0,
            Math.min(az + ad, p.z + p.orientedDepth) - Math.max(az, p.z),
          );
      }
    }
    return c;
  };

  for (const item of orderedItems) {
    if (totalWeight + item.weight > maxW) continue; // enforce weight limit

    let bestEP: EP | null = null;
    let bestDims: number[] = [];
    let bestScore = -Infinity;

    // Constraint-aware orientations
    let orientations: [number, number, number][];
    if (item.doNotRotate) {
      orientations = [[item.width, item.height, item.depth]];
    } else if (item.keepUpright) {
      // Keep original height as Y-axis, allow X-Z rotation
      orientations = [
        [item.width, item.height, item.depth],
        [item.depth, item.height, item.width],
      ];
    } else {
      orientations = [
        [item.width, item.height, item.depth],
        [item.width, item.depth, item.height],
        [item.height, item.width, item.depth],
        [item.height, item.depth, item.width],
        [item.depth, item.width, item.height],
        [item.depth, item.height, item.width],
      ];
    }

    for (const ep of eps) {
      for (const [ow, oh, od] of orientations) {
        if (
          ep.x + ow > cw + 0.5 ||
          ep.y + oh > ch + 0.5 ||
          ep.z + od > cd + 0.5
        )
          continue;
        if (overlaps(ep.x, ep.y, ep.z, ow, oh, od)) continue;

        const sup = supportRatio(ep.x, ep.z, ow, od, ep.y);
        if (sup < 0.25 && ep.y > 1) continue; // need 25% support

        const ca = contactArea(ep.x, ep.y, ep.z, ow, oh, od);
        const score =
          -ep.y * 500 + // strongly prefer lower positions
          ca * 1.0 + // more contact = tighter fit
          sup * 300 - // well-supported placement
          ep.x * 0.2 - // slight left-preference
          ep.z * 0.1 - // slight back-preference
          oh * 0.3; // prefer laying items flat

        if (score > bestScore) {
          bestScore = score;
          bestEP = ep;
          bestDims = [ow, oh, od];
        }
      }
    }

    if (bestEP) {
      const [ow, oh, od] = bestDims;
      placed.push({
        ...item,
        x: bestEP.x,
        y: bestEP.y,
        z: bestEP.z,
        orientedWidth: ow,
        orientedHeight: oh,
        orientedDepth: od,
      });
      totalVol += ow * oh * od;
      totalWeight += item.weight;

      // Generate new extreme points (basic + projected)
      const cands: EP[] = [
        { x: bestEP.x + ow, y: bestEP.y, z: bestEP.z },
        { x: bestEP.x, y: bestEP.y, z: bestEP.z + od },
        { x: bestEP.x + ow, y: bestEP.y, z: bestEP.z + od },
      ];
      // Only allow stacking on top if item is stackable
      if (item.stackable !== false) {
        cands.push(
          { x: bestEP.x, y: bestEP.y + oh, z: bestEP.z },
          { x: bestEP.x + ow, y: bestEP.y + oh, z: bestEP.z },
          { x: bestEP.x, y: bestEP.y + oh, z: bestEP.z + od },
        );
      }
      // Projected EPs: drop to floor for gap filling
      if (bestEP.y > 1) {
        cands.push({ x: bestEP.x + ow, y: 0, z: bestEP.z });
        cands.push({ x: bestEP.x, y: 0, z: bestEP.z + od });
      }

      for (const c of cands) {
        if (c.x > cw + 0.5 || c.y > ch + 0.5 || c.z > cd + 0.5) continue;
        let inside = false;
        for (const p of placed) {
          if (
            c.x >= p.x + 0.5 &&
            c.x < p.x + p.orientedWidth - 0.5 &&
            c.y >= p.y + 0.5 &&
            c.y < p.y + p.orientedHeight - 0.5 &&
            c.z >= p.z + 0.5 &&
            c.z < p.z + p.orientedDepth - 0.5
          ) {
            inside = true;
            break;
          }
        }
        if (!inside) eps.push(c);
      }

      // Remove stale EPs now inside placed items
      for (let i = eps.length - 1; i >= 0; i--) {
        const e = eps[i];
        for (const p of placed) {
          if (
            e.x >= p.x + 0.5 &&
            e.x < p.x + p.orientedWidth - 0.5 &&
            e.y >= p.y + 0.5 &&
            e.y < p.y + p.orientedHeight - 0.5 &&
            e.z >= p.z + 0.5 &&
            e.z < p.z + p.orientedDepth - 0.5
          ) {
            eps.splice(i, 1);
            break;
          }
        }
      }

      // Sort EPs: bottom → back → left
      eps.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 1) return a.y - b.y;
        if (Math.abs(a.z - b.z) > 1) return a.z - b.z;
        return a.x - b.x;
      });
    }
  }

  return { placed, totalVol, totalWeight };
}

/**
 * Advanced client-side 3D bin-packing with multi-strategy optimisation.
 *
 * 1. Filters items that physically fit the container.
 * 2. Runs 6 sort heuristics (volume ↓, vol/weight ↓, face-area ↓,
 *    tallest-dim ↓, lightest ↑, smallest ↑).
 * 3. Picks the trial that maximises volume utilisation.
 * 4. Enforces weight limits + physical support constraints.
 */
export function clientSidePack(
  container: ClientContainer,
  items: ClientPackingItem[],
): {
  placements: PlacedItem[];
  unpacked: ClientPackingItem[];
  utilization: number;
  steps: any[];
} {
  const { width: CW, height: CH, depth: CD, maxWeight: MW } = container;
  const containerVol = CW * CH * CD;

  // 1. Keep only items that physically fit in at least one orientation
  const fittable = items.filter((item) => {
    const d = [item.width, item.height, item.depth].sort((a, b) => a - b);
    const c = [CW, CH, CD].sort((a, b) => a - b);
    return d[0] <= c[0] + 0.5 && d[1] <= c[1] + 0.5 && d[2] <= c[2] + 0.5;
  });

  // 2. Six complementary sort strategies
  const strategies: ((a: ClientPackingItem, b: ClientPackingItem) => number)[] =
    [
      // volume ↓
      (a, b) => itemVol(b) - itemVol(a),
      // vol/weight ↓ (bulky-but-light items first)
      (a, b) =>
        itemVol(b) / Math.max(b.weight, 1) - itemVol(a) / Math.max(a.weight, 1),
      // max face area ↓
      (a, b) => maxFace(b) - maxFace(a),
      // tallest dimension ↓
      (a, b) =>
        Math.max(b.width, b.height, b.depth) -
        Math.max(a.width, a.height, a.depth),
      // lightest ↑ (pack many light items → high volume fill)
      (a, b) => a.weight - b.weight,
      // smallest volume ↑ (many small items fill gaps well)
      (a, b) => itemVol(a) - itemVol(b),
    ];

  // 3. Run each strategy and keep the one with highest utilisation
  let best = { placed: [] as PlacedItem[], totalVol: 0, totalWeight: 0 };
  for (const sortFn of strategies) {
    const sorted = [...fittable].sort(sortFn);
    const result = epPack(CW, CH, CD, MW, sorted);
    if (result.totalVol > best.totalVol) best = result;
  }

  const placedIds = new Set(best.placed.map((p) => p.id));
  const unpacked = items.filter((it) => !placedIds.has(it.id));

  // 4. Build animation steps
  const steps: any[] = [];
  let runVol = 0;
  let runW = 0;
  for (let i = 0; i < best.placed.length; i++) {
    const p = best.placed[i];
    runVol += p.orientedWidth * p.orientedHeight * p.orientedDepth;
    runW += p.weight;
    steps.push({
      step_number: i + 1,
      action: "place",
      item_id: p.id,
      item_label: p.label,
      position: { x: p.x, y: p.y, z: p.z },
      orientation: 0,
      oriented_dims: [p.orientedWidth, p.orientedHeight, p.orientedDepth],
      utilization_pct: (runVol / containerVol) * 100,
      weight_utilization_pct: (runW / MW) * 100,
      items_placed: i + 1,
      total_items: best.placed.length,
      center_of_gravity: [0, 0, 0],
      color: p.color,
    });
  }

  return {
    placements: best.placed,
    unpacked,
    utilization: containerVol > 0 ? (best.totalVol / containerVol) * 100 : 0,
    steps,
  };
}
