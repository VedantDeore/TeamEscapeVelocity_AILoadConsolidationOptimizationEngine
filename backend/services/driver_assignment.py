"""Smart driver-to-route assignment with GPS-based scoring, city-name fallback,
on-the-fly geocoding, and automatic trip-completion release."""

import math
import re
import logging
from datetime import datetime, timezone
from models.supabase_client import get_supabase

logger = logging.getLogger(__name__)

DEADHEAD_COST_PER_KM = 8.5
MAX_ASSIGNMENT_DISTANCE_KM = 800


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _effective_location(driver):
    """Return (lat, lng, city) based on driver status."""
    if driver.get("driver_status") == "idle_at_depot":
        clat, clng = driver.get("current_lat"), driver.get("current_lng")
        if clat and clng:
            return float(clat), float(clng), driver.get("current_city", "")
    hlat, hlng = driver.get("home_lat"), driver.get("home_lng")
    if hlat and hlng:
        return float(hlat), float(hlng), driver.get("home_city", "")
    return None, None, ""


def _get_route_origin(route):
    stops = route.get("points") or []
    if not stops:
        return None, None, ""
    first = stops[0]
    return first.get("lat"), first.get("lng"), first.get("city", "")


def _get_route_destination(route):
    stops = route.get("points") or []
    if not stops:
        return None, None, ""
    last = stops[-1]
    return last.get("lat"), last.get("lng"), last.get("city", "")


def _parse_estimated_time(time_str):
    """Parse '22h 15m' into total hours (float)."""
    if not time_str:
        return 0
    hours = 0
    h_match = re.search(r"(\d+)\s*h", str(time_str))
    m_match = re.search(r"(\d+)\s*m", str(time_str))
    if h_match:
        hours += int(h_match.group(1))
    if m_match:
        hours += int(m_match.group(1)) / 60.0
    return hours


def _extract_city_from_address(address):
    """Extract a likely city name from a freeform address string.
    Heuristic: take the second-to-last comma-separated token, or the
    first token if there are fewer than 3 parts."""
    if not address:
        return ""
    parts = [p.strip() for p in address.split(",") if p.strip()]
    if len(parts) >= 3:
        return parts[-2].lower()
    if len(parts) >= 2:
        return parts[-2].lower()
    return parts[0].lower() if parts else ""


def _city_names_match(city_a, city_b):
    """Fuzzy city name comparison."""
    if not city_a or not city_b:
        return False
    a = city_a.strip().lower()
    b = city_b.strip().lower()
    if a == b:
        return True
    if a in b or b in a:
        return True
    a_words = set(a.split())
    b_words = set(b.split())
    if a_words & b_words:
        return True
    return False


def _try_geocode_driver(driver, sb):
    """Attempt to geocode a driver's home_address and update the DB.
    Tries the full address first, then progressively simpler forms.
    Returns (lat, lng) or (None, None)."""
    addr = driver.get("home_address", "").strip()
    if not addr:
        return None, None

    parts = [p.strip() for p in addr.split(",") if p.strip()]
    candidates = [addr]
    if len(parts) >= 3:
        candidates.append(", ".join(parts[-2:]))
    if len(parts) >= 2:
        candidates.append(", ".join(parts[-2:]))
        candidates.append(parts[-1])

    try:
        from utils.geocoding import geocode
        for attempt in candidates:
            geo = geocode(attempt)
            if geo and geo.get("lat") and geo.get("lng"):
                display = geo.get("display_name", "")
                dp = [p.strip() for p in display.split(",")]
                city = dp[0] if dp else attempt
                sb.table("drivers").update({
                    "home_lat": geo["lat"],
                    "home_lng": geo["lng"],
                    "home_city": city,
                }).eq("id", driver["id"]).execute()
                driver["home_lat"] = geo["lat"]
                driver["home_lng"] = geo["lng"]
                driver["home_city"] = city
                logger.info("Geocoded driver %s: '%s' → (%.4f, %.4f)",
                            driver.get("name"), attempt, geo["lat"], geo["lng"])
                return float(geo["lat"]), float(geo["lng"])
    except Exception as e:
        logger.warning("Geocoding failed for %s: %s", driver.get("name"), e)
    return None, None


