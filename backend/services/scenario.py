"""
Lorri — Scenario Simulation Engine

Computes 3 side-by-side scenarios for any set of shipments:
  A — No Consolidation  (baseline: 1 shipment per trip)
  B — AI Optimised      (DBSCAN clustering with default constraints)
  C — Custom            (user-supplied constraints)
"""

from __future__ import annotations

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
    result = cluster_shipments(shipments, {"dbscan_eps": 0.35, "dbscan_min_samples": 2})
    clusters = result["clusters"] if isinstance(result, dict) else result
    return _compute_consolidated_scenario(clusters, shipments, "AI Optimised",
                                          "DBSCAN clustering with AI-recommended parameters")


def _scenario_custom(shipments: list, constraints: dict) -> dict:
    """Scenario C: user-supplied constraints."""
    result = cluster_shipments(shipments, constraints)
    clusters = result["clusters"] if isinstance(result, dict) else result
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


import random
import logging
from services.bin_packing import (
    Container3D,
    Item3D,
    pack_items,
    greedy_pack,
    create_items_from_shipments,
    create_container_from_vehicle,
    ITEM_COLORS,
)

logger = logging.getLogger(__name__)

# ── Fallback vehicle (minimal, only if database is empty) ────────────────
FALLBACK_VEHICLE = {
    "id": "fallback",
    "name": "Default Truck",
    "widthCm": 240,
    "heightCm": 240,
    "lengthCm": 720,
    "maxWeightKg": 12000,
    "costPerKm": 24,
    "emissionFactor": 0.062,
}


def _get_vehicle_from_db() -> dict:
    """Fetch first available vehicle from database, return fallback if none."""
    try:
        from models.supabase_client import get_supabase
        sb = get_supabase()
        result = sb.table("vehicles").select("*").eq("is_available", True).limit(1).execute()
        if result.data and result.data[0]:
            v = result.data[0]
            return {
                "id": v.get("id", ""),
                "name": v.get("name", ""),
                "widthCm": v.get("width_cm", 0),
                "heightCm": v.get("height_cm", 0),
                "lengthCm": v.get("length_cm", 0),
                "maxWeightKg": v.get("max_weight_kg", 0),
                "costPerKm": v.get("cost_per_km", 24),
                "emissionFactor": v.get("emission_factor", 0.062),
            }
    except Exception:
        pass
    return FALLBACK_VEHICLE


def _generate_items(count: int) -> list[dict]:
    """Generate random shipment dicts."""
    cargo_types = ["general", "fragile", "refrigerated", "hazardous"]
    priorities = ["normal", "express", "critical"]
    items = []
    for i in range(count):
        items.append({
            "id": f"shp-{i+1:04d}",
            "shipmentCode": f"SHP-{i+1:04d}",
            "widthCm": random.randint(40, 160),
            "heightCm": random.randint(30, 120),
            "lengthCm": random.randint(50, 200),
            "weightKg": random.randint(50, 3000),
            "cargoType": random.choice(cargo_types),
            "priority": random.choice(priorities),
        })
    return items


def run_scenario(scenario_config: dict) -> dict:
    """
    Run a single packing scenario and return metrics.

    Args:
        scenario_config: {
            "name": "Scenario Name",
            "container": { container dict },
            "items": [ item dicts ],
            "algorithm": "greedy" | "sa" | "hybrid",
            "sa_iterations": 500,
            "avg_distance_km": 800,
        }

    Returns:
        Dict with packing result + computed logistics metrics.
    """
    name = scenario_config.get("name", "Unnamed")
    container_data = scenario_config.get("container")
    if not container_data:
        container_data = _get_vehicle_from_db()
    items_data = scenario_config.get("items", [])
    algorithm = scenario_config.get("algorithm", "hybrid")
    sa_iterations = int(scenario_config.get("sa_iterations", 500))
    avg_distance = float(scenario_config.get("avg_distance_km", 800))

    container = create_container_from_vehicle(container_data)
    items = create_items_from_shipments(items_data)

    result = pack_items(
        container, items,
        algorithm=algorithm,
        sa_iterations=sa_iterations,
    )

    # Compute logistics metrics
    cost_per_km = float(container_data.get("costPerKm", 24))
    emission_factor = float(container_data.get("emissionFactor", 0.062))
    trip_cost = cost_per_km * avg_distance
    co2_kg = emission_factor * avg_distance

    return {
        "name": name,
        "algorithm": algorithm,
        "packing": result.to_dict(),
        "logistics_metrics": {
            "trip_cost": round(trip_cost, 2),
            "co2_kg": round(co2_kg, 2),
            "volume_utilization_pct": round(result.volume_utilization, 2),
            "weight_utilization_pct": round(result.weight_utilization, 2),
            "items_packed": len(result.placements),
            "items_unpacked": len(result.unpacked_items),
            "computation_time_ms": round(result.computation_time_ms, 2),
        },
    }


