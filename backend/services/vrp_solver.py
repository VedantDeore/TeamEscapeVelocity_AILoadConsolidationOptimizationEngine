"""
Lorri — VRP Route Optimization Service

Uses Google OR-Tools to solve a Capacitated Vehicle Routing Problem
with Time Windows (CVRPTW).

Falls back to a greedy nearest-neighbor tour if OR-Tools times out.
"""

import math
from geopy.distance import geodesic

# Try to import OR-Tools; gracefully degrade if not installed
try:
    from ortools.constraint_solver import routing_enums_pb2, pywrapcp
    ORTOOLS_AVAILABLE = True
except ImportError:
    ORTOOLS_AVAILABLE = False


# ── helpers ────────────────────────────────────────────────

def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    try:
        return geodesic((lat1, lng1), (lat2, lng2)).km
    except Exception:
        return 0.0


def _build_distance_matrix(stops: list) -> list[list[int]]:
    """
    Returns a distance matrix in metres (integers) for OR-Tools.
    stops: list of {"lat": float, "lng": float, ...}
    """
    n = len(stops)
    matrix = []
    for i in range(n):
        row = []
        for j in range(n):
            if i == j:
                row.append(0)
            else:
                km  = _haversine_km(stops[i]["lat"], stops[i]["lng"],
                                     stops[j]["lat"], stops[j]["lng"])
                row.append(int(km * 1000))   # metres as int
        matrix.append(row)
    return matrix


# ── greedy nearest-neighbour fallback ─────────────────────

def _greedy_route(stops: list) -> list:
    """Return indices in visit order using nearest-neighbour heuristic."""
    if len(stops) <= 1:
        return list(range(len(stops)))

    unvisited = list(range(1, len(stops)))   # depot is index 0
    route = [0]
    while unvisited:
        last = route[-1]
        nearest = min(
            unvisited,
            key=lambda j: _haversine_km(
                stops[last]["lat"], stops[last]["lng"],
                stops[j]["lat"], stops[j]["lng"]
            )
        )
        route.append(nearest)
        unvisited.remove(nearest)
    route.append(0)  # return to depot
    return route


def _route_from_order(stops: list, order: list) -> dict:
    """Build the route result dict from an ordered index list."""
    ordered_stops = []
    total_km = 0.0

    for k in range(len(order)):
        idx = order[k]
        s = stops[idx].copy()
        s["sequence"] = k + 1
        ordered_stops.append(s)

        if k > 0:
            prev = stops[order[k - 1]]
            total_km += _haversine_km(
                prev["lat"], prev["lng"],
                s["lat"], s["lng"]
            )

    avg_speed_kmh = 60.0
    total_hours   = total_km / avg_speed_kmh if avg_speed_kmh > 0 else 0
    hours         = int(total_hours)
    minutes       = int((total_hours - hours) * 60)

    # Approximate fuel cost (₹8.5/km, avg truck)
    fuel_cost = round(total_km * 8.5, 2)

    return {
        "stops":              ordered_stops,
        "total_distance_km":  round(total_km, 2),
        "estimated_time":     f"{hours}h {minutes}m",
        "fuel_cost":          fuel_cost,
        "solver":             "ortools" if ORTOOLS_AVAILABLE else "greedy",
    }


# ── OR-Tools VRP solver ────────────────────────────────────