def _get_city_coords_from_db(city_name, sb):
    """Look up approximate coordinates for a city from the cities table."""
    if not city_name:
        return None, None
    try:
        result = sb.table("cities").select("lat,lng,name").execute()
        for c in (result.data or []):
            if _city_names_match(c.get("name", ""), city_name):
                return float(c["lat"]), float(c["lng"])
    except Exception:
        pass
    return None, None


def _score_driver(driver, origin_lat, origin_lng, origin_city, sb):
    """Score a driver by distance to route origin.

    Strategy (in order):
    1. Use GPS coords if available → exact haversine
    2. Try geocoding from home_address → exact haversine
    3. City-name match → use cities table coords or assume 0km (same city)

    Returns (distance_km, method) or (None, None) if no match possible.
    """
    d_lat, d_lng, d_city = _effective_location(driver)
    if d_lat is not None and d_lng is not None:
        dist = _haversine_km(d_lat, d_lng, origin_lat, origin_lng)
        return round(dist, 2), "gps"

    geo_lat, geo_lng = _try_geocode_driver(driver, sb)
    if geo_lat is not None:
        dist = _haversine_km(geo_lat, geo_lng, origin_lat, origin_lng)
        return round(dist, 2), "geocoded"

    d_city_from_addr = _extract_city_from_address(driver.get("home_address", ""))
    d_home_city = driver.get("home_city", "")
    effective_city = d_home_city or d_city_from_addr

    if _city_names_match(effective_city, origin_city):
        return 0.0, "city_match"

    city_lat, city_lng = _get_city_coords_from_db(effective_city, sb)
    if city_lat is not None:
        dist = _haversine_km(city_lat, city_lng, origin_lat, origin_lng)
        return round(dist, 2), "city_approx"

    logger.debug("Cannot locate driver %s (addr=%s, city=%s)",
                 driver.get("name"), driver.get("home_address"), effective_city)
    return None, None


# ── Auto-release: free drivers whose trips should be done ──────────

def release_completed_trips():
    sb = get_supabase()
    tasks_res = sb.table("driver_tasks").select(
        "id,driver_id,route_id,stops,started_at,status"
    ).eq("status", "en_route").execute()
    tasks = tasks_res.data or []
    if not tasks:
        return 0

    route_ids = list({t["route_id"] for t in tasks if t.get("route_id")})
    route_map = {}
    if route_ids:
        rr = sb.table("routes").select("id,estimated_time").in_("id", route_ids).execute()
        route_map = {r["id"]: r for r in (rr.data or [])}

    now = datetime.now(timezone.utc)
    released = 0

    for task in tasks:
        started_at = task.get("started_at")
        if not started_at:
            continue
        try:
            start_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        except Exception:
            continue

        route = route_map.get(task.get("route_id"), {})
        est_hours = _parse_estimated_time(route.get("estimated_time", ""))
        if est_hours <= 0:
            est_hours = 24

        elapsed_hours = (now - start_dt).total_seconds() / 3600.0
        if elapsed_hours < est_hours:
            continue

        stops = task.get("stops") or []
        for s in stops:
            s["status"] = "completed"

        sb.table("driver_tasks").update({
            "status": "completed",
            "stops": stops,
            "current_stop_index": len(stops),
            "completed_at": now.isoformat(),
        }).eq("id", task["id"]).execute()

        if task.get("driver_id") and stops:
            last = stops[-1]
            sb.table("drivers").update({
                "driver_status": "idle_at_depot",
                "assigned_vehicle_id": None,
                "current_lat": last.get("lat"),
                "current_lng": last.get("lng"),
                "current_city": last.get("city", ""),
            }).eq("id", task["driver_id"]).execute()

        released += 1
        logger.info("Auto-released driver %s (task %s) after %.1fh",
                     task.get("driver_id"), task["id"], elapsed_hours)

    return released


# ── Fetch existing assignments ─────────────────────────────────────

