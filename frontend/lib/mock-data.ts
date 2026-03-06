// ============================================================
// MOCK DATA — Realistic Indian Logistics Demo Data
// ============================================================

export interface Shipment {
  id: string;
  shipmentCode: string;
  originCity: string;
  originLat: number;
  originLng: number;
  destCity: string;
  destLat: number;
  destLng: number;
  weightKg: number;
  volumeM3: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  priority: 'normal' | 'express' | 'critical';
  cargoType: 'general' | 'fragile' | 'refrigerated' | 'hazardous';
  status: 'pending' | 'consolidated' | 'in_transit' | 'delivered';
  createdAt: string;
}

export interface Vehicle {
  id: string;
  name: string;
  type: string;
  maxWeightKg: number;
  maxVolumeM3: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  costPerKm: number;
  emissionFactor: number;
  isAvailable: boolean;
}

export interface Cluster {
  id: string;
  planId: string;
  vehicleId: string;
  vehicleName: string;
  shipmentIds: string[];
  utilizationPct: number;
  totalWeight: number;
  totalVolume: number;
  routeDistanceKm: number;
  estimatedCost: number;
  estimatedCo2: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ConsolidationPlan {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'completed';
  totalShipments: number;
  totalClusters: number;
  avgUtilization: number;
  totalCostBefore: number;
  totalCostAfter: number;
  co2Before: number;
  co2After: number;
  tripsBefore: number;
  tripsAfter: number;
  createdAt: string;
  clusters: Cluster[];
}

export interface ActivityItem {
  id: string;
  type: 'consolidation' | 'shipment' | 'alert' | 'optimization';
  message: string;
  timestamp: string;
  icon: string;
}

export interface DashboardKPI {
  label: string;
  value: number;
  suffix: string;
  change: number;
  changeLabel: string;
  icon: string;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  city: string;
  type: 'pickup' | 'delivery' | 'depot';
}

export interface Route {
  id: string;
  clusterId: string;
  vehicleName: string;
  points: RoutePoint[];
  totalDistanceKm: number;
  estimatedTime: string;
  fuelCost: number;
  color: string;
}

export interface CarbonMetric {
  month: string;
  co2Before: number;
  co2After: number;
  savings: number;
}

export interface ScenarioResult {
  name: string;
  totalTrips: number;
  avgUtilization: number;
  totalCost: number;
  co2Emissions: number;
  deliverySlaMet: number;
}

// ---- Cities Dataset ----
const CITIES = [
  { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
  { name: 'Kochi', lat: 9.9312, lng: 76.2673 },
  { name: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  { name: 'Surat', lat: 21.1702, lng: 72.8311 },
  { name: 'Vadodara', lat: 22.3072, lng: 73.1812 },
  { name: 'Indore', lat: 22.7196, lng: 75.8577 },
];

// ---- Generate Shipments ----
const priorities: Shipment['priority'][] = ['normal', 'express', 'critical'];
const cargoTypes: Shipment['cargoType'][] = ['general', 'fragile', 'refrigerated', 'hazardous'];
const statuses: Shipment['status'][] = ['pending', 'consolidated', 'in_transit', 'delivered'];

function generateShipments(count: number): Shipment[] {
  const shipments: Shipment[] = [];
  for (let i = 0; i < count; i++) {
    const origin = CITIES[Math.floor(Math.random() * CITIES.length)];
    let dest = CITIES[Math.floor(Math.random() * CITIES.length)];
    while (dest.name === origin.name) {
      dest = CITIES[Math.floor(Math.random() * CITIES.length)];
    }
    const weight = Math.floor(50 + Math.random() * 4950);
    const length = Math.floor(50 + Math.random() * 250);
    const width = Math.floor(40 + Math.random() * 160);
    const height = Math.floor(30 + Math.random() * 170);
    const volume = parseFloat(((length * width * height) / 1000000).toFixed(2));
    
    shipments.push({
      id: `shp-${String(i + 1).padStart(4, '0')}`,
      shipmentCode: `SHP-${String(i + 1).padStart(4, '0')}`,
      originCity: origin.name,
      originLat: origin.lat + (Math.random() - 0.5) * 0.1,
      originLng: origin.lng + (Math.random() - 0.5) * 0.1,
      destCity: dest.name,
      destLat: dest.lat + (Math.random() - 0.5) * 0.1,
      destLng: dest.lng + (Math.random() - 0.5) * 0.1,
      weightKg: weight,
      volumeM3: volume,
      lengthCm: length,
      widthCm: width,
      heightCm: height,
      deliveryWindowStart: '2026-03-07T08:00:00Z',
      deliveryWindowEnd: '2026-03-08T18:00:00Z',
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      cargoType: cargoTypes[Math.floor(Math.random() * cargoTypes.length)],
      status: i < 90 ? 'pending' : statuses[Math.floor(Math.random() * statuses.length)],
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000).toISOString(),
    });
  }
  return shipments;
}

export const mockShipments: Shipment[] = generateShipments(150);

// ---- Vehicles ----
export const mockVehicles: Vehicle[] = [
  { id: 'v1', name: 'Tata 407', type: 'Light Truck', maxWeightKg: 2500, maxVolumeM3: 14, lengthCm: 430, widthCm: 180, heightCm: 180, costPerKm: 12, emissionFactor: 0.09, isAvailable: true },
  { id: 'v2', name: 'Eicher 10.59', type: 'Medium Truck', maxWeightKg: 7000, maxVolumeM3: 28, lengthCm: 600, widthCm: 230, heightCm: 200, costPerKm: 18, emissionFactor: 0.075, isAvailable: true },
  { id: 'v3', name: 'Ashok Leyland 1612', type: 'Heavy Truck', maxWeightKg: 12000, maxVolumeM3: 42, lengthCm: 720, widthCm: 240, heightCm: 240, costPerKm: 24, emissionFactor: 0.062, isAvailable: true },
  { id: 'v4', name: 'Tata Prima 4028', type: 'Trailer', maxWeightKg: 25000, maxVolumeM3: 70, lengthCm: 1220, widthCm: 245, heightCm: 270, costPerKm: 32, emissionFactor: 0.055, isAvailable: true },
  { id: 'v5', name: 'BharatBenz 2823', type: 'Heavy Truck', maxWeightKg: 18000, maxVolumeM3: 55, lengthCm: 900, widthCm: 240, heightCm: 250, costPerKm: 28, emissionFactor: 0.058, isAvailable: true },
  { id: 'v6', name: 'Mahindra Blazo 25', type: 'Heavy Truck', maxWeightKg: 16000, maxVolumeM3: 48, lengthCm: 800, widthCm: 240, heightCm: 240, costPerKm: 26, emissionFactor: 0.06, isAvailable: false },
];

// ---- Consolidation Plans ----
const clusterData: Cluster[] = [
  { id: 'cl-001', planId: 'plan-001', vehicleId: 'v3', vehicleName: 'Ashok Leyland 1612', shipmentIds: ['shp-0001','shp-0005','shp-0012','shp-0018','shp-0025'], utilizationPct: 91, totalWeight: 10920, totalVolume: 38.2, routeDistanceKm: 1420, estimatedCost: 34080, estimatedCo2: 96.5, status: 'accepted' },
  { id: 'cl-002', planId: 'plan-001', vehicleId: 'v4', vehicleName: 'Tata Prima 4028', shipmentIds: ['shp-0002','shp-0007','shp-0009','shp-0013','shp-0020','shp-0031'], utilizationPct: 87, totalWeight: 21750, totalVolume: 60.9, routeDistanceKm: 1850, estimatedCost: 59200, estimatedCo2: 148.2, status: 'accepted' },
  { id: 'cl-003', planId: 'plan-001', vehicleId: 'v2', vehicleName: 'Eicher 10.59', shipmentIds: ['shp-0003','shp-0008','shp-0015'], utilizationPct: 78, totalWeight: 5460, totalVolume: 21.8, routeDistanceKm: 680, estimatedCost: 12240, estimatedCo2: 34.2, status: 'pending' },
  { id: 'cl-004', planId: 'plan-001', vehicleId: 'v5', vehicleName: 'BharatBenz 2823', shipmentIds: ['shp-0004','shp-0010','shp-0016','shp-0022','shp-0028'], utilizationPct: 84, totalWeight: 15120, totalVolume: 46.2, routeDistanceKm: 2100, estimatedCost: 58800, estimatedCo2: 168.4, status: 'pending' },
  { id: 'cl-005', planId: 'plan-001', vehicleId: 'v1', vehicleName: 'Tata 407', shipmentIds: ['shp-0006','shp-0011'], utilizationPct: 72, totalWeight: 1800, totalVolume: 10.1, routeDistanceKm: 340, estimatedCost: 4080, estimatedCo2: 15.3, status: 'pending' },
  { id: 'cl-006', planId: 'plan-001', vehicleId: 'v3', vehicleName: 'Ashok Leyland 1612', shipmentIds: ['shp-0014','shp-0019','shp-0023','shp-0027'], utilizationPct: 89, totalWeight: 10680, totalVolume: 37.4, routeDistanceKm: 1680, estimatedCost: 40320, estimatedCo2: 114.2, status: 'accepted' },
  { id: 'cl-007', planId: 'plan-001', vehicleId: 'v2', vehicleName: 'Eicher 10.59', shipmentIds: ['shp-0017','shp-0024','shp-0030'], utilizationPct: 65, totalWeight: 4550, totalVolume: 18.2, routeDistanceKm: 520, estimatedCost: 9360, estimatedCo2: 26.1, status: 'rejected' },
];

export const mockConsolidationPlan: ConsolidationPlan = {
  id: 'plan-001',
  name: 'Daily Consolidation — March 7, 2026',
  status: 'active',
  totalShipments: 150,
  totalClusters: 31,
  avgUtilization: 87,
  totalCostBefore: 450000,
  totalCostAfter: 310000,
  co2Before: 2400,
  co2After: 1600,
  tripsBefore: 47,
  tripsAfter: 31,
  createdAt: '2026-03-07T06:00:00Z',
  clusters: clusterData,
};

// ---- Dashboard KPIs ----
export const mockDashboardKPIs: DashboardKPI[] = [
  { label: 'Total Shipments', value: 150, suffix: '', change: 12, changeLabel: 'vs yesterday', icon: 'package' },
  { label: 'Consolidation Rate', value: 87, suffix: '%', change: 5.2, changeLabel: 'vs last week', icon: 'layers' },
  { label: 'Avg Utilization', value: 87, suffix: '%', change: 29, changeLabel: 'improvement', icon: 'gauge' },
  { label: 'Cost Savings', value: 140000, suffix: '₹', change: 31, changeLabel: 'reduction', icon: 'indian-rupee' },
  { label: 'CO₂ Reduced', value: 800, suffix: ' kg', change: 33, changeLabel: 'reduction', icon: 'leaf' },
  { label: 'Trips Eliminated', value: 16, suffix: '', change: 34, changeLabel: 'fewer trips', icon: 'truck' },
];

// ---- Utilization Trend ----
export const mockUtilizationTrend = [
  { day: 'Feb 5', utilization: 54, cost: 480000, co2: 2600 },
  { day: 'Feb 8', utilization: 58, cost: 460000, co2: 2500 },
  { day: 'Feb 11', utilization: 61, cost: 440000, co2: 2400 },
  { day: 'Feb 14', utilization: 65, cost: 420000, co2: 2300 },
  { day: 'Feb 17', utilization: 68, cost: 410000, co2: 2200 },
  { day: 'Feb 20', utilization: 72, cost: 390000, co2: 2100 },
  { day: 'Feb 23', utilization: 75, cost: 370000, co2: 2000 },
  { day: 'Feb 26', utilization: 78, cost: 350000, co2: 1900 },
  { day: 'Mar 1', utilization: 82, cost: 340000, co2: 1800 },
  { day: 'Mar 4', utilization: 85, cost: 320000, co2: 1700 },
  { day: 'Mar 7', utilization: 87, cost: 310000, co2: 1600 },
];

// ---- Activity Feed ----
export const mockActivityFeed: ActivityItem[] = [
  { id: 'a1', type: 'consolidation', message: 'Consolidation plan "March 7 Daily" created — 31 clusters from 150 shipments', timestamp: '2 min ago', icon: 'layers' },
  { id: 'a2', type: 'optimization', message: 'Route optimization complete — 34% fewer trips, ₹1.4L saved', timestamp: '5 min ago', icon: 'route' },
  { id: 'a3', type: 'shipment', message: '12 new shipments uploaded from CSV — Delhi → Mumbai route', timestamp: '15 min ago', icon: 'upload' },
  { id: 'a4', type: 'alert', message: '8 Chennai-bound shipments detected — consolidation could save ₹18,000', timestamp: '32 min ago', icon: 'alert-triangle' },
  { id: 'a5', type: 'consolidation', message: 'Cluster CL-001 accepted by logistics manager', timestamp: '1 hr ago', icon: 'check-circle' },
  { id: 'a6', type: 'shipment', message: 'Priority shipment SHP-0089 marked as Critical', timestamp: '2 hrs ago', icon: 'alert-circle' },
  { id: 'a7', type: 'optimization', message: '3D bin packing optimized — vehicle utilization up to 91%', timestamp: '3 hrs ago', icon: 'box' },
];

// ---- Routes ----
export const mockRoutes: Route[] = [
  {
    id: 'r1', clusterId: 'cl-001', vehicleName: 'Ashok Leyland 1612', color: '#06b6d4',
    points: [
      { lat: 28.6139, lng: 77.209, city: 'Delhi (Depot)', type: 'depot' },
      { lat: 26.9124, lng: 75.787, city: 'Jaipur', type: 'pickup' },
      { lat: 23.0225, lng: 72.571, city: 'Ahmedabad', type: 'delivery' },
      { lat: 19.076, lng: 72.877, city: 'Mumbai', type: 'delivery' },
    ],
    totalDistanceKm: 1420, estimatedTime: '22h 15m', fuelCost: 34080,
  },
  {
    id: 'r2', clusterId: 'cl-002', vehicleName: 'Tata Prima 4028', color: '#8b5cf6',
    points: [
      { lat: 19.076, lng: 72.877, city: 'Mumbai (Depot)', type: 'depot' },
      { lat: 18.5204, lng: 73.856, city: 'Pune', type: 'pickup' },
      { lat: 17.385, lng: 78.486, city: 'Hyderabad', type: 'delivery' },
      { lat: 12.9716, lng: 77.594, city: 'Bangalore', type: 'delivery' },
      { lat: 13.0827, lng: 80.270, city: 'Chennai', type: 'delivery' },
    ],
    totalDistanceKm: 1850, estimatedTime: '28h 40m', fuelCost: 59200,
  },
  {
    id: 'r3', clusterId: 'cl-003', vehicleName: 'Eicher 10.59', color: '#f59e0b',
    points: [
      { lat: 28.6139, lng: 77.209, city: 'Delhi (Depot)', type: 'depot' },
      { lat: 26.8467, lng: 80.946, city: 'Lucknow', type: 'pickup' },
      { lat: 22.5726, lng: 88.363, city: 'Kolkata', type: 'delivery' },
    ],
    totalDistanceKm: 680, estimatedTime: '11h 20m', fuelCost: 12240,
  },
  {
    id: 'r4', clusterId: 'cl-004', vehicleName: 'BharatBenz 2823', color: '#10b981',
    points: [
      { lat: 12.9716, lng: 77.594, city: 'Bangalore (Depot)', type: 'depot' },
      { lat: 9.9312, lng: 76.267, city: 'Kochi', type: 'pickup' },
      { lat: 13.0827, lng: 80.270, city: 'Chennai', type: 'delivery' },
      { lat: 17.385, lng: 78.486, city: 'Hyderabad', type: 'delivery' },
      { lat: 21.1458, lng: 79.088, city: 'Nagpur', type: 'delivery' },
    ],
    totalDistanceKm: 2100, estimatedTime: '32h 10m', fuelCost: 58800,
  },
];

// ---- Carbon Metrics ----
export const mockCarbonMonthly: CarbonMetric[] = [
  { month: 'Oct', co2Before: 2800, co2After: 2200, savings: 600 },
  { month: 'Nov', co2Before: 2650, co2After: 1950, savings: 700 },
  { month: 'Dec', co2Before: 2900, co2After: 2050, savings: 850 },
  { month: 'Jan', co2Before: 2500, co2After: 1750, savings: 750 },
  { month: 'Feb', co2Before: 2600, co2After: 1800, savings: 800 },
  { month: 'Mar', co2Before: 2400, co2After: 1600, savings: 800 },
];

export const mockCarbonBreakdown = [
  { category: 'Heavy Trucks', before: 1200, after: 780, color: '#06b6d4' },
  { category: 'Medium Trucks', before: 600, after: 420, color: '#8b5cf6' },
  { category: 'Light Trucks', before: 400, after: 280, color: '#f59e0b' },
  { category: 'Trailers', before: 200, after: 120, color: '#10b981' },
];

// ---- Scenarios ----
export const mockScenarios: ScenarioResult[] = [
  { name: 'No Consolidation', totalTrips: 47, avgUtilization: 58, totalCost: 450000, co2Emissions: 2400, deliverySlaMet: 95 },
  { name: 'AI Optimized', totalTrips: 31, avgUtilization: 87, totalCost: 310000, co2Emissions: 1600, deliverySlaMet: 97 },
  { name: 'Custom Config', totalTrips: 36, avgUtilization: 78, totalCost: 340000, co2Emissions: 1800, deliverySlaMet: 96 },
];

// ---- Chat Messages ----
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: { label: string; type: string }[];
}

export const mockChatHistory: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    content: "👋 Hello! I'm Lorri, your AI logistics co-pilot. I can help you with shipment consolidation, route optimization, and capacity planning. What would you like to know?",
    timestamp: '10:00 AM',
  },
];

