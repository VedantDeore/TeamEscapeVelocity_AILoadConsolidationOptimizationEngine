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


def _recommend_vehicle(total_weight: float, total_volume: float, vehicles: list | None = None, used_vehicle_ids: set | None = None) -> dict:
    """
    Pick the smallest vehicle that can fit the load.
    Priority: 1) available & fits, 2) used but fits (shared), 3) largest overall (overweight).
    NEVER assigns a vehicle too small when a bigger one exists.
    """
    vehicle_list = vehicles if vehicles else VEHICLE_TYPES
    
    if not vehicle_list:
        return {
            "name": "Default Truck",
            "type": "Heavy Truck",
            "max_weight": 12000,
            "max_volume": 42,
            "cost_per_km": 24,
        }
    
    used = used_vehicle_ids or set()
    
    # Sort vehicles by capacity (smallest first) to find best fit
    sorted_vehicles = sorted(vehicle_list, key=lambda v: v.get("max_weight_kg", v.get("max_weight", 0)))
    
    def _build_result(v, shared=False, overweight=False):
        mw = v.get("max_weight_kg", v.get("max_weight", 0))
        mv = v.get("max_volume_m3", v.get("max_volume", 0))
        r = {
            "name": v.get("name", "Unknown Vehicle"),
            "type": v.get("type", "Heavy Truck"),
            "max_weight": mw,
            "max_volume": mv,
            "cost_per_km": v.get("cost_per_km", 24),
            "id": v.get("id"),
        }
        if shared:
            r["shared"] = True
        if overweight:
            r["overweight"] = True
        return r
    
    # 1. Find smallest AVAILABLE vehicle that can fit the load
    for v in sorted_vehicles:
        vid = v.get("id")
        if vid and vid in used:
            continue
        mw = v.get("max_weight_kg", v.get("max_weight", 0))
        mv = v.get("max_volume_m3", v.get("max_volume", 0))
        if mw >= total_weight and mv >= total_volume:
            return _build_result(v)
    
    # 2. No available vehicle fits → find smallest vehicle that fits (even if already used/shared)
    for v in sorted_vehicles:
        mw = v.get("max_weight_kg", v.get("max_weight", 0))
        mv = v.get("max_volume_m3", v.get("max_volume", 0))
        if mw >= total_weight and mv >= total_volume:
            return _build_result(v, shared=True)
    
    # 3. No vehicle can fit at all → return largest overall with overweight flag
    largest = sorted_vehicles[-1]
    return _build_result(largest, overweight=True)


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

    # ── Pre-group: force shipments with same origin_city + same pickup_date
    # into the same cluster (hard constraint) ──
    from datetime import datetime as _dt

    def _pickup_date_key(s):
        """Extract date (YYYY-MM-DD) from delivery_window_start or pickup fields."""
        raw = s.get("delivery_window_start") or ""
        if isinstance(raw, str) and raw:
            try:
                raw = raw.replace("Z", "+00:00")
                return _dt.fromisoformat(raw).strftime("%Y-%m-%d")
            except Exception:
                pass
        return "unknown"

    def _origin_key(s):
        """Normalised origin city for grouping."""
        return (s.get("origin_city") or "").strip().lower()

    pre_groups: dict[str, list[int]] = {}
    for idx, s in enumerate(shipments):
        key = f"{_origin_key(s)}||{_pickup_date_key(s)}"
        pre_groups.setdefault(key, []).append(idx)

    # Build actual clusters from pre-groups (groups with 1+ shipments)
    # Groups with multiple shipments bypass DBSCAN as they must stay together
    forced_clusters_indices = []   # list of lists of indices
    singleton_indices = []         # indices that go through DBSCAN

    for key, indices in pre_groups.items():
        if len(indices) >= 2:
            # Same origin + same date → force into one cluster
            forced_clusters_indices.append(indices)
        else:
            singleton_indices.extend(indices)

    n = len(shipments)

    # --- Run DBSCAN only on non-forced singletons ---
    dbscan_clusters_indices = []
    if len(singleton_indices) >= 2:
        singleton_shipments = [shipments[i] for i in singleton_indices]
        ns = len(singleton_shipments)

        dist_matrix = np.zeros((ns, ns))
        for i in range(ns):
            for j in range(i + 1, ns):
                d = _custom_distance(i, j, singleton_shipments)
                dist_matrix[i][j] = d
                dist_matrix[j][i] = d

        eps        = float((constraints or {}).get("dbscan_eps", 0.35))
        min_samples = int((constraints or {}).get("dbscan_min_samples", 2))

        db = DBSCAN(eps=eps, min_samples=min_samples, metric="precomputed")
        labels = db.fit_predict(dist_matrix)

        groups: dict[int, list] = {}
        for idx_in_sub, label in enumerate(labels):
            key = label if label != -1 else -(idx_in_sub + 1000)
            groups.setdefault(key, []).append(idx_in_sub)

        for group_sub_indices in groups.values():
            # Map back to original shipment indices
            original_indices = [singleton_indices[si] for si in group_sub_indices]
            dbscan_clusters_indices.append(original_indices)
    elif len(singleton_indices) == 1:
        dbscan_clusters_indices.append(singleton_indices)

    # --- Combine forced + DBSCAN clusters ---
    all_cluster_indices = forced_clusters_indices + dbscan_clusters_indices

    results = []
    used_vehicle_ids = set()  # Track vehicles assigned to clusters
    
    for group_indices in all_cluster_indices:
        group_shipments = [shipments[i] for i in group_indices]
        total_weight = sum(s.get("weight_kg", 0) for s in group_shipments)
        total_volume = sum(s.get("volume_m3", 0) for s in group_shipments)

        vehicle = _recommend_vehicle(total_weight, total_volume, vehicles, used_vehicle_ids)
        # Mark this vehicle as used
        if vehicle.get("id"):
            used_vehicle_ids.add(vehicle["id"])
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

    # ── Route chaining: merge clusters where dest of one ≈ origin of another ──
    # e.g. Mumbai→Delhi + Delhi→Srinagar → same vehicle does Mumbai→Delhi→Srinagar
    results = _chain_compatible_clusters(results, vehicles, used_vehicle_ids)

    return results


