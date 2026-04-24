"""
Lorri — VRP Route Optimization Service

Uses Google OR-Tools to solve a Capacitated Vehicle Routing Problem
with Time Windows (CVRPTW).

Falls back to a greedy nearest-neighbor tour if OR-Tools times out.
"""

import math
from utils.distance import geodesic

ORTOOLS_AVAILABLE = None  # resolved lazily on first use
pywrapcp = None
routing_enums_pb2 = None


def _ensure_ortools() -> bool:
    global ORTOOLS_AVAILABLE, pywrapcp, routing_enums_pb2
    if ORTOOLS_AVAILABLE is None:
        try:
            from ortools.constraint_solver import (
                routing_enums_pb2 as _re,
                pywrapcp as _pw,
            )
            pywrapcp = _pw
            routing_enums_pb2 = _re
            ORTOOLS_AVAILABLE = True
        except ImportError:
            ORTOOLS_AVAILABLE = False
    return ORTOOLS_AVAILABLE



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
        "solver":             "ortools" if _ensure_ortools() else "greedy",

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
                   depot: dict | None = None,
                   all_depots: list | None = None) -> dict:
    """
    Optimise the pickup/delivery route for a cluster.

    Strategy — Constraint-aware nearest-neighbour with pickup-before-delivery:
      For each shipment, its delivery is only eligible AFTER its pickup is done.
      At each step, pick the nearest eligible stop (pickup or delivery).

      This produces interleaved routes like:
        Depot → Pickup A → Deliver A → Pickup B → Deliver B → Depot

      Instead of the old broken pattern:
        Depot → Pickup A → Pickup B (200% overload!) → Deliver A → Deliver B

      After building the NN route we apply 2-opt local search that preserves
      the pickup-before-delivery constraint.
    """
    if not cluster_shipments:
        return {"stops": [], "total_distance_km": 0, "estimated_time": "0h 0m",
                "fuel_cost": 0, "solver": "none"}

    max_capacity = float(vehicle.get("max_weight_kg", vehicle.get("max_weight", 12000)))

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

    # ── Build per-shipment pickup & delivery stop pairs ──
    # Each shipment gets its own pickup + delivery.
    # shipment_idx links a delivery to its pickup.
    all_stops = []   # list of stop dicts with "shipment_idx" field

    for idx, s in enumerate(cluster_shipments):
        weight = float(s.get("weight_kg", 1000))
        code   = s.get("shipment_code", s.get("id", ""))

        all_stops.append({
            "lat":  s.get("origin_lat"),
            "lng":  s.get("origin_lng"),
            "city": s.get("origin_city", ""),
            "type": "pickup",
            "shipment_code": code,
            "weight_kg": weight,
            "shipment_idx": idx,
        })
        all_stops.append({
            "lat":  s.get("dest_lat"),
            "lng":  s.get("dest_lng"),
            "city": s.get("dest_city", ""),
            "type": "delivery",
            "shipment_code": code,
            "weight_kg": weight,
            "shipment_idx": idx,
        })

    # ── Capacity-aware nearest-neighbour ──
    # A delivery is only eligible once its corresponding pickup is done.
    # A pickup is only eligible if adding its weight won't exceed vehicle capacity.
    # This naturally produces interleaved routes when capacity is tight:
    #   Depot → Pickup A → Deliver A → Pickup B → Deliver B → Depot
    # And batched routes when capacity allows:
    #   Depot → Pickup A → Pickup B → Deliver A → Deliver B → Depot
    picked_up = set()        # shipment_idx whose pickup is done
    visited   = set()        # indices into all_stops that have been visited
    ordered   = []           # ordered list of stop dicts
    nn_load   = 0.0          # current vehicle load during NN construction

    cur_lat, cur_lng = depot_stop["lat"], depot_stop["lng"]

    while len(visited) < len(all_stops):
        eligible = []
        for si, stop in enumerate(all_stops):
            if si in visited:
                continue
            if stop["type"] == "pickup":
                if nn_load + stop["weight_kg"] <= max_capacity:
                    eligible.append(si)
            elif stop["type"] == "delivery" and stop["shipment_idx"] in picked_up:
                eligible.append(si)

        if not eligible:
            # Deadlock safety: all remaining pickups exceed capacity and
            # no deliveries are available. Force the lightest remaining pickup.
            remaining_pickups = [
                si for si in range(len(all_stops))
                if si not in visited and all_stops[si]["type"] == "pickup"
            ]
            if remaining_pickups:
                nearest_si = min(remaining_pickups, key=lambda si: all_stops[si]["weight_kg"])
                stop = all_stops[nearest_si]
                visited.add(nearest_si)
                ordered.append(stop)
                picked_up.add(stop["shipment_idx"])
                nn_load += stop["weight_kg"]
                cur_lat, cur_lng = stop["lat"], stop["lng"]
                continue
            break

        nearest_si = min(eligible, key=lambda si: _haversine_km(
            cur_lat, cur_lng, all_stops[si]["lat"], all_stops[si]["lng"]
        ))

        stop = all_stops[nearest_si]
        visited.add(nearest_si)
        ordered.append(stop)

        if stop["type"] == "pickup":
            picked_up.add(stop["shipment_idx"])
            nn_load += stop["weight_kg"]
        elif stop["type"] == "delivery":
            nn_load -= stop["weight_kg"]
            nn_load = max(0, nn_load)

        cur_lat, cur_lng = stop["lat"], stop["lng"]

    # ── 2-opt improvement (preserving pickup-before-delivery constraint) ──
    def _is_valid_order(order, cap=None):
        """Check pickup-before-delivery AND that load never exceeds capacity."""
        seen_pickups = set()
        load = 0.0
        for stop in order:
            if stop["type"] == "pickup":
                seen_pickups.add(stop["shipment_idx"])
                load += stop.get("weight_kg", 0)
                if cap is not None and load > cap:
                    return False
            elif stop["type"] == "delivery":
                if stop["shipment_idx"] not in seen_pickups:
                    return False
                load -= stop.get("weight_kg", 0)
                load = max(0, load)
        return True

    def _route_distance(order, start_lat, start_lng):
        total = 0.0
        prev_lat, prev_lng = start_lat, start_lng
        for stop in order:
            total += _haversine_km(prev_lat, prev_lng, stop["lat"], stop["lng"])
            prev_lat, prev_lng = stop["lat"], stop["lng"]
        return total

    # Simple constrained 2-opt
    improved = True
    while improved:
        improved = False
        for i in range(len(ordered) - 1):
            for j in range(i + 2, len(ordered)):
                new_order = ordered[:i+1] + list(reversed(ordered[i+1:j+1])) + ordered[j+1:]
                if _is_valid_order(new_order, max_capacity):
                    old_dist = _route_distance(ordered, depot_stop["lat"], depot_stop["lng"])
                    new_dist = _route_distance(new_order, depot_stop["lat"], depot_stop["lng"])
                    if new_dist < old_dist - 0.01:
                        ordered = new_order
                        improved = True
                        break
            if improved:
                break

    # ── Determine end depot (nearest depot to last stop) ──
    last_stop = ordered[-1] if ordered else depot_stop
    if all_depots and len(all_depots) > 1:
        best_end = None
        best_dist = float("inf")
        for d in all_depots:
            dist = _haversine_km(last_stop["lat"], last_stop["lng"],
                                 d.get("lat", 0), d.get("lng", 0))
            if dist < best_dist:
                best_dist = dist
                best_end = d
        if best_end:
            depot_end = {
                "lat":  best_end.get("lat", depot_stop["lat"]),
                "lng":  best_end.get("lng", depot_stop["lng"]),
                "city": best_end.get("city", depot_stop["city"]),
                "type": "depot",
            }
        else:
            depot_end = dict(depot_stop)
    else:
        depot_end = dict(depot_stop)

    final_stops = [depot_stop] + ordered + [depot_end]

    # ── Calculate distance & load tracking ──
    total_km = 0.0
    current_load = 0.0
    for i, stop in enumerate(final_stops):
        stop["sequence"] = i + 1
        if i > 0:
            total_km += _haversine_km(
                final_stops[i - 1]["lat"], final_stops[i - 1]["lng"],
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

    # Clean up internal field before returning
    for stop in final_stops:
        stop.pop("shipment_idx", None)

    avg_speed_kmh = 60.0
    total_hours = total_km / avg_speed_kmh if avg_speed_kmh > 0 else 0
    hours = int(total_hours)
    minutes = int((total_hours - hours) * 60)
    fuel_cost = round(total_km * 8.5, 2)

    return {
        "stops":              final_stops,
        "total_distance_km":  round(total_km, 2),
        "estimated_time":     f"{hours}h {minutes}m",
        "fuel_cost":          fuel_cost,
        "solver":             "constrained-nn-2opt",
    }
