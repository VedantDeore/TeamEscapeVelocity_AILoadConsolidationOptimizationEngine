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

    insert_data = {
        "name": body["name"],
        "phone": body["phone"],
        "email": body.get("email"),
        "password_hash": generate_password_hash(body["password"]),
        "license_number": body.get("license_number"),
        "is_online": False,
        "is_verified": False,
        "driver_status": "idle_at_home",
    }

    home_address = body.get("home_address", "").strip()
    if home_address:
        insert_data["home_address"] = home_address
        try:
            from utils.geocoding import geocode
            geo = geocode(home_address)
            if geo:
                insert_data["home_lat"] = geo["lat"]
                insert_data["home_lng"] = geo["lng"]
                display = geo.get("display_name", "")
                parts = [p.strip() for p in display.split(",")]
                insert_data["home_city"] = parts[0] if parts else home_address
        except Exception:
            pass

    driver = sb.table("drivers").insert(insert_data).execute()

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
            driver_update = {"assigned_vehicle_id": None}
            stops = task_data.get("stops") or []
            if stops:
                last_stop = stops[-1]
                driver_update["current_lat"] = last_stop.get("lat")
                driver_update["current_lng"] = last_stop.get("lng")
                driver_update["current_city"] = last_stop.get("city", "")
                driver_update["driver_status"] = "idle_at_depot"
            else:
                driver_update["driver_status"] = "idle_at_home"
            sb.table("drivers").update(driver_update).eq("id", task_data["driver_id"]).execute()
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

    allowed = {
        "name", "email", "license_number", "avatar_url", "is_verified",
        "home_address", "home_city", "home_lat", "home_lng",
        "current_city", "current_lat", "current_lng", "driver_status",
    }
    update_data = {k: v for k, v in body.items() if k in allowed}

    if "home_address" in update_data and update_data["home_address"]:
        addr = update_data["home_address"].strip()
        if addr:
            try:
                from utils.geocoding import geocode
                geo = geocode(addr)
                if geo:
                    update_data["home_lat"] = geo["lat"]
                    update_data["home_lng"] = geo["lng"]
                    display = geo.get("display_name", "")
                    parts = [p.strip() for p in display.split(",")]
                    update_data["home_city"] = parts[0] if parts else addr
            except Exception:
                pass

    if not update_data:
        return jsonify({"error": "Nothing to update"}), 400

    result = sb.table("drivers").update(update_data).eq("id", driver_id).execute()
    if not result.data:
        return jsonify({"error": "Driver not found"}), 404

    d = result.data[0]
    d.pop("password_hash", None)
    return jsonify(d)


# ─── Fetch Existing Route Assignments (no new creation) ──
@drivers_bp.route("/api/drivers/route-assignments", methods=["POST"])
def get_route_assignments():
    """Return existing active assignments for given route_ids.
    Does NOT create new assignments — read-only lookup."""
    body = request.get_json(silent=True) or {}
    route_ids = body.get("route_ids", [])
    if not route_ids:
        return jsonify({"assignments": [], "unassigned_routes": 0})

    from services.driver_assignment import get_existing_assignments
    assignments = get_existing_assignments(route_ids)
    return jsonify({
        "assignments": assignments,
        "unassigned_routes": len(route_ids) - len(assignments),
    })


# ─── Auto-Assign Drivers to Routes ─────────────────────
@drivers_bp.route("/api/drivers/auto-assign", methods=["POST"])
def auto_assign_drivers():
    """Assign available drivers to routes using smart GPS-based algorithm.

    POST body: { route_ids: [uuid, ...], force: bool }
    - Skips routes that already have active assignments.
    - If force=true, clears existing assignments first and reassigns all.
    """
    sb = get_supabase()
    body = request.get_json(silent=True) or {}
    route_ids = body.get("route_ids", [])
    force = body.get("force", False)

    if not route_ids:
        return jsonify({"error": "route_ids is required"}), 400

    if force:
        old_tasks = sb.table("driver_tasks").select("id,driver_id").in_(
            "route_id", route_ids
        ).in_("status", ["assigned", "en_route"]).execute()
        for t in (old_tasks.data or []):
            sb.table("driver_tasks").update({"status": "cancelled"}).eq(
                "id", t["id"]).execute()
            sb.table("drivers").update(
                {"driver_status": "idle_at_home"}
            ).eq("id", t["driver_id"]).eq("driver_status", "assigned").execute()

    from services.driver_assignment import assign_drivers_to_routes
    assignments = assign_drivers_to_routes(route_ids)

    return jsonify({
        "assignments": assignments,
        "unassigned_routes": len(route_ids) - len(assignments),
    })