def _cluster_dest_centroid(cluster: dict) -> tuple:
    """Average destination lat/lng of a cluster's shipments."""
    shps = cluster.get("shipments", [])
    if not shps:
        return (0.0, 0.0)
    lats = [s.get("dest_lat", 0) for s in shps]
    lngs = [s.get("dest_lng", 0) for s in shps]
    return (sum(lats) / len(lats), sum(lngs) / len(lngs))


def _cluster_origin_centroid(cluster: dict) -> tuple:
    """Average origin lat/lng of a cluster's shipments."""
    shps = cluster.get("shipments", [])
    if not shps:
        return (0.0, 0.0)
    lats = [s.get("origin_lat", 0) for s in shps]
    lngs = [s.get("origin_lng", 0) for s in shps]
    return (sum(lats) / len(lats), sum(lngs) / len(lngs))


def _chain_compatible_clusters(clusters: list, vehicles: list | None, used_vehicle_ids: set) -> list:
    """
    Merge clusters that form a route chain:
      Cluster A delivers near Cluster B's pickup → combine into one cluster
      so the same vehicle handles both legs without returning to depot.

    Example: Mumbai→Delhi + Delhi→Srinagar → 1 vehicle does Mumbai→Delhi→Srinagar
    The truck delivers leg A first, then picks up leg B, so it only needs
    capacity for the HEAVIER leg (not both combined).

    Conditions for merging:
      1. Cluster A's destination centroid is within 100km of Cluster B's origin centroid
      2. The heavier individual leg fits within a single vehicle's capacity
    """
    if len(clusters) < 2 or not vehicles:
        return clusters

    CHAIN_DISTANCE_KM = 100  # max km between dest of A and origin of B

    merged = set()  # indices of clusters already merged into another
    result = []

    for i in range(len(clusters)):
        if i in merged:
            continue

        current = clusters[i]
        dest_lat, dest_lng = _cluster_dest_centroid(current)

        # Try to find a chainable cluster
        best_j = None
        best_dist = float("inf")

        for j in range(len(clusters)):
            if j == i or j in merged:
                continue
            origin_lat, origin_lng = _cluster_origin_centroid(clusters[j])
            try:
                dist = geodesic((dest_lat, dest_lng), (origin_lat, origin_lng)).km
            except Exception:
                dist = 9999
            if dist < CHAIN_DISTANCE_KM and dist < best_dist:
                # For chained routes, the truck delivers leg A then picks up leg B.
                # It only needs to carry the HEAVIER leg at any one time.
                max_leg_weight = max(current["total_weight"], clusters[j]["total_weight"])
                max_leg_volume = max(current["total_volume"], clusters[j]["total_volume"])
                # Find if any vehicle can handle the heavier leg
                can_fit = False
                sorted_v = sorted(vehicles, key=lambda v: v.get("max_weight_kg", v.get("max_weight", 0)))
                for v in sorted_v:
                    mw = v.get("max_weight_kg", v.get("max_weight", 0))
                    mv = v.get("max_volume_m3", v.get("max_volume", 0))
                    if mw >= max_leg_weight and mv >= max_leg_volume:
                        can_fit = True
                        break
                if can_fit:
                    best_j = j
                    best_dist = dist

        if best_j is not None:
            # Merge cluster best_j into current
            chained = clusters[best_j]
            merged.add(best_j)

            combined_shipments = current["shipments"] + chained["shipments"]
            combined_ids = current["shipment_ids"] + chained["shipment_ids"]
            combined_weight = current["total_weight"] + chained["total_weight"]
            combined_volume = current["total_volume"] + chained["total_volume"]

            # For vehicle sizing: truck delivers leg A then picks up leg B,
            # so it only carries the heavier leg at any one time
            max_leg_weight = max(current["total_weight"], chained["total_weight"])
            max_leg_volume = max(current["total_volume"], chained["total_volume"])

            # Re-pick best vehicle for heavier leg (release previous vehicles)
            old_vid = current["vehicle"].get("id")
            if old_vid:
                used_vehicle_ids.discard(old_vid)
            chained_vid = chained["vehicle"].get("id")
            if chained_vid:
                used_vehicle_ids.discard(chained_vid)

            vehicle = _recommend_vehicle(max_leg_weight, max_leg_volume, vehicles, used_vehicle_ids)
            if vehicle.get("id"):
                used_vehicle_ids.add(vehicle["id"])

            util_pct = 0.0
            if vehicle["max_weight"] > 0:
                weight_util = max_leg_weight / vehicle["max_weight"]
                volume_util = max_leg_volume / vehicle["max_volume"] if vehicle["max_volume"] else 0
                util_pct = round(max(weight_util, volume_util) * 100, 1)

            # Centroid of combined origins
            all_olats = [s.get("origin_lat", 0) for s in combined_shipments]
            all_olngs = [s.get("origin_lng", 0) for s in combined_shipments]

            result.append({
                "shipment_ids": combined_ids,
                "shipments":    combined_shipments,
                "vehicle":      vehicle,
                "total_weight": round(combined_weight, 2),
                "total_volume": round(combined_volume, 3),
                "utilization_pct": util_pct,
                "centroid_lat": round(sum(all_olats) / len(all_olats), 6),
                "centroid_lng": round(sum(all_olngs) / len(all_olngs), 6),
                "chained": True,
            })
        else:
            result.append(current)

    result.sort(key=lambda c: c["utilization_pct"], reverse=True)
    return result