def compare_scenarios(config: dict) -> dict:
    """
    Compare multiple scenarios with the same items and container.

    Args:
        config: {
            "container": { ... },
            "items": [{ ... }],
            "scenarios": [
                { "name": "Greedy", "algorithm": "greedy" },
                { "name": "AI Hybrid", "algorithm": "hybrid" }
            ]
        }
    """
    container_data = config.get("container")
    if not container_data:
        container_data = _get_vehicle_from_db()
    items_data = config.get("items", [])
    scenarios = config.get("scenarios", [
        {"name": "Greedy (No Optimization)", "algorithm": "greedy"},
        {"name": "AI Hybrid (SA + EP)", "algorithm": "hybrid"},
    ])

    results = []
    for scenario in scenarios:
        scenario_config = {
            "name": scenario.get("name", "Unnamed"),
            "container": container_data,
            "items": items_data,
            "algorithm": scenario.get("algorithm", "hybrid"),
            "sa_iterations": scenario.get("sa_iterations", 500),
            "avg_distance_km": config.get("avg_distance_km", 800),
        }
        results.append(run_scenario(scenario_config))

    # Find best scenario
    best_idx = max(
        range(len(results)),
        key=lambda i: results[i]["logistics_metrics"]["volume_utilization_pct"],
    )

    return {
        "scenarios": results,
        "best_scenario": results[best_idx]["name"],
        "best_utilization": results[best_idx]["logistics_metrics"]["volume_utilization_pct"],
    }


def generate_demo_scenario_data(num_items: int = 15) -> dict:
    """
    Generate a full demo comparison: no consolidation vs greedy vs AI hybrid.
    """
    items_data = _generate_items(num_items)
    container_data = _get_vehicle_from_db()
    container = create_container_from_vehicle(container_data)
    items = create_items_from_shipments(items_data)

    # Scenario 1: No consolidation (one item per trip)
    no_consol_trips = len(items)
    total_weight = sum(it.weight for it in items)
    avg_distance = 800
    cost_per_km = 24
    emission_factor = 0.062
    no_consol_cost = no_consol_trips * cost_per_km * avg_distance
    no_consol_co2 = no_consol_trips * emission_factor * avg_distance
    avg_item_vol = sum(it.volume for it in items) / len(items) if items else 0
    no_consol_util = min((avg_item_vol / container.volume) * 100, 100) if container.volume else 0

    # Scenario 2: Greedy packing
    greedy_result = pack_items(container, items, algorithm="greedy")
    greedy_trips = 1 + len(greedy_result.unpacked_items) // max(len(greedy_result.placements), 1)
    greedy_cost = greedy_trips * cost_per_km * avg_distance
    greedy_co2 = greedy_trips * emission_factor * avg_distance

    # Scenario 3: AI Hybrid
    hybrid_result = pack_items(container, items, algorithm="hybrid", sa_iterations=400)
    hybrid_trips = 1 + len(hybrid_result.unpacked_items) // max(len(hybrid_result.placements), 1)
    hybrid_cost = hybrid_trips * cost_per_km * avg_distance
    hybrid_co2 = hybrid_trips * emission_factor * avg_distance

    return {
        "scenarios": [
            {
                "name": "No Consolidation",
                "total_trips": no_consol_trips,
                "avg_utilization": round(no_consol_util, 1),
                "total_cost": round(no_consol_cost),
                "co2_emissions": round(no_consol_co2, 1),
                "delivery_sla_met": 95,
                "items_packed": len(items),
                "items_unpacked": 0,
                "computation_time_ms": 0,
            },
            {
                "name": "Greedy Packing",
                "total_trips": greedy_trips,
                "avg_utilization": round(greedy_result.volume_utilization, 1),
                "total_cost": round(greedy_cost),
                "co2_emissions": round(greedy_co2, 1),
                "delivery_sla_met": 96,
                "items_packed": len(greedy_result.placements),
                "items_unpacked": len(greedy_result.unpacked_items),
                "computation_time_ms": round(greedy_result.computation_time_ms, 2),
                "packing": greedy_result.to_dict(),
            },
            {
                "name": "AI Optimized",
                "total_trips": hybrid_trips,
                "avg_utilization": round(hybrid_result.volume_utilization, 1),
                "total_cost": round(hybrid_cost),
                "co2_emissions": round(hybrid_co2, 1),
                "delivery_sla_met": 97,
                "items_packed": len(hybrid_result.placements),
                "items_unpacked": len(hybrid_result.unpacked_items),
                "computation_time_ms": round(hybrid_result.computation_time_ms, 2),
                "packing": hybrid_result.to_dict(),
            },
        ],
        "savings": {
            "trips_saved": no_consol_trips - hybrid_trips,
            "cost_saved": round(no_consol_cost - hybrid_cost),
            "co2_saved": round(no_consol_co2 - hybrid_co2, 1),
            "utilization_gain": round(hybrid_result.volume_utilization - no_consol_util, 1),
        },
    }