def _ortools_solve(stops: list, vehicle_capacity_kg: float,
                   shipment_weights: list[float]) -> list:
    """
    Run OR-Tools CVRPTW. Returns ordered index list.
    Depot is index 0.
    """
    dist_matrix = _build_distance_matrix(stops)
    n = len(stops)

    manager  = pywrapcp.RoutingIndexManager(n, 1, 0)
    routing  = pywrapcp.RoutingModel(manager)

    def distance_callback(from_idx, to_idx):
        i = manager.IndexToNode(from_idx)
        j = manager.IndexToNode(to_idx)
        return dist_matrix[i][j]

    cb_idx = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(cb_idx)

    def demand_callback(from_idx):
        node = manager.IndexToNode(from_idx)
        if node == 0:
            return 0
        weight_idx = node - 1
        if weight_idx < len(shipment_weights):
            return int(shipment_weights[weight_idx])
        return 0

    demand_cb_idx = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_cb_idx, 0,
        [int(vehicle_capacity_kg)],
        True, "Capacity"
    )

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    params.time_limit.seconds = 5   # 5-second limit for hackathon demos

    solution = routing.SolveWithParameters(params)

    if not solution:
        return _greedy_route(stops)

    # Extract route
    route = []
    idx = routing.Start(0)
    while not routing.IsEnd(idx):
        route.append(manager.IndexToNode(idx))
        idx = solution.Value(routing.NextVar(idx))
    route.append(manager.IndexToNode(idx))   # depot end
    return route


# ── public entry point ─────────────────────────────────────

