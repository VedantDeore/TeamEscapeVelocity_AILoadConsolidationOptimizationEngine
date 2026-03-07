"""Consolidation engine routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase

consolidation_bp = Blueprint("consolidation", __name__)


@consolidation_bp.route("/api/consolidate", methods=["GET"])
def list_plans():
    sb = get_supabase()
    result = sb.table("consolidation_plans").select("*").order("created_at", desc=True).execute()
    return jsonify(result.data)


@consolidation_bp.route("/api/consolidate/<plan_id>", methods=["GET"])
def get_plan(plan_id):
    sb = get_supabase()
    plan = sb.table("consolidation_plans").select("*").eq("id", plan_id).single().execute()
    clusters = sb.table("clusters").select("*").eq("plan_id", plan_id).execute()

    # For each cluster, get the shipment IDs
    for cluster in clusters.data:
        cs = sb.table("cluster_shipments").select("shipment_id, load_order").eq("cluster_id", cluster["id"]).order("load_order").execute()
        cluster["shipment_ids"] = [r["shipment_id"] for r in cs.data]

    plan_data = plan.data
    plan_data["clusters"] = clusters.data
    return jsonify(plan_data)


@consolidation_bp.route("/api/consolidate/latest", methods=["GET"])
def get_latest_plan():
    sb = get_supabase()
    plan = sb.table("consolidation_plans").select("*").order("created_at", desc=True).limit(1).execute()
    if not plan.data:
        return jsonify(None)

    plan_data = plan.data[0]
    clusters = sb.table("clusters").select("*").eq("plan_id", plan_data["id"]).execute()

    for cluster in clusters.data:
        cs = sb.table("cluster_shipments").select("shipment_id, load_order").eq("cluster_id", cluster["id"]).order("load_order").execute()
        cluster["shipment_ids"] = [r["shipment_id"] for r in cs.data]

    plan_data["clusters"] = clusters.data
    return jsonify(plan_data)


@consolidation_bp.route("/api/consolidate", methods=["POST"])
def run_consolidation():
    """Trigger consolidation engine (placeholder — returns latest plan for now)."""
    sb = get_supabase()
    plan = sb.table("consolidation_plans").select("*").order("created_at", desc=True).limit(1).execute()
    if not plan.data:
        return jsonify({"error": "No plan available"}), 404

    plan_data = plan.data[0]
    clusters = sb.table("clusters").select("*").eq("plan_id", plan_data["id"]).execute()
    for cluster in clusters.data:
        cs = sb.table("cluster_shipments").select("shipment_id, load_order").eq("cluster_id", cluster["id"]).order("load_order").execute()
        cluster["shipment_ids"] = [r["shipment_id"] for r in cs.data]

    plan_data["clusters"] = clusters.data
    return jsonify(plan_data)


@consolidation_bp.route("/api/clusters/<cluster_id>/feedback", methods=["POST"])
def submit_feedback(cluster_id):
    sb = get_supabase()
    data = request.get_json()
    action = data.get("action")  # accepted, rejected

    # Update cluster status
    sb.table("clusters").update({"status": action}).eq("id", cluster_id).execute()

    # Record feedback
    sb.table("feedback").insert({
        "cluster_id": cluster_id,
        "action": action,
        "reason": data.get("reason", ""),
    }).execute()

    return jsonify({"status": "ok"})