# ─── Start a Driver Task (mark en_route) ──────────────
@drivers_bp.route("/api/drivers/tasks/<task_id>/start", methods=["POST"])
def start_task(task_id):
    """Mark a task as en_route with started_at timestamp."""
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    result = sb.table("driver_tasks").update({
        "status": "en_route",
        "started_at": now,
    }).eq("id", task_id).execute()
    if not result.data:
        return jsonify({"error": "Task not found"}), 404

    task = result.data[0]
    try:
        sb.table("drivers").update({
            "driver_status": "en_route",
        }).eq("id", task["driver_id"]).execute()
    except Exception:
        pass

    return jsonify(task)


# ─── All Driver Positions (effective locations) ────────
@drivers_bp.route("/api/drivers/all-positions", methods=["GET"])
def all_driver_positions():
    """Return effective position for every driver (for the all-drivers map).
    Uses home location or current location based on status."""
    sb = get_supabase()
    drivers = sb.table("drivers").select(
        "id,name,avatar_url,driver_status,home_city,home_lat,home_lng,"
        "current_city,current_lat,current_lng,is_online"
    ).execute()
    if not drivers.data:
        return jsonify([])

    result = []
    for d in drivers.data:
        lat, lng, city = None, None, ""
        status = d.get("driver_status", "idle_at_home")
        if status in ("idle_at_depot", "en_route", "assigned") and d.get("current_lat"):
            lat, lng, city = d["current_lat"], d["current_lng"], d.get("current_city", "")
        elif d.get("home_lat"):
            lat, lng, city = d["home_lat"], d["home_lng"], d.get("home_city", "")

        if lat is None:
            continue

        result.append({
            "driver_id": d["id"],
            "name": d.get("name", "Unknown"),
            "avatar_url": d.get("avatar_url"),
            "driver_status": status,
            "city": city,
            "lat": lat,
            "lng": lng,
            "is_online": d.get("is_online", False),
        })

    return jsonify(result)


# ─── Live Driver Positions (interpolated from journey) ──
@drivers_bp.route("/api/drivers/live-journey-positions", methods=["GET"])
def live_journey_positions():
    """For drivers with active en_route tasks, interpolate their position
    based on elapsed time vs estimated delivery time."""
    sb = get_supabase()

    tasks_res = sb.table("driver_tasks").select("*").eq("status", "en_route").execute()
    tasks = tasks_res.data or []
    if not tasks:
        return jsonify([])

    driver_ids = list({t["driver_id"] for t in tasks})
    drivers_res = sb.table("drivers").select("id,name,avatar_url,is_online").in_("id", driver_ids).execute()
    driver_map = {d["id"]: d for d in (drivers_res.data or [])}

    route_ids = list({t["route_id"] for t in tasks if t.get("route_id")})
    route_map = {}
    if route_ids:
        routes_res = sb.table("routes").select("id,estimated_time,total_distance_km").in_("id", route_ids).execute()
        route_map = {r["id"]: r for r in (routes_res.data or [])}

    now = datetime.now(timezone.utc)
    result = []

    for task in tasks:
        drv = driver_map.get(task["driver_id"], {})
        stops = task.get("stops") or []
        if len(stops) < 2:
            continue

        started_at = task.get("started_at")
        if not started_at:
            result.append({
                "driver_id": task["driver_id"],
                "name": drv.get("name", "Unknown"),
                "avatar_url": drv.get("avatar_url"),
                "lat": stops[0].get("lat"),
                "lng": stops[0].get("lng"),
                "city": stops[0].get("city", ""),
                "progress_pct": 0,
                "task_status": "en_route",
                "is_online": drv.get("is_online", False),
            })
            continue

        route = route_map.get(task.get("route_id"), {})
        est_time_str = route.get("estimated_time", "")
        import re
        total_hours = 0
        h_match = re.search(r"(\d+)\s*h", est_time_str)
        m_match = re.search(r"(\d+)\s*m", est_time_str)
        if h_match:
            total_hours += int(h_match.group(1))
        if m_match:
            total_hours += int(m_match.group(1)) / 60.0
        if total_hours <= 0:
            total_hours = 24

        try:
            start_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        except Exception:
            start_dt = now

        elapsed_hours = (now - start_dt).total_seconds() / 3600.0
        progress = min(1.0, max(0.0, elapsed_hours / total_hours))

        total_dist = 0
        seg_dists = []
        for i in range(1, len(stops)):
            dlat = stops[i]["lat"] - stops[i-1]["lat"]
            dlng = stops[i]["lng"] - stops[i-1]["lng"]
            d = math.sqrt(dlat*dlat + dlng*dlng)
            seg_dists.append(d)
            total_dist += d

        target_dist = progress * total_dist
        accum = 0
        lat, lng, city = stops[0]["lat"], stops[0]["lng"], stops[0].get("city", "")
        for i, sd in enumerate(seg_dists):
            if accum + sd >= target_dist:
                frac = (target_dist - accum) / sd if sd > 0 else 0
                lat = stops[i]["lat"] + (stops[i+1]["lat"] - stops[i]["lat"]) * frac
                lng = stops[i]["lng"] + (stops[i+1]["lng"] - stops[i]["lng"]) * frac
                city = stops[i+1].get("city", stops[i].get("city", ""))
                break
            accum += sd
        else:
            lat = stops[-1]["lat"]
            lng = stops[-1]["lng"]
            city = stops[-1].get("city", "")

        result.append({
            "driver_id": task["driver_id"],
            "name": drv.get("name", "Unknown"),
            "avatar_url": drv.get("avatar_url"),
            "lat": lat,
            "lng": lng,
            "city": city,
            "progress_pct": round(progress * 100, 1),
            "elapsed_hours": round(elapsed_hours, 1),
            "total_hours": round(total_hours, 1),
            "task_status": "en_route",
            "is_online": drv.get("is_online", False),
        })

    return jsonify(result)


