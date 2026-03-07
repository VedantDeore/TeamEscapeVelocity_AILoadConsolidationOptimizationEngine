"""Scenario simulation routes — wired to real scenario engine."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from services.scenario import run_scenarios

simulation_bp = Blueprint("simulation", __name__)


@simulation_bp.route("/api/scenarios", methods=["GET"])
def list_scenarios():
    sb     = get_supabase()
    result = sb.table("scenarios").select("*").execute()
    return jsonify(result.data)


@simulation_bp.route("/api/simulate", methods=["POST"])
def run_simulation():
    """
    Run 3-scenario comparison on current pending shipments.

    Optional body params:
      max_detour_pct     (int, default 20)
      dbscan_eps         (float, default 0.45 for custom scenario)
      origin_city        (string filter)
      dest_city          (string filter)
    """
    sb   = get_supabase()
    body = request.get_json(silent=True) or {}

    # Fetch pending shipments (optionally filtered)
    query = sb.table("shipments").select("*").eq("status", "pending")
    if body.get("origin_city"):
        query = query.ilike("origin_city", f"%{body['origin_city']}%")
    if body.get("dest_city"):
        query = query.ilike("dest_city", f"%{body['dest_city']}%")

    result    = query.limit(300).execute()
    shipments = result.data or []

    if not shipments:
        # Fall back to seeded scenario data
        seeded = sb.table("scenarios").select("*").execute()
        return jsonify({
            "scenarios": seeded.data,
            "best": "AI Optimised",
            "summary": {"note": "Using pre-seeded data — no pending shipments found"},
        })

    constraints = {
        "max_detour_pct":      body.get("max_detour_pct", 20),
        "dbscan_eps":          body.get("dbscan_eps", 0.45),
        "dbscan_min_samples":  body.get("dbscan_min_samples", 2),
    }

    data = run_scenarios(shipments, constraints)
    return jsonify(data)


@simulation_bp.route("/api/simulate/compare", methods=["GET"])
def compare_seeded():
    """Return the pre-seeded scenario comparison data."""
    sb     = get_supabase()
    result = sb.table("scenarios").select("*").execute()
    return jsonify({"scenarios": result.data, "best": "AI Optimised"})
