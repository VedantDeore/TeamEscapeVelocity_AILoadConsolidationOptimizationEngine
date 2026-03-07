"""
Lorri — Seed Supabase with demo data.
Run: python seed_data.py
"""

import os
import random
import math
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---- Reference Data ----
CITIES = [
    {"name": "Delhi", "lat": 28.6139, "lng": 77.2090},
    {"name": "Mumbai", "lat": 19.0760, "lng": 72.8777},
    {"name": "Chennai", "lat": 13.0827, "lng": 80.2707},
    {"name": "Kolkata", "lat": 22.5726, "lng": 88.3639},
    {"name": "Bangalore", "lat": 12.9716, "lng": 77.5946},
    {"name": "Pune", "lat": 18.5204, "lng": 73.8567},
    {"name": "Ahmedabad", "lat": 23.0225, "lng": 72.5714},
    {"name": "Hyderabad", "lat": 17.3850, "lng": 78.4867},
    {"name": "Jaipur", "lat": 26.9124, "lng": 75.7873},
    {"name": "Lucknow", "lat": 26.8467, "lng": 80.9462},
    {"name": "Kochi", "lat": 9.9312, "lng": 76.2673},
    {"name": "Nagpur", "lat": 21.1458, "lng": 79.0882},
    {"name": "Surat", "lat": 21.1702, "lng": 72.8311},
    {"name": "Vadodara", "lat": 22.3072, "lng": 73.1812},
    {"name": "Indore", "lat": 22.7196, "lng": 75.8577},
]

# MOCK VEHICLES DATA - COMMENTED OUT TO PREVENT SEEDING MOCK DATA
# Users should add vehicles through the Settings page instead
# VEHICLES_DATA = [
#     {"name": "Tata 407", "type": "Light Truck", "max_weight_kg": 2500, "max_volume_m3": 14, "length_cm": 430, "width_cm": 180, "height_cm": 180, "cost_per_km": 12, "emission_factor": 0.09, "is_available": True},
#     {"name": "Eicher 10.59", "type": "Medium Truck", "max_weight_kg": 7000, "max_volume_m3": 28, "length_cm": 600, "width_cm": 230, "height_cm": 200, "cost_per_km": 18, "emission_factor": 0.075, "is_available": True},
#     {"name": "Ashok Leyland 1612", "type": "Heavy Truck", "max_weight_kg": 12000, "max_volume_m3": 42, "length_cm": 720, "width_cm": 240, "height_cm": 240, "cost_per_km": 24, "emission_factor": 0.062, "is_available": True},
#     {"name": "Tata Prima 4028", "type": "Trailer", "max_weight_kg": 25000, "max_volume_m3": 70, "length_cm": 1220, "width_cm": 245, "height_cm": 270, "cost_per_km": 32, "emission_factor": 0.055, "is_available": True},
#     {"name": "BharatBenz 2823", "type": "Heavy Truck", "max_weight_kg": 18000, "max_volume_m3": 55, "length_cm": 900, "width_cm": 240, "height_cm": 250, "cost_per_km": 28, "emission_factor": 0.058, "is_available": True},
#     {"name": "Mahindra Blazo 25", "type": "Heavy Truck", "max_weight_kg": 16000, "max_volume_m3": 48, "length_cm": 800, "width_cm": 240, "height_cm": 240, "cost_per_km": 26, "emission_factor": 0.06, "is_available": False},
# ]

VEHICLES_DATA = []  # Empty - no mock vehicles will be seeded

DEPOTS_DATA = [
    {"name": "Delhi Hub", "city": "Delhi", "lat": 28.6139, "lng": 77.209},
    {"name": "Mumbai Port", "city": "Mumbai", "lat": 19.076, "lng": 72.877},
    {"name": "Bangalore Center", "city": "Bangalore", "lat": 12.9716, "lng": 77.594},
    {"name": "Chennai Warehouse", "city": "Chennai", "lat": 13.0827, "lng": 80.270},
]

