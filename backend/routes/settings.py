"""Vehicle and settings routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from utils.geocoding import geocode

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


@settings_bp.route("/api/vehicles/<vehicle_id>", methods=["DELETE"])
def delete_vehicle(vehicle_id):
    """Soft-delete: mark vehicle as unavailable instead of removing."""
    sb = get_supabase()
    try:
        sb.table("vehicles").update({"is_available": False}).eq("id", vehicle_id).execute()
        return jsonify({"status": "archived", "id": vehicle_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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

    # Auto-geocode if lat/lng are missing or zero
    if (not data.get("lat") or not data.get("lng")) and data.get("city"):
        geo = geocode(f"{data['city'].strip()}, India")
        if geo:
            data["lat"] = geo["lat"]
            data["lng"] = geo["lng"]

    result = sb.table("depots").insert(data).execute()
    return jsonify(result.data[0]), 201


@settings_bp.route("/api/depots/<depot_id>", methods=["PATCH"])
def update_depot(depot_id):
    sb = get_supabase()
    data = request.get_json()

    # Auto-geocode if lat/lng are missing or zero (same as add_depot)
    if (not data.get("lat") or not data.get("lng")) and data.get("city"):
        geo = geocode(f"{data['city'].strip()}, India")
        if geo:
            data["lat"] = geo["lat"]
            data["lng"] = geo["lng"]

    result = sb.table("depots").update(data).eq("id", depot_id).execute()
    return jsonify(result.data[0])


@settings_bp.route("/api/depots/<depot_id>", methods=["DELETE"])
def delete_depot(depot_id):
    sb = get_supabase()
    try:
        sb.table("depots").delete().eq("id", depot_id).execute()
        return jsonify({"status": "deleted", "id": depot_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---- Geocode endpoint ----

@settings_bp.route("/api/geocode", methods=["GET"])
def geocode_address():
    """Geocode a city/address and return lat/lng."""
    address = request.args.get("address", "").strip()
    if not address:
        return jsonify({"error": "address parameter is required"}), 400

    # Append India if not already present
    search = address if "india" in address.lower() else f"{address}, India"
    result = geocode(search)
    if result:
        return jsonify(result)
    return jsonify({"error": f"Could not geocode '{address}'"}), 404


# ---- Readiness Check ----

@settings_bp.route("/api/readiness", methods=["GET"])
def readiness_check():
    """Check if all required data exists for running consolidation."""
    sb = get_supabase()
    issues = []
    warnings = []

    # Check shipments
    try:
        shipments = sb.table("shipments").select("id", count="exact").eq("status", "pending").execute()
        pending_count = shipments.count or len(shipments.data or [])
        if pending_count == 0:
            issues.append({"type": "error", "field": "shipments", "message": "No pending shipments found. Add shipments before running consolidation."})
        elif pending_count < 3:
            warnings.append({"type": "warning", "field": "shipments", "message": f"Only {pending_count} pending shipment(s). Add more for better consolidation results."})
    except Exception:
        issues.append({"type": "error", "field": "shipments", "message": "Could not check shipments."})

    # Check vehicles
    try:
        vehicles = sb.table("vehicles").select("id", count="exact").eq("is_available", True).execute()
        vehicle_count = vehicles.count or len(vehicles.data or [])
        if vehicle_count == 0:
            issues.append({"type": "error", "field": "vehicles", "message": "No vehicles found. Go to Settings → Fleet to add vehicles."})
    except Exception:
        issues.append({"type": "error", "field": "vehicles", "message": "Could not check vehicles."})

    # Check depots
    try:
        depots = sb.table("depots").select("id", count="exact").execute()
        depot_count = depots.count or len(depots.data or [])
        if depot_count == 0:
            warnings.append({"type": "warning", "field": "depots", "message": "No depots configured. Go to Settings → Depots to add warehouse locations."})
    except Exception:
        warnings.append({"type": "warning", "field": "depots", "message": "Could not check depots."})

    # Check cost params
    try:
        costs = sb.table("cost_params").select("*").limit(1).execute()
        if not costs.data or costs.data[0].get("fuel_cost_per_km", 0) == 0:
            warnings.append({"type": "warning", "field": "costs", "message": "Cost parameters not configured. Go to Settings → Cost Model."})
    except Exception:
        pass

    ready = len(issues) == 0
    return jsonify({
        "ready": ready,
        "issues": issues,
        "warnings": warnings,
        "summary": {
            "pending_shipments": pending_count if 'pending_count' in locals() else 0,
            "vehicles": vehicle_count if 'vehicle_count' in locals() else 0,
            "depots": depot_count if 'depot_count' in locals() else 0,
        }
    })


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
