-- ============================================================
-- LORRI — Supabase Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- DROP ALL TABLES (in reverse dependency order)
-- ============================================================
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS cluster_shipments CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS clusters CASCADE;
DROP TABLE IF EXISTS consolidation_plans CASCADE;
DROP TABLE IF EXISTS activity_feed CASCADE;
DROP TABLE IF EXISTS dashboard_kpis CASCADE;
DROP TABLE IF EXISTS utilization_trend CASCADE;
DROP TABLE IF EXISTS carbon_monthly CASCADE;
DROP TABLE IF EXISTS carbon_breakdown CASCADE;
DROP TABLE IF EXISTS scenarios CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS cost_params CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS depots CASCADE;
DROP TABLE IF EXISTS cities CASCADE;

-- ============================================================
-- CITIES (reference table)
-- ============================================================
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL
);

-- ============================================================
-- SHIPMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_code TEXT UNIQUE,
  origin_city TEXT,
  origin_lat FLOAT,
  origin_lng FLOAT,
  dest_city TEXT,
  dest_lat FLOAT,
  dest_lng FLOAT,
  weight_kg FLOAT,
  volume_m3 FLOAT,
  length_cm FLOAT,
  width_cm FLOAT,
  height_cm FLOAT,
  delivery_window_start TIMESTAMPTZ,
  delivery_window_end TIMESTAMPTZ,
  priority TEXT DEFAULT 'normal',
  cargo_type TEXT DEFAULT 'general',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT,
  max_weight_kg FLOAT,
  max_volume_m3 FLOAT,
  length_cm FLOAT,
  width_cm FLOAT,
  height_cm FLOAT,
  cost_per_km FLOAT,
  emission_factor FLOAT,
  is_available BOOLEAN DEFAULT true
);

-- ============================================================
-- DEPOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS depots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  city TEXT,
  lat FLOAT,
  lng FLOAT
);

-- ============================================================
-- CONSOLIDATION PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS consolidation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  status TEXT DEFAULT 'draft',
  total_shipments INT,
  total_clusters INT,
  avg_utilization FLOAT,
  total_cost_before FLOAT,
  total_cost_after FLOAT,
  co2_before FLOAT,
  co2_after FLOAT,
  trips_before INT,
  trips_after INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CLUSTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES consolidation_plans(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  vehicle_name TEXT,
  utilization_pct FLOAT,
  total_weight FLOAT,
  total_volume FLOAT,
  route_distance_km FLOAT,
  estimated_cost FLOAT,
  estimated_co2 FLOAT,
  status TEXT DEFAULT 'pending',
  route_geometry JSONB,
  packing_layout JSONB
);

-- ============================================================
-- CLUSTER ↔ SHIPMENT MAPPING
-- ============================================================
CREATE TABLE IF NOT EXISTS cluster_shipments (
  cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  load_order INT,
  position_x FLOAT,
  position_y FLOAT,
  position_z FLOAT,
  PRIMARY KEY (cluster_id, shipment_id)
);

-- ============================================================
-- ROUTES
-- ============================================================
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
  vehicle_name TEXT,
  points JSONB NOT NULL DEFAULT '[]',
  total_distance_km FLOAT,
  estimated_time TEXT,
  fuel_cost FLOAT,
  color TEXT DEFAULT '#635BFF'
);

-- ============================================================
-- CARBON MONTHLY METRICS
-- ============================================================
CREATE TABLE IF NOT EXISTS carbon_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT,
  co2_before FLOAT,
  co2_after FLOAT,
  savings FLOAT
);

-- ============================================================
-- CARBON BREAKDOWN
-- ============================================================
CREATE TABLE IF NOT EXISTS carbon_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  co2_before FLOAT,
  co2_after FLOAT,
  color TEXT
);

-- ============================================================
-- SCENARIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  total_trips INT,
  avg_utilization FLOAT,
  total_cost FLOAT,
  co2_emissions FLOAT,
  delivery_sla_met FLOAT
);

-- ============================================================
-- UTILIZATION TREND
-- ============================================================
CREATE TABLE IF NOT EXISTS utilization_trend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day TEXT,
  utilization FLOAT,
  cost FLOAT,
  co2 FLOAT
);

-- ============================================================
-- ACTIVITY FEED
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT,
  message TEXT,
  timestamp TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DASHBOARD KPIs
-- ============================================================
CREATE TABLE IF NOT EXISTS dashboard_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT,
  value FLOAT,
  suffix TEXT DEFAULT '',
  change FLOAT,
  change_label TEXT,
  icon TEXT
);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT,
  actions JSONB,
  session_id TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT,
  description TEXT,
  last_generated TEXT,
  icon TEXT
);

-- ============================================================
-- COST PARAMETERS
-- ============================================================
CREATE TABLE IF NOT EXISTS cost_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_cost_per_km FLOAT DEFAULT 8.5,
  driver_cost_per_hr FLOAT DEFAULT 150,
  toll_avg_per_trip FLOAT DEFAULT 1200,
  maintenance_cost_per_km FLOAT DEFAULT 2.5
);

-- ============================================================
-- FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
  action TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY — Disable for hackathon (anon access)
-- ============================================================
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE depots ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_breakdown ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilization_trend ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow anon read/write for all tables (hackathon demo)
CREATE POLICY "Allow all for anon" ON cities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shipments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON depots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON consolidation_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON clusters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON cluster_shipments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON routes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON carbon_monthly FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON carbon_breakdown FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON scenarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON utilization_trend FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON activity_feed FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON dashboard_kpis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON cost_params FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON feedback FOR ALL USING (true) WITH CHECK (true);