def get_existing_assignments(route_ids):
    sb = get_supabase()
    if not route_ids:
        return []

    release_completed_trips()

    tasks_res = sb.table("driver_tasks").select("*").in_(
        "route_id", route_ids
    ).in_("status", ["assigned", "en_route"]).execute()
    tasks = tasks_res.data or []

    if not tasks:
        return []

    driver_ids = list({t["driver_id"] for t in tasks})
    drivers_res = sb.table("drivers").select("*").in_("id", driver_ids).execute()
    driver_map = {d["id"]: d for d in (drivers_res.data or [])}

    routes_res = sb.table("routes").select(
        "id,vehicle_name,points,estimated_time,total_distance_km"
    ).in_("id", route_ids).execute()
    route_map = {r["id"]: r for r in (routes_res.data or [])}

    cost_row = sb.table("cost_params").select(
        "fuel_cost_per_km,driver_cost_per_hr"
    ).limit(1).execute()
    driver_cost_per_hr = 150
    if cost_row.data:
        driver_cost_per_hr = cost_row.data[0].get("driver_cost_per_hr", 150)

    assignments = []
    for task in tasks:
        drv = driver_map.get(task["driver_id"], {})
        route = route_map.get(task["route_id"], {})
        _, _, d_city = _effective_location(drv)

        est_hours = _parse_estimated_time(route.get("estimated_time", ""))
        driver_hourly_cost = round(est_hours * driver_cost_per_hr, 2)

        assignments.append({
            "route_id": task["route_id"],
            "driver_id": task["driver_id"],
            "driver_name": drv.get("name", ""),
            "driver_avatar": drv.get("avatar_url"),
            "vehicle_name": (task.get("vehicle_name")
                             or route.get("vehicle_name", "")),
            "distance_km": task.get("deadhead_km", 0),
            "deadhead_km": task.get("deadhead_km", 0),
            "deadhead_cost": task.get("deadhead_cost", 0),
            "driver_hourly_cost": driver_hourly_cost,
            "total_driver_cost": round(
                (task.get("deadhead_cost", 0) or 0) + driver_hourly_cost, 2),
            "estimated_hours": round(est_hours, 1),
            "city_match": task.get("city_match", False),
            "driver_city": d_city or drv.get("home_city", ""),
            "task_id": task["id"],
            "task_status": task["status"],
            "started_at": task.get("started_at"),
            "completed_at": task.get("completed_at"),
        })

    return assignments


# ── Core assignment ────────────────────────────────────────────────

