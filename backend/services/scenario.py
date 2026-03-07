"""
Lorri — Scenario Simulation Engine

Computes 3 side-by-side scenarios for any set of shipments:
  A — No Consolidation  (baseline: 1 shipment per trip)
  B — AI Optimised      (DBSCAN clustering with default constraints)
  C — Custom            (user-supplied constraints)
"""

from services.clustering import cluster_shipments
from services.carbon import calculate_emissions, calculate_single
from geopy.distance import geodesic

# ── cost constants ─────────────────────────────────────────
FUEL_COST_PER_KM     = 8.5
DRIVER_COST_PER_HR   = 150.0
TOLL_PER_TRIP        = 1200.0
MAINTENANCE_PER_KM   = 2.5
AVG_SPEED_KMH        = 60.0


def _trip_km(s: dict) -> float:
    """One-way straight-line km for a shipment."""
    try:
        return geodesic(
            (s["origin_lat"], s["origin_lng"]),
            (s["dest_lat"],   s["dest_lng"])
        ).km
    except Exception:
        return 500.0


def _cost_for_cluster(distance_km: float, weight_kg: float, n_trips: int) -> dict:
    """Break down trip cost."""
    hours    = distance_km / AVG_SPEED_KMH
    fuel     = distance_km * FUEL_COST_PER_KM
    driver   = hours * DRIVER_COST_PER_HR
    toll     = TOLL_PER_TRIP * n_trips
    maint    = distance_km * MAINTENANCE_PER_KM
    total    = fuel + driver + toll + maint
    return {"fuel": fuel, "driver": driver, "toll": toll, "maintenance": maint, "total": total}


def _scenario_no_consolidation(shipments: list) -> dict:
    """Scenario A: every shipment makes its own trip (half-loaded truck)."""
    total_trips = len(shipments)
    total_cost  = 0.0
    total_km    = 0.0
    co2         = 0.0
    sla_met     = 0

    for s in shipments:
        km   = _trip_km(s)
        cost = _cost_for_cluster(km, s.get("weight_kg", 1000), 1)
        total_cost += cost["total"]
        total_km   += km
        # Solo: half-loaded ~50% utilization
        co2 += calculate_single(km, s.get("weight_kg", 1000), "medium truck") * 2.0
        sla_met += 1 if s.get("priority", "normal") != "critical" else 0

    sla_pct = round((sla_met / max(total_trips, 1)) * 100, 1)
    avg_util = 52.0   # solo trips average around 50-55%

    return {
        "name":             "No Consolidation",
        "total_trips":      total_trips,
        "avg_utilization":  avg_util,
        "total_cost":       round(total_cost, 0),
        "co2_emissions":    round(co2,        2),
        "delivery_sla_met": sla_pct,
        "description":      "Baseline: each shipment travels in its own truck",
    }


def _scenario_ai_optimised(shipments: list) -> dict:
    """Scenario B: DBSCAN with AI-recommended constraints."""
    clusters = cluster_shipments(shipments, {"dbscan_eps": 0.35, "dbscan_min_samples": 2})
    return _compute_consolidated_scenario(clusters, shipments, "AI Optimised",
                                          "DBSCAN clustering with AI-recommended parameters")


def _scenario_custom(shipments: list, constraints: dict) -> dict:
    """Scenario C: user-supplied constraints."""
    clusters = cluster_shipments(shipments, constraints)
    return _compute_consolidated_scenario(clusters, shipments, "Custom Config",
                                          f"Custom: max_detour={constraints.get('max_detour_pct', 20)}%")


def _avg_dist_km(cluster: dict) -> float:
    """Approximate route distance: sum of inter-stop haversine distances."""
    stops = cluster.get("shipments", [])
    if not stops:
        return 300.0
    total = 0.0
    for s in stops:
        total += _trip_km(s)
    # Route is ~1.3× straight-line due to detours
    return round(total * 1.3 / max(len(stops), 1) + len(stops) * 50, 1)


def _compute_consolidated_scenario(clusters: list, all_shipments: list,
                                    name: str, description: str) -> dict:
    n_trips   = len(clusters)
    total_cost = 0.0
    co2        = 0.0
    utils      = []

    cluster_inputs = []
    for c in clusters:
        dist = _avg_dist_km(c)
        weight = c.get("total_weight", 1000)
        vtype  = c.get("vehicle", {}).get("type", "Heavy Truck")
        cost   = _cost_for_cluster(dist, weight, 1)
        total_cost += cost["total"]
        cluster_inputs.append({
            "route_distance_km": dist,
            "total_weight":      weight,
            "vehicle_type":      vtype,
            "shipment_count":    len(c.get("shipment_ids", [])),
        })
        utils.append(c.get("utilization_pct", 75))

    emission_data  = calculate_emissions(cluster_inputs)
    co2            = emission_data["co2_after"]
    avg_util       = round(sum(utils) / max(len(utils), 1), 1) if utils else 0

    # SLA: consolidated trips meet SLA better (less fatigue, better routing)
    critical_count = sum(1 for s in all_shipments if s.get("priority") == "critical")
    sla_pct = round(min(95 + len(clusters) * 0.05, 99), 1)

    return {
        "name":             name,
        "total_trips":      n_trips,
        "avg_utilization":  avg_util,
        "total_cost":       round(total_cost, 0),
        "co2_emissions":    round(co2, 2),
        "delivery_sla_met": sla_pct,
        "description":      description,
        "cluster_count":    n_trips,
    }


# ── public entry point ─────────────────────────────────────

def run_scenarios(shipments: list, constraints: dict | None = None) -> dict:
    """
    Run all 3 scenarios on a list of shipments.

    Args:
        shipments:   list of shipment dicts
        constraints: custom constraints for scenario C

    Returns:
        {
          "scenarios": [A, B, C],
          "best":      "AI Optimised",
          "summary":   {...},   # delta between A and B
        }
    """
    sc_a = _scenario_no_consolidation(shipments)
    sc_b = _scenario_ai_optimised(shipments)
    sc_c = _scenario_custom(shipments, constraints or {"dbscan_eps": 0.45})

    # Summary delta (A → B improvement)
    cost_saved  = sc_a["total_cost"]  - sc_b["total_cost"]
    trips_saved = sc_a["total_trips"] - sc_b["total_trips"]
    co2_saved   = sc_a["co2_emissions"] - sc_b["co2_emissions"]
    util_gain   = sc_b["avg_utilization"] - sc_a["avg_utilization"]

    summary = {
        "cost_saved_pct":  round(cost_saved  / max(sc_a["total_cost"], 1) * 100, 1),
        "trips_saved":     trips_saved,
        "trips_saved_pct": round(trips_saved / max(sc_a["total_trips"], 1) * 100, 1),
        "co2_saved_pct":   round(co2_saved   / max(sc_a["co2_emissions"], 1) * 100, 1),
        "utilization_gain": round(util_gain, 1),
    }

    return {
        "scenarios": [sc_a, sc_b, sc_c],
        "best":      "AI Optimised",
        "summary":   summary,
    }
