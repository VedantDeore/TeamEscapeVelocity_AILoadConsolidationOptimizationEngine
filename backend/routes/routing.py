"""Route optimization routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from services.vrp_solver import optimize_route

routing_bp = Blueprint("routing", __name__)


@routing_bp.route("/api/routes", methods=["GET"])
def list_routes():
    sb = get_supabase()
    result = sb.table("routes").select("*").execute()
    return jsonify(result.data)


@routing_bp.route("/api/routes/<route_id>", methods=["GET"])
def get_route(route_id):
    sb = get_supabase()
    try:
        result = sb.table("routes").select("*").eq("id", route_id).single().execute()
        return jsonify(result.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@routing_bp.route("/api/routes/cluster/<cluster_id>", methods=["GET"])
def get_route_by_cluster(cluster_id):
    sb = get_supabase()
    try:
        result = sb.table("routes").select("*").eq("cluster_id", cluster_id).execute()
        return jsonify(result.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@routing_bp.route("/api/route/optimize", methods=["POST"])
def optimize():
    """
    Re-run VRP route optimisation for a cluster on demand.
    Body: { "cluster_id": "uuid" }
    """
    sb   = get_supabase()
    body = request.get_json(silent=True) or {}
    cluster_id = body.get("cluster_id")

    if not cluster_id:
        return jsonify({"error": "cluster_id is required"}), 400

    try:
        # Fetch cluster + shipments
        cluster = sb.table("clusters").select("*").eq("id", cluster_id).single().execute()
        c_data  = cluster.data

        cs     = sb.table("cluster_shipments").select("shipment_id").eq("cluster_id", cluster_id).execute()
        s_ids  = [r["shipment_id"] for r in (cs.data or [])]
        shps   = []
        if s_ids:
            s_result = sb.table("shipments").select("*").in_("id", s_ids).execute()
            shps     = s_result.data or []

        # Fetch vehicle
        vehicle = {}
        if c_data.get("vehicle_id"):
            v = sb.table("vehicles").select("*").eq("id", c_data["vehicle_id"]).single().execute()
            vehicle = v.data or {}

        # Fetch first depot
        depot = None
        d_result = sb.table("depots").select("*").limit(1).execute()
        if d_result.data:
            depot = d_result.data[0]

        route = optimize_route(shps, vehicle, depot)

        # Persist updated route
        existing = sb.table("routes").select("id").eq("cluster_id", cluster_id).execute()
        if existing.data:
            sb.table("routes").update({
                "points":            route["stops"],
                "total_distance_km": route["total_distance_km"],
                "estimated_time":    route["estimated_time"],
                "fuel_cost":         route["fuel_cost"],
            }).eq("cluster_id", cluster_id).execute()
        else:
            sb.table("routes").insert({
                "cluster_id":        cluster_id,
                "vehicle_name":      c_data.get("vehicle_name", "Unknown"),
                "points":            route["stops"],
                "total_distance_km": route["total_distance_km"],
                "estimated_time":    route["estimated_time"],
                "fuel_cost":         route["fuel_cost"],
            }).execute()

        return jsonify(route)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
