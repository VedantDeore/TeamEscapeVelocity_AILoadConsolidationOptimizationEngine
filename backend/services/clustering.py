"""
Lorri — DBSCAN Shipment Clustering Service

Uses a custom distance metric combining:
  α · geo_distance (normalized)
  β · time_overlap (normalized)
  γ · route_similarity (normalized)
"""

import math
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import MinMaxScaler
from geopy.distance import geodesic


# ── weighting factors ──────────────────────────────────────
ALPHA = 0.5   # geographic proximity weight
BETA  = 0.3   # time-window overlap weight
GAMMA = 0.2   # route / destination similarity weight

# ── vehicle type thresholds (weight_kg, volume_m3) ─────────
VEHICLE_TYPES = [
    {"name": "Tata 407",            "type": "Light Truck",  "max_weight": 2500,  "max_volume": 14},
    {"name": "Eicher 10.59",        "type": "Medium Truck", "max_weight": 7000,  "max_volume": 28},
    {"name": "Ashok Leyland 1612",  "type": "Heavy Truck",  "max_weight": 12000, "max_volume": 42},
    {"name": "BharatBenz 2823",     "type": "Heavy Truck",  "max_weight": 18000, "max_volume": 55},
    {"name": "Tata Prima 4028",     "type": "Trailer",      "max_weight": 25000, "max_volume": 70},
]


# ── helpers ────────────────────────────────────────────────

def _geo_dist_km(s1: dict, s2: dict) -> float:
    """Haversine distance between two shipments' origins (km)."""
    try:
        return geodesic(
            (s1["origin_lat"], s1["origin_lng"]),
            (s2["origin_lat"], s2["origin_lng"])
        ).km
    except Exception:
        return 9999.0


def _time_overlap(s1: dict, s2: dict) -> float:
    """
    Returns 0.0 (perfect overlap) → 1.0 (no overlap).
    Uses normalised minutes from a common epoch.
    """
    try:
        from datetime import datetime, timezone

        def _parse(ts):
            if isinstance(ts, str):
                ts = ts.replace("Z", "+00:00")
                return datetime.fromisoformat(ts)
            return ts

        s1_start = _parse(s1.get("delivery_window_start") or "2026-03-07T00:00:00+00:00")
        s1_end   = _parse(s1.get("delivery_window_end")   or "2026-03-08T23:59:00+00:00")
        s2_start = _parse(s2.get("delivery_window_start") or "2026-03-07T00:00:00+00:00")
        s2_end   = _parse(s2.get("delivery_window_end")   or "2026-03-08T23:59:00+00:00")

        overlap_start = max(s1_start, s2_start)
        overlap_end   = min(s1_end,   s2_end)

        if overlap_end <= overlap_start:
            return 1.0  # no overlap

        overlap_mins = (overlap_end - overlap_start).total_seconds() / 60
        total_mins   = max((s1_end - s1_start).total_seconds() / 60,
                           (s2_end - s2_start).total_seconds() / 60, 1)
        return 1.0 - min(overlap_mins / total_mins, 1.0)
    except Exception:
        return 0.5


def _dest_similarity(s1: dict, s2: dict) -> float:
    """
    Geographic similarity of destinations — 0.0 = same city, 1.0 = far apart.
    """
    try:
        d = geodesic(
            (s1["dest_lat"], s1["dest_lng"]),
            (s2["dest_lat"], s2["dest_lng"])
        ).km
        return min(d / 1000.0, 1.0)   # normalise against 1000 km
    except Exception:
        return 0.5


def _custom_distance(i: int, j: int, shipments: list) -> float:
    s1, s2 = shipments[i], shipments[j]
    geo  = _geo_dist_km(s1, s2) / 500.0        # normalise against 500 km
    geo  = min(geo, 1.0)
    time = _time_overlap(s1, s2)
    dest = _dest_similarity(s1, s2)
    return ALPHA * geo + BETA * time + GAMMA * dest


