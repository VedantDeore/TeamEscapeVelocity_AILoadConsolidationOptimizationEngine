"""Scenario simulation routes."""

from flask import Blueprint, jsonify
from models.supabase_client import get_supabase

simulation_bp = Blueprint("simulation", __name__)


@simulation_bp.route("/api/scenarios", methods=["GET"])
def list_scenarios():
    sb = get_supabase()
    result = sb.table("scenarios").select("*").execute()
    return jsonify(result.data)


@simulation_bp.route("/api/simulate", methods=["POST"])
def run_simulation():
    """Returns scenario comparison data."""
    sb = get_supabase()
    result = sb.table("scenarios").select("*").execute()
    return jsonify(result.data)
