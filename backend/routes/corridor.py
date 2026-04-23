"""Corridor-based consolidation routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from services.corridor_engine import (
    match_shipments_to_corridors,
    consolidate_corridor,
    generate_route_plan,
)
from services.carbon import calculate_emissions
from datetime import datetime, timezone
from utils.distance import geodesic

corridor_bp = Blueprint("corridor", __name__)


@corridor_bp.route("/api/corridors", methods=["GET"])
def list_corridors():
    """List all truck corridors."""
    sb = get_supabase()
    result = sb.table("truck_corridors").select("*").order("created_at", desc=True).execute()
    return jsonify(result.data)


@corridor_bp.route("/api/corridors", methods=["POST"])
def add_corridor():
    """Add a new truck corridor."""
    sb = get_supabase()
    data = request.get_json()
    
    if not data.get("truck_name") or not data.get("corridor"):
        return jsonify({"error": "truck_name and corridor are required"}), 400
    
    result = sb.table("truck_corridors").insert(data).execute()
    return jsonify(result.data[0]), 201


@corridor_bp.route("/api/corridors/<corridor_id>", methods=["PATCH"])
def update_corridor(corridor_id):
    """Update a corridor."""
    sb = get_supabase()
    data = request.get_json()
    result = sb.table("truck_corridors").update(data).eq("id", corridor_id).execute()
    if not result.data:
        return jsonify({"error": "Not found"}), 404
    return jsonify(result.data[0])


@corridor_bp.route("/api/corridors/<corridor_id>", methods=["DELETE"])
def delete_corridor(corridor_id):
    """Delete a corridor."""
    sb = get_supabase()
    sb.table("truck_corridors").delete().eq("id", corridor_id).execute()
    return jsonify({"status": "deleted"}), 200


@corridor_bp.route("/api/corridor/consolidate", methods=["POST"])
def run_corridor_consolidation():
    """
    Run corridor-based consolidation on pending shipments.
    
    Body params (optional):
      - origin_city: filter shipments by origin
      - dest_city: filter shipments by destination
    """
    sb = get_supabase()
    body = request.get_json(silent=True) or {}
    
    # Fetch pending shipments
    query = sb.table("shipments").select("*").eq("status", "pending")
    if body.get("origin_city"):
        query = query.ilike("origin_city", f"%{body['origin_city']}%")
    if body.get("dest_city"):
        query = query.ilike("dest_city", f"%{body['dest_city']}%")
    
    shipments_result = query.limit(500).execute()
    shipments = shipments_result.data or []
    
    if not shipments:
        return jsonify({"error": "No pending shipments found"}), 404
    
    # Fetch active corridors
    corridors_result = sb.table("truck_corridors").select("*").eq("is_active", True).execute()
    corridors = corridors_result.data or []
    
    if not corridors:
        return jsonify({"error": "No active corridors found. Please add truck corridors in Settings."}), 404
    
    # Match shipments to corridors
    matches = match_shipments_to_corridors(shipments, corridors)
    
    if not matches:
        return jsonify({
            "error": "No shipments matched any corridor",
            "hint": "Ensure shipment origin and destination cities are on corridor routes"
        }), 404
    
    # Consolidate each corridor
    clusters = []
    total_weight_before = sum(s.get("weight_kg", 0) for s in shipments)
    trips_before = len(shipments)
    
    for corridor_id, matched_shipments in matches.items():
        corridor = next((c for c in corridors if c.get("id") == corridor_id), None)
        if not corridor:
            continue
        
        capacity_kg = corridor.get("capacity_kg", 12000)
        assignments = consolidate_corridor(corridor, matched_shipments, capacity_kg)
        
        for assignment in assignments:
            route_plan = generate_route_plan(corridor, assignment["shipments"])
            
            # Calculate CO2
            co2_input = [{
                "route_distance_km": route_plan["total_distance_km"],
                "total_weight": assignment["total_weight"],
                "vehicle_type": "Heavy Truck",
                "shipment_count": len(assignment["shipments"]),
            }]
            emission_data = calculate_emissions(co2_input)
            
            clusters.append({
                "corridor_id": corridor_id,
                "truck_name": corridor.get("truck_name"),
                "corridor_route": corridor.get("corridor"),
                "shipment_ids": [s.get("id") for s in assignment["shipments"]],
                "shipments": assignment["shipments"],
                "total_weight": assignment["total_weight"],
                "total_volume": sum(s.get("volume_m3", 0) for s in assignment["shipments"]),
                "utilization_pct": assignment["utilization_pct"],
                "route_distance_km": route_plan["total_distance_km"],
                "estimated_cost": route_plan["fuel_cost"],
                "estimated_co2": emission_data.get("co2_after", 0),
                "route_plan": route_plan,
            })
    
    # Calculate totals
    trips_after = len(clusters)
    total_cost_after = sum(c["estimated_cost"] for c in clusters)
    total_cost_before = trips_before * 9500  # rough avg per trip
    total_co2_after = sum(c["estimated_co2"] for c in clusters)
    total_co2_before = trips_before * 18.0  # rough kg CO₂ per solo trip
    avg_util = sum(c["utilization_pct"] for c in clusters) / max(len(clusters), 1)
    
    # Create consolidation plan
    plan_name = f"Corridor Consolidation — {datetime.now(timezone.utc).strftime('%b %d, %Y %H:%M')}"
    plan_result = sb.table("consolidation_plans").insert({
        "name": plan_name,
        "status": "active",
        "total_shipments": len(shipments),
        "total_clusters": len(clusters),
        "avg_utilization": round(avg_util, 1),
        "total_cost_before": round(total_cost_before, 0),
        "total_cost_after": round(total_cost_after, 0),
        "co2_before": round(total_co2_before, 2),
        "co2_after": round(total_co2_after, 2),
        "trips_before": trips_before,
        "trips_after": trips_after,
    }).execute()
    
    plan_id = plan_result.data[0]["id"]
    
    # Get vehicle for each cluster
    def _get_vehicle_by_name(name):
        result = sb.table("vehicles").select("*").ilike("name", f"%{name}%").limit(1).execute()
        return result.data[0] if result.data else None
    
    # Insert clusters
    cluster_results = []
    for cluster in clusters:
        vehicle = _get_vehicle_by_name(cluster["truck_name"])
        vehicle_id = vehicle.get("id") if vehicle else None
        
        cluster_row = sb.table("clusters").insert({
            "plan_id": plan_id,
            "vehicle_id": vehicle_id,
            "vehicle_name": cluster["truck_name"],
            "utilization_pct": cluster["utilization_pct"],
            "total_weight": cluster["total_weight"],
            "total_volume": cluster["total_volume"],
            "route_distance_km": cluster["route_distance_km"],
            "estimated_cost": cluster["estimated_cost"],
            "estimated_co2": cluster["estimated_co2"],
            "status": "pending",
            "route_geometry": {"stops": cluster["route_plan"]["stops"]},
        }).execute()
        
        cid = cluster_row.data[0]["id"]
        
        # Map shipments to cluster
        for i, sid in enumerate(cluster["shipment_ids"]):
            try:
                sb.table("cluster_shipments").insert({
                    "cluster_id": cid,
                    "shipment_id": sid,
                    "load_order": i + 1,
                }).execute()
            except Exception:
                pass
        
        cluster_results.append({
            **cluster_row.data[0],
            "shipment_ids": cluster["shipment_ids"],
        })
    
    return jsonify({
        "plan_id": plan_id,
        "total_shipments": len(shipments),
        "total_clusters": len(clusters),
        "avg_utilization": round(avg_util, 1),
        "total_cost_before": round(total_cost_before, 0),
        "total_cost_after": round(total_cost_after, 0),
        "co2_before": round(total_co2_before, 2),
        "co2_after": round(total_co2_after, 2),
        "trips_before": trips_before,
        "trips_after": trips_after,
        "clusters": cluster_results,
    }), 201
