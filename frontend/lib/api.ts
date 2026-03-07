const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
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
  const res = await fetch(`${API_BASE}/api/shipments/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload error: ${res.status}`);
  return res.json();
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

export async function getDepots() {
  return fetchApi<any[]>("/api/depots");
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