PRIORITIES = ["normal", "express", "critical"]
CARGO_TYPES = ["general", "fragile", "refrigerated", "hazardous"]
STATUSES = ["pending", "consolidated", "in_transit", "delivered"]


def clear_all_tables():
    """Delete all existing data (order matters for FK constraints)."""
    tables = [
        "feedback", "cluster_shipments", "routes", "clusters",
        "consolidation_plans", "activity_feed", "dashboard_kpis",
        "utilization_trend", "carbon_monthly", "carbon_breakdown",
        "scenarios", "chat_messages", "reports", "cost_params",
        "shipments", "vehicles", "depots", "cities",
    ]
    for table in tables:
        try:
            # cluster_shipments has no 'id' column — use cluster_id for the filter
            if table == "cluster_shipments":
                supabase.table(table).delete().neq("cluster_id", "00000000-0000-0000-0000-000000000000").execute()
            else:
                supabase.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            print(f"  Cleared {table}")
        except Exception as e:
            print(f"  Skip {table}: {e}")

    # Notify PostgREST to reload its schema cache
    try:
        supabase.postgrest.schema("public")
    except Exception:
        pass


def seed_cities():
    print("Seeding cities...")
    supabase.table("cities").insert(CITIES).execute()
    print(f"  Inserted {len(CITIES)} cities")


def seed_vehicles():
    print("Seeding vehicles...")
    if not VEHICLES_DATA:
        print("  No vehicles to seed (VEHICLES_DATA is empty)")
        return {}
    result = supabase.table("vehicles").insert(VEHICLES_DATA).execute()
    # Return map of name → id
    return {v["name"]: v["id"] for v in result.data}


def seed_depots():
    print("Seeding depots...")
    if not DEPOTS_DATA:
        print("  No depots to seed (DEPOTS_DATA is empty)")
        return
    supabase.table("depots").insert(DEPOTS_DATA).execute()
    print(f"  Inserted {len(DEPOTS_DATA)} depots")


def seed_shipments(count=150):
    print(f"Seeding {count} shipments...")
    shipments = []
    now = datetime(2026, 3, 7, tzinfo=timezone.utc)

    for i in range(count):
        origin = random.choice(CITIES)
        dest = random.choice([c for c in CITIES if c["name"] != origin["name"]])
        weight = random.randint(50, 5000)
        length = random.randint(50, 300)
        width = random.randint(40, 200)
        height = random.randint(30, 200)
        volume = round((length * width * height) / 1_000_000, 2)

        # First 90 are pending for demo
        status = "pending" if i < 90 else random.choice(STATUSES)

        created_at = now - timedelta(days=random.uniform(0, 7))

        shipments.append({
            "shipment_code": f"SHP-{str(i+1).zfill(4)}",
            "origin_city": origin["name"],
            "origin_lat": round(origin["lat"] + (random.random() - 0.5) * 0.1, 6),
            "origin_lng": round(origin["lng"] + (random.random() - 0.5) * 0.1, 6),
            "dest_city": dest["name"],
            "dest_lat": round(dest["lat"] + (random.random() - 0.5) * 0.1, 6),
            "dest_lng": round(dest["lng"] + (random.random() - 0.5) * 0.1, 6),
            "weight_kg": weight,
            "volume_m3": volume,
            "length_cm": length,
            "width_cm": width,
            "height_cm": height,
            "delivery_window_start": "2026-03-07T08:00:00+00:00",
            "delivery_window_end": "2026-03-08T18:00:00+00:00",
            "priority": random.choice(PRIORITIES),
            "cargo_type": random.choice(CARGO_TYPES),
            "status": status,
            "created_at": created_at.isoformat(),
        })

    # Insert in batches of 50 (Supabase limit)
    for i in range(0, len(shipments), 50):
        batch = shipments[i : i + 50]
        supabase.table("shipments").insert(batch).execute()

    # Get all shipment IDs back
    result = supabase.table("shipments").select("id, shipment_code").order("shipment_code").execute()
    shipment_map = {s["shipment_code"]: s["id"] for s in result.data}
    print(f"  Inserted {len(shipments)} shipments")
    return shipment_map


