"""Driver management, live location tracking, and task assignment routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
import math
import logging

logger = logging.getLogger(__name__)
drivers_bp = Blueprint("drivers", __name__)


# ─── Driver Registration ───────────────────────────────
@drivers_bp.route("/api/drivers/register", methods=["POST"])
def register_driver():
    sb = get_supabase()
    body = request.get_json(silent=True) or {}

    for field in ["name", "phone", "password"]:
        if not body.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    existing = sb.table("drivers").select("id").eq("phone", body["phone"]).execute()
    if existing.data:
        return jsonify({"error": "Phone already registered", "driver_id": existing.data[0]["id"]}), 409

    driver = sb.table("drivers").insert({
        "name": body["name"],
        "phone": body["phone"],
        "email": body.get("email"),
        "password_hash": generate_password_hash(body["password"]),
        "license_number": body.get("license_number"),
        "is_online": False,
        "is_verified": False,
    }).execute()

    d = driver.data[0]
    d.pop("password_hash", None)
    return jsonify({"driver": d, "message": "Registration successful"}), 201


# ─── Driver Login ───────────────────────────────────────
@drivers_bp.route("/api/drivers/login", methods=["POST"])
def login_driver():
    sb = get_supabase()
    body = request.get_json(silent=True) or {}
    phone = body.get("phone")
    password = body.get("password")

    if not phone or not password:
        return jsonify({"error": "phone and password are required"}), 400

    result = sb.table("drivers").select("*").eq("phone", phone).execute()
    if not result.data:
        return jsonify({"error": "Driver not found"}), 404

    driver = result.data[0]
    if not check_password_hash(driver.get("password_hash", ""), password):
        return jsonify({"error": "Invalid password"}), 401

    driver.pop("password_hash", None)
    return jsonify({"driver": driver})


# ─── Toggle Online Status ──────────────────────────────
@drivers_bp.route("/api/drivers/<driver_id>/toggle-online", methods=["POST"])
def toggle_online(driver_id):
    sb = get_supabase()
    body = request.get_json(silent=True) or {}
    is_online = body.get("is_online", False)

    sb.table("drivers").update({
        "is_online": is_online,
        "last_seen_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", driver_id).execute()

    if not is_online:
        sb.table("driver_locations").delete().eq("driver_id", driver_id).execute()

    return jsonify({"status": "online" if is_online else "offline"})


# ─── Update Location ───────────────────────────────────
@drivers_bp.route("/api/drivers/location", methods=["POST"])
def update_location():
    sb = get_supabase()
    body = request.get_json(silent=True) or {}

    driver_id = body.get("driver_id")
    if not driver_id:
        return jsonify({"error": "driver_id is required"}), 400

    location_data = {
        "driver_id": driver_id,
        "lat": body.get("lat"),
        "lng": body.get("lng"),
        "heading": body.get("heading"),
        "speed_kmh": body.get("speed_kmh", 0),
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }

    sb.table("driver_locations").upsert(
        location_data, on_conflict="driver_id"
    ).execute()

    sb.table("drivers").update({
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
        "is_online": True,
    }).eq("id", driver_id).execute()

    return jsonify({"status": "ok"})


# ─── Get All Active Drivers with Locations ──────────────
@drivers_bp.route("/api/drivers/active", methods=["GET"])
def get_active_drivers():
    sb = get_supabase()
    drivers = sb.table("drivers").select("*").eq("is_online", True).execute()
    if not drivers.data:
        return jsonify([])

    driver_ids = [d["id"] for d in drivers.data]
    locations = sb.table("driver_locations").select("*").in_("driver_id", driver_ids).execute()
    loc_map = {loc["driver_id"]: loc for loc in (locations.data or [])}

    result = []
    for d in drivers.data:
        d.pop("password_hash", None)
        result.append({**d, "location": loc_map.get(d["id"])})

    return jsonify(result)


# ─── List All Drivers ──────────────────────────────────
@drivers_bp.route("/api/drivers", methods=["GET"])
def list_drivers():
    sb = get_supabase()
    result = sb.table("drivers").select("*").order("created_at", desc=True).execute()
    drivers = result.data or []
    for d in drivers:
        d.pop("password_hash", None)
    return jsonify(drivers)


# ─── Assign Task to Driver ─────────────────────────────
@drivers_bp.route("/api/drivers/<driver_id>/assign-task", methods=["POST"])
def assign_task(driver_id):
    sb = get_supabase()
    body = request.get_json(silent=True) or {}
    route_id = body.get("route_id")

    if not route_id:
        return jsonify({"error": "route_id is required"}), 400

    active = sb.table("driver_tasks").select("id").eq("driver_id", driver_id).in_(
        "status", ["assigned", "in_progress"]
    ).execute()
    if active.data:
        return jsonify({"error": "Driver already has an active task. Complete it first."}), 409

    route_res = sb.table("routes").select("*").eq("id", route_id).execute()
    if not route_res.data:
        return jsonify({"error": "Route not found"}), 404
    route = route_res.data[0]

    task = sb.table("driver_tasks").insert({
        "driver_id": driver_id,
        "route_id": route_id,
        "cluster_id": route.get("cluster_id"),
        "vehicle_name": route.get("vehicle_name"),
        "status": "assigned",
        "stops": route.get("points", []),
        "current_stop_index": 0,
    }).execute()

    return jsonify({"task": task.data[0]}), 201


# ─── Get Driver's Tasks ────────────────────────────────
@drivers_bp.route("/api/drivers/<driver_id>/tasks", methods=["GET"])
def get_driver_tasks(driver_id):
    sb = get_supabase()
    status_filter = request.args.get("status")

    query = sb.table("driver_tasks").select("*").eq("driver_id", driver_id).order("created_at", desc=True)
    if status_filter:
        query = query.eq("status", status_filter)

    result = query.execute()
    return jsonify(result.data or [])


# ─── Get Single Task ───────────────────────────────────
@drivers_bp.route("/api/drivers/tasks/<task_id>", methods=["GET"])
def get_task(task_id):
    sb = get_supabase()
    result = sb.table("driver_tasks").select("*").eq("id", task_id).execute()
    if not result.data:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(result.data[0])


# ─── Update Task Status ────────────────────────────────
@drivers_bp.route("/api/drivers/tasks/<task_id>", methods=["PATCH"])
def update_task(task_id):
    sb = get_supabase()
    body = request.get_json(silent=True) or {}

    update_data = {}
    if "status" in body:
        update_data["status"] = body["status"]
    if "current_stop_index" in body:
        update_data["current_stop_index"] = body["current_stop_index"]
    if "stops" in body:
        update_data["stops"] = body["stops"]

    if body.get("status") == "in_progress" and "started_at" not in body:
        update_data["started_at"] = datetime.now(timezone.utc).isoformat()

    if body.get("status") == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    if not update_data:
        return jsonify({"error": "No fields to update"}), 400

    result = sb.table("driver_tasks").update(update_data).eq("id", task_id).execute()
    if not result.data:
        return jsonify({"error": "Task not found"}), 404

    task_data = result.data[0]

    if task_data.get("status") == "completed" and task_data.get("driver_id"):
        try:
            sb.table("drivers").update({
                "assigned_vehicle_id": None,
            }).eq("id", task_data["driver_id"]).execute()
        except Exception:
            pass

    return jsonify(task_data)


def _haversine_km(lat1, lng1, lat2, lng2):
    """Great-circle distance between two lat/lng points in km."""
    R = 6371.0
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── Nearby Drivers (sorted by distance to a point) ────
@drivers_bp.route("/api/drivers/nearby", methods=["GET"])
def get_nearby_drivers():
    """Return all drivers sorted by distance to a given lat/lng.

    Query params: lat, lng (required)
    Includes last known location and active task status.
    """
    sb = get_supabase()
    lat = request.args.get("lat", type=float)
    lng = request.args.get("lng", type=float)
    if lat is None or lng is None:
        return jsonify({"error": "lat and lng query params are required"}), 400

    drivers = sb.table("drivers").select("*").execute()
    all_drivers = drivers.data or []

    driver_ids = [d["id"] for d in all_drivers]
    locations = {}
    if driver_ids:
        loc_res = sb.table("driver_locations").select("*").in_("driver_id", driver_ids).execute()
        locations = {loc["driver_id"]: loc for loc in (loc_res.data or [])}

    active_tasks = {}
    if driver_ids:
        tasks_res = sb.table("driver_tasks").select("driver_id,status").in_("driver_id", driver_ids).in_("status", ["assigned", "in_progress"]).execute()
        for t in (tasks_res.data or []):
            active_tasks[t["driver_id"]] = t["status"]

    result = []
    for d in all_drivers:
        d.pop("password_hash", None)
        loc = locations.get(d["id"])
        distance_km = None
        if loc and loc.get("lat") and loc.get("lng"):
            distance_km = round(_haversine_km(lat, lng, loc["lat"], loc["lng"]), 1)
        elif d.get("home_lat") and d.get("home_lng"):
            distance_km = round(_haversine_km(lat, lng, d["home_lat"], d["home_lng"]), 1)

        result.append({
            **d,
            "location": loc,
            "distance_km": distance_km,
            "has_active_task": d["id"] in active_tasks,
            "task_status": active_tasks.get(d["id"]),
        })

    result.sort(key=lambda x: (
        x["has_active_task"],
        x["distance_km"] if x["distance_km"] is not None else 999999,
    ))

    return jsonify(result)


# ─── All Driver Locations (lightweight, for live map) ───
@drivers_bp.route("/api/drivers/locations", methods=["GET"])
def get_all_locations():
    """Lightweight endpoint: returns only id, name, location for all
    drivers that have a recent location record. Used for live map polling."""
    sb = get_supabase()
    locations = sb.table("driver_locations").select("*").execute()
    if not locations.data:
        return jsonify([])

    driver_ids = [loc["driver_id"] for loc in locations.data]
    drivers = sb.table("drivers").select("id,name,is_online,assigned_vehicle_id").in_("id", driver_ids).execute()
    name_map = {d["id"]: d for d in (drivers.data or [])}

    result = []
    for loc in locations.data:
        info = name_map.get(loc["driver_id"], {})
        result.append({
            "driver_id": loc["driver_id"],
            "name": info.get("name", "Unknown"),
            "is_online": info.get("is_online", False),
            "lat": loc["lat"],
            "lng": loc["lng"],
            "heading": loc.get("heading"),
            "speed_kmh": loc.get("speed_kmh", 0),
            "recorded_at": loc.get("recorded_at"),
        })

    return jsonify(result)


# ─── Update Driver Profile ─────────────────────────────
@drivers_bp.route("/api/drivers/<driver_id>/profile", methods=["PATCH"])
def update_profile(driver_id):
    sb = get_supabase()
    body = request.get_json(silent=True) or {}

    allowed = {"name", "email", "license_number", "avatar_url", "is_verified"}
    update_data = {k: v for k, v in body.items() if k in allowed}
    if not update_data:
        return jsonify({"error": "Nothing to update"}), 400

    result = sb.table("drivers").update(update_data).eq("id", driver_id).execute()
    if not result.data:
        return jsonify({"error": "Driver not found"}), 404

    d = result.data[0]
    d.pop("password_hash", None)
    return jsonify(d)


# ─── Auto-Assign Drivers to Routes ─────────────────────
@drivers_bp.route("/api/drivers/auto-assign", methods=["POST"])
def auto_assign_drivers():
    """Assign available online drivers to routes based on proximity.

    POST body: { route_ids: [uuid, ...] }
    For each route, finds the nearest available driver (no active task)
    and assigns them. Returns the assignment map.
    """
    sb = get_supabase()
    body = request.get_json(silent=True) or {}
    route_ids = body.get("route_ids", [])

    if not route_ids:
        return jsonify({"error": "route_ids is required"}), 400

    routes = sb.table("routes").select("id,cluster_id,vehicle_name,points").in_("id", route_ids).execute()
    if not routes.data:
        return jsonify({"assignments": [], "message": "No routes found"})

    drivers = sb.table("drivers").select("*").eq("is_online", True).execute()
    all_drivers = drivers.data or []

    busy_ids = set()
    if all_drivers:
        d_ids = [d["id"] for d in all_drivers]
        tasks_res = sb.table("driver_tasks").select("driver_id").in_("driver_id", d_ids).in_("status", ["assigned", "in_progress"]).execute()
        busy_ids = {t["driver_id"] for t in (tasks_res.data or [])}

    available = [d for d in all_drivers if d["id"] not in busy_ids]

    locations = {}
    if available:
        a_ids = [d["id"] for d in available]
        loc_res = sb.table("driver_locations").select("*").in_("driver_id", a_ids).execute()
        locations = {loc["driver_id"]: loc for loc in (loc_res.data or [])}

    assignments = []
    assigned_driver_ids = set()

    for route in routes.data:
        stops = route.get("points") or []
        if not stops:
            continue
        start_lat, start_lng = stops[0].get("lat", 0), stops[0].get("lng", 0)

        best_driver = None
        best_dist = float("inf")
        for d in available:
            if d["id"] in assigned_driver_ids:
                continue
            loc = locations.get(d["id"])
            if loc and loc.get("lat") and loc.get("lng"):
                dist = _haversine_km(start_lat, start_lng, loc["lat"], loc["lng"])
            else:
                dist = 9999
            if dist < best_dist:
                best_dist = dist
                best_driver = d

        if best_driver:
            assigned_driver_ids.add(best_driver["id"])
            try:
                task = sb.table("driver_tasks").insert({
                    "driver_id": best_driver["id"],
                    "route_id": route["id"],
                    "cluster_id": route.get("cluster_id"),
                    "vehicle_name": route.get("vehicle_name"),
                    "status": "assigned",
                    "stops": stops,
                    "current_stop_index": 0,
                }).execute()
                task_data = task.data[0] if task.data else {}
            except Exception:
                task_data = {}

            assignments.append({
                "route_id": route["id"],
                "driver_id": best_driver["id"],
                "driver_name": best_driver["name"],
                "driver_avatar": best_driver.get("avatar_url"),
                "vehicle_name": route.get("vehicle_name"),
                "distance_km": round(best_dist, 1),
                "task_id": task_data.get("id"),
            })

    return jsonify({"assignments": assignments, "unassigned_routes": len(routes.data) - len(assignments)})


# ─── Clear Old Tasks ───────────────────────────────────
@drivers_bp.route("/api/drivers/clear-tasks", methods=["POST"])
def clear_old_tasks():
    """Delete completed/cancelled tasks older than 24h, or all if force=1."""
    sb = get_supabase()
    force = request.args.get("force") == "1"

    if force:
        sb.table("driver_tasks").delete().neq("status", "__never__").execute()
        return jsonify({"cleared": "all"})

    sb.table("driver_tasks").delete().in_("status", ["completed", "cancelled"]).execute()
    return jsonify({"cleared": "completed_and_cancelled"})