export const suggestedPrompts = [
  "Which Mumbai shipments can be merged tomorrow?",
  "Show me routes with less than 60% utilization",
  "What's the best vehicle for the Pune cluster?",
  "What if I add 5 more shipments to cluster 3?",
  "Generate a consolidation report for today",
  "How much CO₂ can we save this week?",
];

// ---- Reports ----
export interface Report {
  id: string;
  name: string;
  type: string;
  description: string;
  lastGenerated: string;
  icon: string;
}

export const mockReports: Report[] = [
  { id: 'rpt-1', name: 'Daily Consolidation Summary', type: 'consolidation', description: 'Overview of all consolidation activities, cluster assignments, and savings achieved today.', lastGenerated: '2026-03-07 06:00', icon: 'layers' },
  { id: 'rpt-2', name: 'Vehicle Utilization Report', type: 'utilization', description: 'Detailed breakdown of vehicle utilization rates, load factors, and capacity analysis.', lastGenerated: '2026-03-06 18:00', icon: 'gauge' },
  { id: 'rpt-3', name: 'Cost Savings Analysis', type: 'cost', description: 'Comprehensive cost comparison before and after consolidation with ROI metrics.', lastGenerated: '2026-03-06 12:00', icon: 'indian-rupee' },
  { id: 'rpt-4', name: 'Carbon Impact Report', type: 'carbon', description: 'ESG-aligned sustainability report showing CO₂ reduction and environmental impact.', lastGenerated: '2026-03-05 18:00', icon: 'leaf' },
  { id: 'rpt-5', name: 'Route Efficiency Report', type: 'route', description: 'Analysis of route optimization results, distance savings, and time improvements.', lastGenerated: '2026-03-05 06:00', icon: 'map' },
];

// ---- Settings ----
export interface DepotLocation {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
}

export const mockDepots: DepotLocation[] = [
  { id: 'd1', name: 'Delhi Hub', city: 'Delhi', lat: 28.6139, lng: 77.209 },
  { id: 'd2', name: 'Mumbai Port', city: 'Mumbai', lat: 19.076, lng: 72.877 },
  { id: 'd3', name: 'Bangalore Center', city: 'Bangalore', lat: 12.9716, lng: 77.594 },
  { id: 'd4', name: 'Chennai Warehouse', city: 'Chennai', lat: 13.0827, lng: 80.270 },
];

export const mockCostParams = {
  fuelCostPerKm: 8.5,
  driverCostPerHr: 150,
  tollAvgPerTrip: 1200,
  maintenanceCostPerKm: 2.5,
};