def seed_consolidation(vehicle_map, shipment_map):
    print("Seeding consolidation plan + clusters...")

    # Insert plan
    plan_data = {
        "name": "Daily Consolidation — March 7, 2026",
        "status": "active",
        "total_shipments": 150,
        "total_clusters": 31,
        "avg_utilization": 87,
        "total_cost_before": 450000,
        "total_cost_after": 310000,
        "co2_before": 2400,
        "co2_after": 1600,
        "trips_before": 47,
        "trips_after": 31,
        "created_at": "2026-03-07T06:00:00+00:00",
    }
    plan_result = supabase.table("consolidation_plans").insert(plan_data).execute()
    plan_id = plan_result.data[0]["id"]

    # Cluster definitions with shipment code references
    clusters_def = [
        {"vehicle": "Ashok Leyland 1612", "shipments": ["SHP-0001","SHP-0005","SHP-0012","SHP-0018","SHP-0025"], "util": 91, "weight": 10920, "volume": 38.2, "dist": 1420, "cost": 34080, "co2": 96.5, "status": "accepted"},
        {"vehicle": "Tata Prima 4028", "shipments": ["SHP-0002","SHP-0007","SHP-0009","SHP-0013","SHP-0020","SHP-0031"], "util": 87, "weight": 21750, "volume": 60.9, "dist": 1850, "cost": 59200, "co2": 148.2, "status": "accepted"},
        {"vehicle": "Eicher 10.59", "shipments": ["SHP-0003","SHP-0008","SHP-0015"], "util": 78, "weight": 5460, "volume": 21.8, "dist": 680, "cost": 12240, "co2": 34.2, "status": "pending"},
        {"vehicle": "BharatBenz 2823", "shipments": ["SHP-0004","SHP-0010","SHP-0016","SHP-0022","SHP-0028"], "util": 84, "weight": 15120, "volume": 46.2, "dist": 2100, "cost": 58800, "co2": 168.4, "status": "pending"},
        {"vehicle": "Tata 407", "shipments": ["SHP-0006","SHP-0011"], "util": 72, "weight": 1800, "volume": 10.1, "dist": 340, "cost": 4080, "co2": 15.3, "status": "pending"},
        {"vehicle": "Ashok Leyland 1612", "shipments": ["SHP-0014","SHP-0019","SHP-0023","SHP-0027"], "util": 89, "weight": 10680, "volume": 37.4, "dist": 1680, "cost": 40320, "co2": 114.2, "status": "accepted"},
        {"vehicle": "Eicher 10.59", "shipments": ["SHP-0017","SHP-0024","SHP-0030"], "util": 65, "weight": 4550, "volume": 18.2, "dist": 520, "cost": 9360, "co2": 26.1, "status": "rejected"},
    ]

    cluster_ids = []
    for cd in clusters_def:
        vehicle_id = vehicle_map.get(cd["vehicle"])
        cluster_row = {
            "plan_id": plan_id,
            "vehicle_id": vehicle_id,
            "vehicle_name": cd["vehicle"],
            "utilization_pct": cd["util"],
            "total_weight": cd["weight"],
            "total_volume": cd["volume"],
            "route_distance_km": cd["dist"],
            "estimated_cost": cd["cost"],
            "estimated_co2": cd["co2"],
        }
        # Try with status; if column doesn't exist, insert without it
        try:
            row_with_status = {**cluster_row, "status": cd["status"]}
            cr = supabase.table("clusters").insert(row_with_status).execute()
        except Exception:
            cr = supabase.table("clusters").insert(cluster_row).execute()
        cid = cr.data[0]["id"]
        cluster_ids.append(cid)

        # Insert cluster-shipment mappings
        for idx, code in enumerate(cd["shipments"]):
            sid = shipment_map.get(code)
            if sid:
                supabase.table("cluster_shipments").insert({
                    "cluster_id": cid,
                    "shipment_id": sid,
                    "load_order": idx + 1,
                }).execute()

    print(f"  Inserted 1 plan, {len(clusters_def)} clusters")
    return plan_id, cluster_ids