def assign_drivers_to_routes(route_ids):
    """Smart driver assignment with multi-level fallback:

    1. Auto-release overdue trips.
    2. Skip routes already assigned.
    3. Load idle drivers, check they have no active tasks.
    4. Score by: GPS coords → geocode retry → city-name match → cities table.
    5. Cap at MAX_ASSIGNMENT_DISTANCE_KM (relaxed to 800km for India scale).
    6. If only one driver is available for a location, auto-assign even without
       explicit button press (the caller controls when this runs).
    7. Greedy nearest-match.
    """
    sb = get_supabase()

    release_completed_trips()

    existing = get_existing_assignments(route_ids)
    already_assigned_route_ids = {a["route_id"] for a in existing}
    already_assigned_driver_ids = {a["driver_id"] for a in existing}

    remaining_route_ids = [
        rid for rid in route_ids if rid not in already_assigned_route_ids
    ]
    if not remaining_route_ids:
        return existing

    routes_res = sb.table("routes").select(
        "id,cluster_id,vehicle_name,points,estimated_time,total_distance_km"
    ).in_("id", remaining_route_ids).execute()
    if not routes_res.data:
        return existing

    drivers_res = sb.table("drivers").select("*").in_(
        "driver_status", ["idle_at_home", "idle_at_depot"]
    ).execute()
    all_idle = drivers_res.data or []

    busy_tasks = sb.table("driver_tasks").select("driver_id").in_(
        "status", ["assigned", "en_route"]
    ).execute()
    busy_driver_ids = {t["driver_id"] for t in (busy_tasks.data or [])}

    available = [
        d for d in all_idle
        if d["id"] not in already_assigned_driver_ids
        and d["id"] not in busy_driver_ids
    ]

    if not available:
        logger.warning("No idle drivers available for assignment (all %d are busy)",
                       len(all_idle))
        return existing

    logger.info("Assignment: %d routes, %d available drivers",
                len(routes_res.data), len(available))

    assigned_ids: set = set()
    new_assignments: list = []

    cost_row = sb.table("cost_params").select(
        "fuel_cost_per_km,driver_cost_per_hr"
    ).limit(1).execute()
    cost_per_km = DEADHEAD_COST_PER_KM
    driver_cost_per_hr = 150
    if cost_row.data:
        cost_per_km = cost_row.data[0].get("fuel_cost_per_km", DEADHEAD_COST_PER_KM)
        driver_cost_per_hr = cost_row.data[0].get("driver_cost_per_hr", 150)

    for route in routes_res.data:
        origin_lat, origin_lng, origin_city = _get_route_origin(route)
        if origin_lat is None:
            logger.warning("Route %s has no origin coordinates, skipping",
                           route["id"][:8])
            continue

        scored = []
        for d in available:
            if d["id"] in assigned_ids:
                continue
            dist, method = _score_driver(d, origin_lat, origin_lng, origin_city, sb)
            if dist is None:
                continue
            if dist > MAX_ASSIGNMENT_DISTANCE_KM:
                logger.debug("Skipping %s (%.0fkm > %dkm cap, method=%s)",
                             d.get("name"), dist, MAX_ASSIGNMENT_DISTANCE_KM, method)
                continue
            scored.append((dist, method, d))

        scored.sort(key=lambda x: x[0])

        if not scored:
            logger.info("No driver within %d km for route %s (origin: %s)",
                        MAX_ASSIGNMENT_DISTANCE_KM, route["id"][:8], origin_city)
            continue

        dist, method, best = scored[0]
        assigned_ids.add(best["id"])

        _, _, d_city = _effective_location(best)
        if not d_city:
            d_city = best.get("home_city", "") or _extract_city_from_address(
                best.get("home_address", ""))

        city_match = method == "city_match" or _city_names_match(d_city, origin_city)

        deadhead_km = dist
        deadhead_cost = round(deadhead_km * cost_per_km, 2) if deadhead_km > 0 else 0
        est_hours = _parse_estimated_time(route.get("estimated_time", ""))
        driver_hourly_cost = round(est_hours * driver_cost_per_hr, 2)
        total_driver_cost = round(deadhead_cost + driver_hourly_cost, 2)

        stops = route.get("points") or []
        try:
            task = sb.table("driver_tasks").insert({
                "driver_id": best["id"],
                "route_id": route["id"],
                "cluster_id": route.get("cluster_id"),
                "vehicle_name": route.get("vehicle_name"),
                "status": "assigned",
                "stops": stops,
                "current_stop_index": 0,
                "deadhead_km": round(deadhead_km, 1),
                "deadhead_cost": deadhead_cost,
                "city_match": city_match,
            }).execute()
            task_data = task.data[0] if task.data else {}
        except Exception as e:
            logger.error("Failed to create task for driver %s: %s",
                         best.get("name"), e)
            task_data = {}

        try:
            sb.table("drivers").update({
                "driver_status": "assigned",
            }).eq("id", best["id"]).execute()
        except Exception:
            pass

        logger.info("Assigned %s (%.0fkm, method=%s) to route %s (%s → %s)",
                     best.get("name"), dist, method,
                     route["id"][:8], origin_city,
                     _get_route_destination(route)[2])

        new_assignments.append({
            "route_id": route["id"],
            "driver_id": best["id"],
            "driver_name": best.get("name", ""),
            "driver_avatar": best.get("avatar_url"),
            "vehicle_name": route.get("vehicle_name"),
            "distance_km": round(dist, 1),
            "deadhead_km": round(deadhead_km, 1),
            "deadhead_cost": deadhead_cost,
            "driver_hourly_cost": driver_hourly_cost,
            "total_driver_cost": total_driver_cost,
            "estimated_hours": round(est_hours, 1),
            "city_match": city_match,
            "driver_city": d_city,
            "task_id": task_data.get("id"),
            "task_status": "assigned",
            "started_at": None,
            "completed_at": None,
        })

    return existing + new_assignments