def _recommend_vehicle(total_weight: float, total_volume: float, vehicles: list | None = None) -> dict:
    """
    Pick the smallest vehicle that can fit the load.
    If vehicles list is provided (from database), use those; otherwise fallback to hardcoded types.
    """
    vehicle_list = vehicles if vehicles else VEHICLE_TYPES
    
    if not vehicle_list:
        # Ultimate fallback
        return {
            "name": "Default Truck",
            "type": "Heavy Truck",
            "max_weight": 12000,
            "max_volume": 42,
            "cost_per_km": 24,
        }
    
    # Sort vehicles by capacity (smallest first) to find best fit
    sorted_vehicles = sorted(vehicle_list, key=lambda v: v.get("max_weight_kg", v.get("max_weight", 0)))
    
    # Find smallest vehicle that can fit the load
    for v in sorted_vehicles:
        max_weight = v.get("max_weight_kg", v.get("max_weight", 0))
        max_volume = v.get("max_volume_m3", v.get("max_volume", 0))
        
        if max_weight >= total_weight and max_volume >= total_volume:
            # Return in expected format
            return {
                "name": v.get("name", "Unknown Vehicle"),
                "type": v.get("type", "Heavy Truck"),
                "max_weight": max_weight,
                "max_volume": max_volume,
                "cost_per_km": v.get("cost_per_km", 24),
                "id": v.get("id"),  # Include DB ID if available
            }
    
    # If no vehicle fits, return largest available
    largest = sorted_vehicles[-1]
    return {
        "name": largest.get("name", "Largest Available"),
        "type": largest.get("type", "Heavy Truck"),
        "max_weight": largest.get("max_weight_kg", largest.get("max_weight", 25000)),
        "max_volume": largest.get("max_volume_m3", largest.get("max_volume", 70)),
        "cost_per_km": largest.get("cost_per_km", 24),
        "id": largest.get("id"),
    }


# ── main entry point ───────────────────────────────────────

def cluster_shipments(shipments: list, constraints: dict | None = None, vehicles: list | None = None) -> list:
    """
    Cluster shipments using DBSCAN with a custom distance metric.

    Args:
        shipments:   list of shipment dicts (must have lat/lng, weight, volume, windows)
        constraints: optional dict with keys like max_detour_pct, priority_rules

    Returns:
        List of cluster dicts:
        {
          "shipment_ids": [...],
          "shipments":    [...],
          "vehicle":      {...},
          "total_weight": float,
          "total_volume": float,
          "utilization_pct": float,
          "centroid_lat":  float,
          "centroid_lng":  float,
        }
    """
    if not shipments:
        return []

    n = len(shipments)

    # Build precomputed distance matrix
    dist_matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            d = _custom_distance(i, j, shipments)
            dist_matrix[i][j] = d
            dist_matrix[j][i] = d

    # DBSCAN
    eps        = float((constraints or {}).get("dbscan_eps", 0.35))
    min_samples = int((constraints or {}).get("dbscan_min_samples", 2))

    db = DBSCAN(eps=eps, min_samples=min_samples, metric="precomputed")
    labels = db.fit_predict(dist_matrix)

    # Group by label; noise becomes singleton clusters
    groups: dict[int, list] = {}
    for idx, label in enumerate(labels):
        key = label if label != -1 else -(idx + 1000)   # unique key for noise
        groups.setdefault(key, []).append(idx)

    results = []
    for group_indices in groups.values():
        group_shipments = [shipments[i] for i in group_indices]
        total_weight = sum(s.get("weight_kg", 0) for s in group_shipments)
        total_volume = sum(s.get("volume_m3", 0) for s in group_shipments)

        vehicle = _recommend_vehicle(total_weight, total_volume, vehicles)
        util_pct = 0.0
        if vehicle["max_weight"] > 0:
            weight_util = total_weight / vehicle["max_weight"]
            volume_util = total_volume / vehicle["max_volume"] if vehicle["max_volume"] else 0
            util_pct = round(max(weight_util, volume_util) * 100, 1)

        # Cluster centroid (average origin)
        lats = [s.get("origin_lat", 0) for s in group_shipments]
        lngs = [s.get("origin_lng", 0) for s in group_shipments]
        centroid_lat = round(sum(lats) / len(lats), 6)
        centroid_lng = round(sum(lngs) / len(lngs), 6)

        results.append({
            "shipment_ids": [s["id"] for s in group_shipments if "id" in s],
            "shipments":    group_shipments,
            "vehicle":      vehicle,
            "total_weight": round(total_weight, 2),
            "total_volume": round(total_volume, 3),
            "utilization_pct": util_pct,
            "centroid_lat": centroid_lat,
            "centroid_lng": centroid_lng,
        })

    # Sort by utilization descending (best clusters first)
    results.sort(key=lambda c: c["utilization_pct"], reverse=True)
    return results