def seed_routes(cluster_ids):
    print("Seeding routes...")
    routes_data = [
        {
            "cluster_id": cluster_ids[0],
            "vehicle_name": "Ashok Leyland 1612",
            "color": "#635BFF",
            "points": [
                {"lat": 28.6139, "lng": 77.209, "city": "Delhi (Depot)", "type": "depot"},
                {"lat": 26.9124, "lng": 75.787, "city": "Jaipur", "type": "pickup"},
                {"lat": 23.0225, "lng": 72.571, "city": "Ahmedabad", "type": "delivery"},
                {"lat": 19.076, "lng": 72.877, "city": "Mumbai", "type": "delivery"},
            ],
            "total_distance_km": 1420,
            "estimated_time": "22h 15m",
            "fuel_cost": 34080,
        },
        {
            "cluster_id": cluster_ids[1],
            "vehicle_name": "Tata Prima 4028",
            "color": "#0CAF60",
            "points": [
                {"lat": 19.076, "lng": 72.877, "city": "Mumbai (Depot)", "type": "depot"},
                {"lat": 18.5204, "lng": 73.856, "city": "Pune", "type": "pickup"},
                {"lat": 17.385, "lng": 78.486, "city": "Hyderabad", "type": "delivery"},
                {"lat": 12.9716, "lng": 77.594, "city": "Bangalore", "type": "delivery"},
                {"lat": 13.0827, "lng": 80.270, "city": "Chennai", "type": "delivery"},
            ],
            "total_distance_km": 1850,
            "estimated_time": "28h 40m",
            "fuel_cost": 59200,
        },
        {
            "cluster_id": cluster_ids[2],
            "vehicle_name": "Eicher 10.59",
            "color": "#E5850B",
            "points": [
                {"lat": 28.6139, "lng": 77.209, "city": "Delhi (Depot)", "type": "depot"},
                {"lat": 26.8467, "lng": 80.946, "city": "Lucknow", "type": "pickup"},
                {"lat": 22.5726, "lng": 88.363, "city": "Kolkata", "type": "delivery"},
            ],
            "total_distance_km": 680,
            "estimated_time": "11h 20m",
            "fuel_cost": 12240,
        },
        {
            "cluster_id": cluster_ids[3],
            "vehicle_name": "BharatBenz 2823",
            "color": "#DF1B41",
            "points": [
                {"lat": 12.9716, "lng": 77.594, "city": "Bangalore (Depot)", "type": "depot"},
                {"lat": 9.9312, "lng": 76.267, "city": "Kochi", "type": "pickup"},
                {"lat": 13.0827, "lng": 80.270, "city": "Chennai", "type": "delivery"},
                {"lat": 17.385, "lng": 78.486, "city": "Hyderabad", "type": "delivery"},
                {"lat": 21.1458, "lng": 79.088, "city": "Nagpur", "type": "delivery"},
            ],
            "total_distance_km": 2100,
            "estimated_time": "32h 10m",
            "fuel_cost": 58800,
        },
    ]
    supabase.table("routes").insert(routes_data).execute()
    print(f"  Inserted {len(routes_data)} routes")