def optimize_route(cluster_shipments: list, vehicle: dict,
                   depot: dict | None = None) -> dict:
    """
    Optimise the pickup/delivery route for a cluster.

    Strategy — Sweep algorithm with pickup-before-delivery constraint:
      1. Build per-shipment pickup & delivery stops (no merging).
      2. Phase 1 (Pickups):  Starting from depot, visit ALL pickups
         using nearest-neighbour.  Load increases at each pickup.
      3. Phase 2 (Deliveries): Starting from the last pickup, visit
         ALL deliveries using nearest-neighbour.  Load decreases.
      4. Return to depot.

    This guarantees every pickup occurs before every delivery, the
    truck is fully loaded in the middle, and the route is distance-
    optimised within each phase.

    After building the NN route we apply 2-opt local search within
    each phase to shorten the total distance further.
    """
    if not cluster_shipments:
        return {"stops": [], "total_distance_km": 0, "estimated_time": "0h 0m",
                "fuel_cost": 0, "solver": "none"}

    max_capacity = float(vehicle.get("max_weight_kg", 12000))

    # ── Build depot stop ──
    if depot:
        depot_stop = {
            "lat":  depot.get("lat", 28.6139),
            "lng":  depot.get("lng", 77.2090),
            "city": depot.get("city", "Depot"),
            "type": "depot",
        }
    else:
        first = cluster_shipments[0]
        depot_stop = {
            "lat":  first.get("origin_lat", 28.6139),
            "lng":  first.get("origin_lng", 77.2090),
            "city": first.get("origin_city", "Depot"),
            "type": "depot",
        }

    # ── Build per-shipment pickup & delivery stops ──
    # No deduplication — each shipment gets its own pickup + delivery
    # so load tracking is accurate per-shipment.
    pickup_stops = []
    delivery_stops = []

    for s in cluster_shipments:
        weight = float(s.get("weight_kg", 1000))
        code   = s.get("shipment_code", s.get("id", ""))

        pickup_stops.append({
            "lat":  s.get("origin_lat"),
            "lng":  s.get("origin_lng"),
            "city": s.get("origin_city", ""),
            "type": "pickup",
            "shipment_code": code,
            "weight_kg": weight,
        })
        delivery_stops.append({
            "lat":  s.get("dest_lat"),
            "lng":  s.get("dest_lng"),
            "city": s.get("dest_city", ""),
            "type": "delivery",
            "shipment_code": code,
            "weight_kg": weight,
        })

    # ── Nearest-neighbour within a phase ──
    def nn_order(stops_list, start_lat, start_lng):
        if not stops_list:
            return []
        remaining = set(range(len(stops_list)))
        ordered = []
        cur_lat, cur_lng = start_lat, start_lng
        while remaining:
            nearest = min(remaining, key=lambda i: _haversine_km(
                cur_lat, cur_lng, stops_list[i]["lat"], stops_list[i]["lng"]
            ))
            ordered.append(nearest)
            cur_lat = stops_list[nearest]["lat"]
            cur_lng = stops_list[nearest]["lng"]
            remaining.discard(nearest)
        return ordered

    # ── 2-opt improvement within a phase ──
    def two_opt(stops_list, order):
        """Improve a given order by swapping pairs (2-opt local search)."""
        if len(order) < 3:
            return order
        improved = True
        best = list(order)
        while improved:
            improved = False
            for i in range(len(best) - 1):
                for j in range(i + 2, len(best)):
                    # Cost of current edges
                    a, b = best[i], best[(i + 1) % len(best)]
                    c, d = best[j], best[(j + 1) % len(best)] if j + 1 < len(best) else best[0]
                    old_dist = (_haversine_km(stops_list[a]["lat"], stops_list[a]["lng"],
                                              stops_list[b]["lat"], stops_list[b]["lng"]) +
                                _haversine_km(stops_list[c]["lat"], stops_list[c]["lng"],
                                              stops_list[d]["lat"], stops_list[d]["lng"]))
                    new_dist = (_haversine_km(stops_list[a]["lat"], stops_list[a]["lng"],
                                              stops_list[c]["lat"], stops_list[c]["lng"]) +
                                _haversine_km(stops_list[b]["lat"], stops_list[b]["lng"],
                                              stops_list[d]["lat"], stops_list[d]["lng"]))
                    if new_dist < old_dist - 0.01:
                        best[i + 1:j + 1] = reversed(best[i + 1:j + 1])
                        improved = True
        return best

    # Phase 1 — order pickups from depot, then 2-opt
    pickup_order = nn_order(pickup_stops, depot_stop["lat"], depot_stop["lng"])
    pickup_order = two_opt(pickup_stops, pickup_order)
    ordered_pickups = [pickup_stops[i] for i in pickup_order]

    # Phase 2 — order deliveries from last pickup, then 2-opt
    if ordered_pickups:
        last = ordered_pickups[-1]
        delivery_order = nn_order(delivery_stops, last["lat"], last["lng"])
    else:
        delivery_order = nn_order(delivery_stops, depot_stop["lat"], depot_stop["lng"])
    delivery_order = two_opt(delivery_stops, delivery_order)
    ordered_deliveries = [delivery_stops[i] for i in delivery_order]

    # ── Assemble final route: Depot → Pickups → Deliveries → Depot ──
    depot_end = dict(depot_stop)  # copy so sequence doesn't overwrite start
    all_stops = [depot_stop] + ordered_pickups + ordered_deliveries + [depot_end]

    # ── Calculate distance & load tracking ──
    total_km = 0.0
    current_load = 0.0
    for i, stop in enumerate(all_stops):
        stop["sequence"] = i + 1
        if i > 0:
            total_km += _haversine_km(
                all_stops[i - 1]["lat"], all_stops[i - 1]["lng"],
                stop["lat"], stop["lng"]
            )
        if stop["type"] == "pickup":
            current_load += stop.get("weight_kg", 0)
        elif stop["type"] == "delivery":
            current_load -= stop.get("weight_kg", 0)
            current_load = max(0, current_load)

        if stop["type"] in ("pickup", "delivery"):
            stop["current_load_kg"] = round(current_load, 1)
            stop["load_pct"] = round((current_load / max_capacity) * 100, 1) if max_capacity > 0 else 0

    avg_speed_kmh = 60.0
    total_hours = total_km / avg_speed_kmh if avg_speed_kmh > 0 else 0
    hours = int(total_hours)
    minutes = int((total_hours - hours) * 60)
    fuel_cost = round(total_km * 8.5, 2)

    return {
        "stops":              all_stops,
        "total_distance_km":  round(total_km, 2),
        "estimated_time":     f"{hours}h {minutes}m",
        "fuel_cost":          fuel_cost,
        "solver":             "sweep-nn-2opt",
    }
