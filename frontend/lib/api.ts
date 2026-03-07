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
      throw new Error("Cannot connect to backend server. Please ensure the Flask backend is running on http://localhost:5000");
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
      throw new Error("Cannot connect to backend server. Please ensure the Flask backend is running on http://localhost:5000");
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