def seed_analytics():
    print("Seeding analytics data...")

    # Dashboard KPIs
    kpis = [
        {"label": "Total Shipments", "value": 150, "suffix": "", "change": 12, "change_label": "vs yesterday", "icon": "package"},
        {"label": "Consolidation Rate", "value": 87, "suffix": "%", "change": 5.2, "change_label": "vs last week", "icon": "layers"},
        {"label": "Avg Utilization", "value": 87, "suffix": "%", "change": 29, "change_label": "improvement", "icon": "gauge"},
        {"label": "Cost Savings", "value": 140000, "suffix": "₹", "change": 31, "change_label": "reduction", "icon": "indian-rupee"},
        {"label": "CO₂ Reduced", "value": 800, "suffix": " kg", "change": 33, "change_label": "reduction", "icon": "leaf"},
        {"label": "Trips Eliminated", "value": 16, "suffix": "", "change": 34, "change_label": "fewer trips", "icon": "truck"},
    ]
    supabase.table("dashboard_kpis").insert(kpis).execute()

    # Utilization Trend
    trend = [
        {"day": "Feb 5", "utilization": 54, "cost": 480000, "co2": 2600},
        {"day": "Feb 8", "utilization": 58, "cost": 460000, "co2": 2500},
        {"day": "Feb 11", "utilization": 61, "cost": 440000, "co2": 2400},
        {"day": "Feb 14", "utilization": 65, "cost": 420000, "co2": 2300},
        {"day": "Feb 17", "utilization": 68, "cost": 410000, "co2": 2200},
        {"day": "Feb 20", "utilization": 72, "cost": 390000, "co2": 2100},
        {"day": "Feb 23", "utilization": 75, "cost": 370000, "co2": 2000},
        {"day": "Feb 26", "utilization": 78, "cost": 350000, "co2": 1900},
        {"day": "Mar 1", "utilization": 82, "cost": 340000, "co2": 1800},
        {"day": "Mar 4", "utilization": 85, "cost": 320000, "co2": 1700},
        {"day": "Mar 7", "utilization": 87, "cost": 310000, "co2": 1600},
    ]
    supabase.table("utilization_trend").insert(trend).execute()

    # Activity Feed
    activities = [
        {"type": "consolidation", "message": "Consolidation plan \"March 7 Daily\" created — 31 clusters from 150 shipments", "timestamp": "2 min ago", "icon": "layers"},
        {"type": "optimization", "message": "Route optimization complete — 34% fewer trips, ₹1.4L saved", "timestamp": "5 min ago", "icon": "route"},
        {"type": "shipment", "message": "12 new shipments uploaded from CSV — Delhi → Mumbai route", "timestamp": "15 min ago", "icon": "upload"},
        {"type": "alert", "message": "8 Chennai-bound shipments detected — consolidation could save ₹18,000", "timestamp": "32 min ago", "icon": "alert-triangle"},
        {"type": "consolidation", "message": "Cluster CL-001 accepted by logistics manager", "timestamp": "1 hr ago", "icon": "check-circle"},
        {"type": "shipment", "message": "Priority shipment SHP-0089 marked as Critical", "timestamp": "2 hrs ago", "icon": "alert-circle"},
        {"type": "optimization", "message": "3D bin packing optimized — vehicle utilization up to 91%", "timestamp": "3 hrs ago", "icon": "box"},
    ]
    supabase.table("activity_feed").insert(activities).execute()

    # Carbon Monthly
    carbon_monthly = [
        {"month": "Oct", "co2_before": 2800, "co2_after": 2200, "savings": 600},
        {"month": "Nov", "co2_before": 2650, "co2_after": 1950, "savings": 700},
        {"month": "Dec", "co2_before": 2900, "co2_after": 2050, "savings": 850},
        {"month": "Jan", "co2_before": 2500, "co2_after": 1750, "savings": 750},
        {"month": "Feb", "co2_before": 2600, "co2_after": 1800, "savings": 800},
        {"month": "Mar", "co2_before": 2400, "co2_after": 1600, "savings": 800},
    ]
    supabase.table("carbon_monthly").insert(carbon_monthly).execute()

    # Carbon Breakdown
    carbon_breakdown = [
        {"category": "Heavy Trucks", "co2_before": 1200, "co2_after": 780, "color": "#635BFF"},
        {"category": "Medium Trucks", "co2_before": 600, "co2_after": 420, "color": "#0CAF60"},
        {"category": "Light Trucks", "co2_before": 400, "co2_after": 280, "color": "#E5850B"},
        {"category": "Trailers", "co2_before": 200, "co2_after": 120, "color": "#DF1B41"},
    ]
    supabase.table("carbon_breakdown").insert(carbon_breakdown).execute()

    # Scenarios
    scenarios = [
        {"name": "No Consolidation", "total_trips": 47, "avg_utilization": 58, "total_cost": 450000, "co2_emissions": 2400, "delivery_sla_met": 95},
        {"name": "AI Optimized", "total_trips": 31, "avg_utilization": 87, "total_cost": 310000, "co2_emissions": 1600, "delivery_sla_met": 97},
        {"name": "Custom Config", "total_trips": 36, "avg_utilization": 78, "total_cost": 340000, "co2_emissions": 1800, "delivery_sla_met": 96},
    ]
    supabase.table("scenarios").insert(scenarios).execute()

    print("  Inserted KPIs, trend, activities, carbon, scenarios")