# ─── Simulate Complete Task (instant demo delivery) ────
@drivers_bp.route("/api/drivers/tasks/<task_id>/simulate-complete", methods=["POST"])
def simulate_complete_task(task_id):
    sb = get_supabase()
    task_res = sb.table("driver_tasks").select("*").eq("id", task_id).execute()
    if not task_res.data:
        return jsonify({"error": "Task not found"}), 404

    task = task_res.data[0]
    stops = task.get("stops") or []
    now = datetime.now(timezone.utc).isoformat()

    for i, stop in enumerate(stops):
        stop["status"] = "completed"
    update_data = {
        "status": "completed",
        "stops": stops,
        "current_stop_index": len(stops),
        "completed_at": now,
    }
    if not task.get("started_at"):
        update_data["started_at"] = now

    result = sb.table("driver_tasks").update(update_data).eq("id", task_id).execute()
    task_data = result.data[0] if result.data else {}

    if task.get("driver_id") and stops:
        last_stop = stops[-1]
        try:
            sb.table("drivers").update({
                "assigned_vehicle_id": None,
                "current_lat": last_stop.get("lat"),
                "current_lng": last_stop.get("lng"),
                "current_city": last_stop.get("city", ""),
                "driver_status": "idle_at_depot",
            }).eq("id", task["driver_id"]).execute()
        except Exception:
            pass

    return jsonify(task_data)


# ─── Free All Drivers (reset ANY status → idle_at_home + cancel tasks) ──
@drivers_bp.route("/api/drivers/free-all", methods=["POST"])
def free_all_drivers():
    sb = get_supabase()

    active_tasks = sb.table("driver_tasks").select("id").in_(
        "status", ["assigned", "en_route"]
    ).execute()
    cancelled = 0
    for t in (active_tasks.data or []):
        sb.table("driver_tasks").update({"status": "cancelled"}).eq("id", t["id"]).execute()
        cancelled += 1

    result = sb.table("drivers").select("id").neq("driver_status", "idle_at_home").execute()
    ids = [d["id"] for d in (result.data or [])]
    for did in ids:
        sb.table("drivers").update({
            "driver_status": "idle_at_home",
            "current_lat": None,
            "current_lng": None,
            "current_city": None,
        }).eq("id", did).execute()

    return jsonify({"freed": len(ids), "tasks_cancelled": cancelled})


# ─── Free Single Driver ────────────────────────────────
@drivers_bp.route("/api/drivers/<driver_id>/free", methods=["POST"])
def free_driver(driver_id):
    sb = get_supabase()
    result = sb.table("drivers").update({
        "driver_status": "idle_at_home",
        "current_lat": None,
        "current_lng": None,
        "current_city": None,
    }).eq("id", driver_id).execute()
    if not result.data:
        return jsonify({"error": "Driver not found"}), 404
    d = result.data[0]
    d.pop("password_hash", None)
    return jsonify(d)


# ─── Auto-Release Completed Trips ─────────────────────
@drivers_bp.route("/api/drivers/release-completed", methods=["POST"])
def release_completed():
    """Check all en_route tasks; if elapsed time > estimated delivery time,
    mark task completed and driver idle_at_depot at destination."""
    from services.driver_assignment import release_completed_trips
    released = release_completed_trips()
    return jsonify({"released": released})


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
