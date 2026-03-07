"""Vehicle and settings routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase

settings_bp = Blueprint("settings", __name__)


# ---- Vehicles ----

@settings_bp.route("/api/vehicles", methods=["GET"])
def list_vehicles():
    sb = get_supabase()
    result = sb.table("vehicles").select("*").execute()
    return jsonify(result.data)


@settings_bp.route("/api/vehicles", methods=["POST"])
def add_vehicle():
    sb = get_supabase()
    data = request.get_json()
    result = sb.table("vehicles").insert(data).execute()
    return jsonify(result.data[0]), 201


@settings_bp.route("/api/vehicles/<vehicle_id>", methods=["PATCH"])
def update_vehicle(vehicle_id):
    sb = get_supabase()
    data = request.get_json()
    result = sb.table("vehicles").update(data).eq("id", vehicle_id).execute()
    return jsonify(result.data[0])


# ---- Depots ----

@settings_bp.route("/api/depots", methods=["GET"])
def list_depots():
    sb = get_supabase()
    result = sb.table("depots").select("*").execute()
    return jsonify(result.data)


@settings_bp.route("/api/depots", methods=["POST"])
def add_depot():
    sb = get_supabase()
    data = request.get_json()
    result = sb.table("depots").insert(data).execute()
    return jsonify(result.data[0]), 201


# ---- Cost Parameters ----

@settings_bp.route("/api/settings/costs", methods=["GET"])
def get_cost_params():
    sb = get_supabase()
    result = sb.table("cost_params").select("*").limit(1).execute()
    if result.data:
        return jsonify(result.data[0])
    return jsonify({})


@settings_bp.route("/api/settings/costs", methods=["PATCH"])
def update_cost_params():
    sb = get_supabase()
    data = request.get_json()
    # Get the existing row
    existing = sb.table("cost_params").select("id").limit(1).execute()
    if existing.data:
        result = sb.table("cost_params").update(data).eq("id", existing.data[0]["id"]).execute()
        return jsonify(result.data[0])
    else:
        result = sb.table("cost_params").insert(data).execute()
        return jsonify(result.data[0]), 201


# ---- Cities ----

@settings_bp.route("/api/cities", methods=["GET"])
def list_cities():
    sb = get_supabase()
    result = sb.table("cities").select("*").order("name").execute()
    return jsonify(result.data)