def seed_misc():
    print("Seeding chat, reports, cost params...")

    # Chat seed message
    supabase.table("chat_messages").insert({
        "role": "assistant",
        "content": "👋 Hello! I'm Lorri, your AI logistics co-pilot. I can help you with shipment consolidation, route optimization, and capacity planning. What would you like to know?",
        "timestamp": "10:00 AM",
        "session_id": "default",
    }).execute()

    # Reports
    reports = [
        {"name": "Daily Consolidation Summary", "type": "consolidation", "description": "Overview of all consolidation activities, cluster assignments, and savings achieved today.", "last_generated": "2026-03-07 06:00", "icon": "layers"},
        {"name": "Vehicle Utilization Report", "type": "utilization", "description": "Detailed breakdown of vehicle utilization rates, load factors, and capacity analysis.", "last_generated": "2026-03-06 18:00", "icon": "gauge"},
        {"name": "Cost Savings Analysis", "type": "cost", "description": "Comprehensive cost comparison before and after consolidation with ROI metrics.", "last_generated": "2026-03-06 12:00", "icon": "indian-rupee"},
        {"name": "Carbon Impact Report", "type": "carbon", "description": "ESG-aligned sustainability report showing CO₂ reduction and environmental impact.", "last_generated": "2026-03-05 18:00", "icon": "leaf"},
        {"name": "Route Efficiency Report", "type": "route", "description": "Analysis of route optimization results, distance savings, and time improvements.", "last_generated": "2026-03-05 06:00", "icon": "map"},
    ]
    supabase.table("reports").insert(reports).execute()

    # Cost params
    supabase.table("cost_params").insert({
        "fuel_cost_per_km": 8.5,
        "driver_cost_per_hr": 150,
        "toll_avg_per_trip": 1200,
        "maintenance_cost_per_km": 2.5,
    }).execute()

    print("  Inserted chat seed, reports, cost params")


def main():
    print("=" * 60)
    print("LORRI — Seeding Supabase Database")
    print("=" * 60)
    print(f"URL: {SUPABASE_URL}")
    print()

    print("Step 1: Clearing existing data...")
    clear_all_tables()
    print()

    print("Step 2: Seeding reference data...")
    seed_cities()
    vehicle_map = seed_vehicles()
    seed_depots()
    print()
    
    # Skip consolidation seeding if no vehicles were seeded
    if not vehicle_map:
        print("Step 3: Skipping shipments (no vehicles available)...")
        print("Step 4: Skipping consolidation plan (no vehicles available)...")
        print("Step 5: Skipping routes (no vehicles available)...")
        print()
        print("Step 6: Seeding analytics...")
        seed_analytics()
        print()
        print("Step 7: Seeding miscellaneous...")
        seed_misc()
        print()
        print("=" * 60)
        print("DONE! Reference data seeded (no vehicles/depots - add them via Settings).")
        print("=" * 60)
        return

    print("Step 3: Seeding shipments...")
    shipment_map = seed_shipments(150)
    print()

    print("Step 4: Seeding consolidation plan...")
    plan_id, cluster_ids = seed_consolidation(vehicle_map, shipment_map)
    print()

    print("Step 5: Seeding routes...")
    seed_routes(cluster_ids)
    print()

    print("Step 6: Seeding analytics...")
    seed_analytics()
    print()

    print("Step 7: Seeding miscellaneous...")
    seed_misc()
    print()

    print("=" * 60)
    print("DONE! All data seeded successfully.")
    print("=" * 60)


if __name__ == "__main__":
    main()
