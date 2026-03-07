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
"""
Scenario Simulation API Routes
===============================

Endpoints:
  POST /api/simulation/run            — Run a packing simulation scenario
  GET  /api/simulation/demo            — Run demo simulation with sample data
  POST /api/simulation/compare-scenarios — Compare multiple scenarios
"""

from flask import Blueprint, jsonify, request
from services.bin_packing import (
    pack_items,
    create_items_from_shipments,
    create_container_from_vehicle,
    greedy_pack,
)
from services.scenario import (
    run_scenario,
    compare_scenarios,
    generate_demo_scenario_data,
)
import logging

logger = logging.getLogger(__name__)

simulation_bp = Blueprint("simulation", __name__, url_prefix="/api/simulation")


# ── POST /api/simulation/run ──────────────────────────────────────────────
@simulation_bp.route("/run", methods=["POST"])
def run_simulation():
    """
    Run a single packing simulation scenario.

    Request body:
    {
      "name": "scenario name",
      "container": { ... },
      "items": [{ ... }],
      "algorithm": "hybrid",
      "sa_iterations": 500
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body required"}), 400

        result = run_scenario(data)
        return jsonify(result)

    except Exception as e:
        logger.exception("Error in run_simulation")
        return jsonify({"error": str(e)}), 500


# ── GET /api/simulation/demo ──────────────────────────────────────────────
@simulation_bp.route("/demo", methods=["GET"])
def demo_simulation():
    """
    Run a demo simulation comparing no-consolidation, greedy, and AI-optimized.

    Query params:
      ?items=15  — number of demo items
    """
    try:
        num_items = int(request.args.get("items", 15))
        results = generate_demo_scenario_data(num_items)
        return jsonify(results)

    except Exception as e:
        logger.exception("Error in demo_simulation")
        return jsonify({"error": str(e)}), 500


# ── POST /api/simulation/compare-scenarios ────────────────────────────────
@simulation_bp.route("/compare-scenarios", methods=["POST"])
def compare():
    """
    Compare multiple packing scenarios.

    Request body:
    {
      "container": { ... },
      "items": [{ ... }],
      "scenarios": [
        { "name": "Greedy", "algorithm": "greedy" },
        { "name": "AI Hybrid", "algorithm": "hybrid", "sa_iterations": 500 }
      ]
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body required"}), 400

        results = compare_scenarios(data)
        return jsonify(results)

    except Exception as e:
        logger.exception("Error in compare_scenarios")
        return jsonify({"error": str(e)}), 500
