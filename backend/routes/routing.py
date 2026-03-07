"""Route optimization routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from services.vrp_solver import optimize_route

routing_bp = Blueprint("routing", __name__)


@routing_bp.route("/api/routes", methods=["GET"])
def list_routes():
    """Return all routes enriched with plan metadata for grouping by run."""
    sb = get_supabase()
    result = sb.table("routes").select("*").execute()
    routes = result.data or []

    # Enrich each route with cluster → plan info
    cluster_ids = list({r["cluster_id"] for r in routes if r.get("cluster_id")})
    cluster_map = {}
    plan_map = {}

    if cluster_ids:
        try:
            cl_result = sb.table("clusters").select("id,plan_id,status,shipment_ids:cluster_shipments(shipment_id)").in_("id", cluster_ids).execute()
            for cl in (cl_result.data or []):
                cluster_map[cl["id"]] = cl
        except Exception:
            # Fallback: fetch without join
            try:
                cl_result = sb.table("clusters").select("id,plan_id,status").in_("id", cluster_ids).execute()
                for cl in (cl_result.data or []):
                    cluster_map[cl["id"]] = cl
            except Exception:
                pass

        plan_ids = list({cl.get("plan_id") for cl in cluster_map.values() if cl.get("plan_id")})
        if plan_ids:
            try:
                pl_result = sb.table("consolidation_plans").select("id,name,created_at,status").in_("id", plan_ids).execute()
                for pl in (pl_result.data or []):
                    plan_map[pl["id"]] = pl
            except Exception:
                pass

    for r in routes:
        cid = r.get("cluster_id")
        cl = cluster_map.get(cid, {})
        pid = cl.get("plan_id")
        plan = plan_map.get(pid, {})
        r["plan_id"] = pid
        r["plan_name"] = plan.get("name", "")
        r["plan_created_at"] = plan.get("created_at", "")
        r["plan_status"] = plan.get("status", "")
        r["cluster_status"] = cl.get("status", "")

    return jsonify(routes)


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

        # Fetch all depots (for open-ended multi-depot routing)
        all_depots = []
        depot = None
        d_result = sb.table("depots").select("*").execute()
        if d_result.data:
            all_depots = d_result.data
            depot = all_depots[0]

        route = optimize_route(shps, vehicle, depot, all_depots=all_depots)

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
