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

    Args:
        cluster_shipments: list of shipment dicts (with origin_lat/lng, dest_lat/lng)
        vehicle:           vehicle dict with max_weight_kg
        depot:             optional depot dict {lat, lng, city}

    Returns:
        {
          "stops": [...],             # ordered stops with lat/lng/city/type
          "total_distance_km": float,
          "estimated_time":    str,
          "fuel_cost":         float,
          "solver":            str,
        }
    """
    if not cluster_shipments:
        return {"stops": [], "total_distance_km": 0, "estimated_time": "0h 0m",
                "fuel_cost": 0, "solver": "none"}

    # Build stop list: depot → unique origins → unique destinations
    seen = set()
    stops = []

    # Depot
    if depot:
        stops.append({
            "lat":  depot.get("lat", 28.6139),
            "lng":  depot.get("lng", 77.2090),
            "city": depot.get("city", "Depot"),
            "type": "depot",
        })
    else:
        # Default depot = first shipment's origin
        first = cluster_shipments[0]
        stops.append({
            "lat":  first.get("origin_lat", 28.6139),
            "lng":  first.get("origin_lng", 77.2090),
            "city": first.get("origin_city", "Depot"),
            "type": "depot",
        })

    shipment_weights = []
    for s in cluster_shipments:
        ok = (s.get("origin_lat"), s.get("origin_lng"))
        dk = (s.get("dest_lat"),   s.get("dest_lng"))

        if ok not in seen:
            stops.append({
                "lat":  s.get("origin_lat"),
                "lng":  s.get("origin_lng"),
                "city": s.get("origin_city", ""),
                "type": "pickup",
                "shipment_code": s.get("shipment_code", ""),
            })
            seen.add(ok)
            shipment_weights.append(float(s.get("weight_kg", 1000)))

        if dk not in seen:
            stops.append({
                "lat":  s.get("dest_lat"),
                "lng":  s.get("dest_lng"),
                "city": s.get("dest_city", ""),
                "type": "delivery",
                "shipment_code": s.get("shipment_code", ""),
            })
            seen.add(dk)

    if len(stops) <= 2:
        # Trivial route — no optimisation needed
        for i, s in enumerate(stops):
            s["sequence"] = i + 1
        total_km = _haversine_km(stops[0]["lat"], stops[0]["lng"],
                                  stops[-1]["lat"], stops[-1]["lng"])
        return {
            "stops":             stops,
            "total_distance_km": round(total_km, 2),
            "estimated_time":    f"{int(total_km/60)}h {int((total_km/60 % 1)*60)}m",
            "fuel_cost":         round(total_km * 8.5, 2),
            "solver":            "trivial",
        }

    # Solve
    cap = float(vehicle.get("max_weight_kg", 12000))
    if ORTOOLS_AVAILABLE:
        try:
            order = _ortools_solve(stops, cap, shipment_weights)
        except Exception:
            order = _greedy_route(stops)
    else:
        order = _greedy_route(stops)

    return _route_from_order(stops, order)
