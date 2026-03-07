"""Route optimization routes."""

from flask import Blueprint, jsonify
from models.supabase_client import get_supabase

routing_bp = Blueprint("routing", __name__)


@routing_bp.route("/api/routes", methods=["GET"])
def list_routes():
    sb = get_supabase()
    result = sb.table("routes").select("*").execute()
    return jsonify(result.data)


@routing_bp.route("/api/routes/<route_id>", methods=["GET"])
def get_route(route_id):
    sb = get_supabase()
    result = sb.table("routes").select("*").eq("id", route_id).single().execute()
    return jsonify(result.data)


@routing_bp.route("/api/routes/cluster/<cluster_id>", methods=["GET"])
def get_route_by_cluster(cluster_id):
    sb = get_supabase()
    result = sb.table("routes").select("*").eq("cluster_id", cluster_id).execute()
    return jsonify(result.data)
