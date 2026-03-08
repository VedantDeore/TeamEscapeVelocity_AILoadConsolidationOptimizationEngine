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


def _bin_pack_into_subclusters(shipments: list, max_weight: float, max_volume: float) -> list:
    """
    First-fit-decreasing bin packing of shipments into sub-clusters,
    each fitting within max_weight and max_volume.
    """
    sorted_shps = sorted(shipments, key=lambda s: s.get("weight_kg", 0), reverse=True)

    bins: list[dict] = []

    for s in sorted_shps:
        w = s.get("weight_kg", 0)
        v = s.get("volume_m3", 0)

        placed = False
        for b in bins:
            if b["weight"] + w <= max_weight and b["volume"] + v <= max_volume:
                b["shipments"].append(s)
                b["weight"] += w
                b["volume"] += v
                placed = True
                break

        if not placed:
            bins.append({"shipments": [s], "weight": w, "volume": v})

    sub_clusters = []
    for b in bins:
        shps = b["shipments"]
        lats = [s.get("origin_lat", 0) for s in shps]
        lngs = [s.get("origin_lng", 0) for s in shps]
        sub_clusters.append({
            "shipment_ids": [s["id"] for s in shps if "id" in s],
            "shipments": shps,
            "total_weight": round(b["weight"], 2),
            "total_volume": round(b["volume"], 3),
            "centroid_lat": round(sum(lats) / len(lats), 6) if lats else 0,
            "centroid_lng": round(sum(lngs) / len(lngs), 6) if lngs else 0,
        })

    return sub_clusters


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

def cluster_shipments(shipments: list, constraints: dict | None = None, vehicles: list | None = None) -> dict:
    """
    Cluster shipments using DBSCAN with a custom distance metric.
    Enforces vehicle capacity constraints and limits clusters to available vehicle count.

    Returns dict with keys:
      - clusters: list of cluster dicts (each with utilization ≤ 100%)
      - rejected_shipment_ids: IDs of shipments exceeding all vehicle capacities
      - overflow_shipment_ids: IDs that couldn't be assigned (vehicle limit reached)
      - warnings: list of warning messages
    """
    empty_result = {"clusters": [], "rejected_shipment_ids": [], "overflow_shipment_ids": [], "warnings": []}
    if not shipments:
        return empty_result

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

    # ── Capacity-aware cluster building ──
    # Key insight: a vehicle doesn't need to carry ALL shipments at once.
    # With interleaved routing (pickup→deliver→pickup→deliver), the vehicle
    # only needs capacity for the HEAVIEST single shipment at any point.
    # The VRP solver enforces this during route construction.
    if vehicles:
        max_cap_weight = max(v.get("max_weight_kg", v.get("max_weight", 0)) for v in vehicles)
        max_cap_volume = max(v.get("max_volume_m3", v.get("max_volume", 0)) for v in vehicles)
    else:
        max_cap_weight = 12000
        max_cap_volume = 42

    raw_clusters = []
    rejected_ids = []
    overflow_ids = []
    warnings = []

    for group_indices in all_cluster_indices:
        group_shipments = [shipments[i] for i in group_indices]

        valid_shipments = []
        for s in group_shipments:
            if s.get("weight_kg", 0) > max_cap_weight:
                if s.get("id"):
                    rejected_ids.append(s["id"])
            else:
                valid_shipments.append(s)

        if not valid_shipments:
            continue

        total_weight = sum(s.get("weight_kg", 0) for s in valid_shipments)
        total_volume = sum(s.get("volume_m3", 0) for s in valid_shipments)
        peak_weight = max(s.get("weight_kg", 0) for s in valid_shipments)
        peak_volume = max(s.get("volume_m3", 0) for s in valid_shipments)

        lats = [s.get("origin_lat", 0) for s in valid_shipments]
        lngs = [s.get("origin_lng", 0) for s in valid_shipments]
        centroid_lat = round(sum(lats) / len(lats), 6)
        centroid_lng = round(sum(lngs) / len(lngs), 6)

        raw_clusters.append({
            "shipment_ids": [s["id"] for s in valid_shipments if "id" in s],
            "shipments": valid_shipments,
            "total_weight": round(total_weight, 2),
            "total_volume": round(total_volume, 3),
            "peak_weight": round(peak_weight, 2),
            "peak_volume": round(peak_volume, 3),
            "centroid_lat": centroid_lat,
            "centroid_lng": centroid_lng,
        })

    # ── Merge clusters down to available vehicle count ──
    # When DBSCAN creates more clusters than available vehicles (common with
    # geographically spread shipments), we re-group by vehicle capacity.
    # Each shipment goes to the smallest vehicle that can carry it individually.
    # The VRP handles interleaved routing (pickup→deliver→pickup→deliver).
    if vehicles and len(raw_clusters) > len(vehicles):
        all_valid = []
        for c in raw_clusters:
            all_valid.extend(c["shipments"])

        sorted_vehs = sorted(
            vehicles,
            key=lambda v: v.get("max_weight_kg", v.get("max_weight", 0)),
        )
        all_valid.sort(key=lambda s: s.get("weight_kg", 0), reverse=True)

        vehicle_bins = {v["id"]: [] for v in sorted_vehs}

        for s in all_valid:
            w = s.get("weight_kg", 0)
            # Among all vehicles that can carry this shipment, pick the one
            # with fewest assigned shipments (for load balancing), then
            # smallest capacity (for efficiency)
            candidates = [
                v for v in sorted_vehs
                if v.get("max_weight_kg", v.get("max_weight", 0)) >= w
            ]
            if candidates:
                best = min(
                    candidates,
                    key=lambda v: (
                        len(vehicle_bins[v["id"]]),
                        v.get("max_weight_kg", v.get("max_weight", 0)),
                    ),
                )
                vehicle_bins[best["id"]].append(s)
            else:
                if s.get("id"):
                    overflow_ids.append(s["id"])

        raw_clusters = []
        for v in sorted_vehs:
            bin_shipments = vehicle_bins[v["id"]]
            if not bin_shipments:
                continue
            tw = sum(s.get("weight_kg", 0) for s in bin_shipments)
            tv = sum(s.get("volume_m3", 0) for s in bin_shipments)
            pw = max(s.get("weight_kg", 0) for s in bin_shipments)
            pv = max(s.get("volume_m3", 0) for s in bin_shipments)
            lats = [s.get("origin_lat", 0) for s in bin_shipments]
            lngs = [s.get("origin_lng", 0) for s in bin_shipments]
            raw_clusters.append({
                "shipment_ids": [s["id"] for s in bin_shipments if "id" in s],
                "shipments": bin_shipments,
                "total_weight": round(tw, 2),
                "total_volume": round(tv, 3),
                "peak_weight": round(pw, 2),
                "peak_volume": round(pv, 3),
                "centroid_lat": round(sum(lats) / len(lats), 6),
                "centroid_lng": round(sum(lngs) / len(lngs), 6),
            })

    # Sort by peak weight descending — heaviest shipments pick vehicles first
    raw_clusters.sort(key=lambda c: c["peak_weight"], reverse=True)

    # ── Assign vehicles (unique per cluster) ──
    # Vehicle is chosen based on peak_weight (heaviest single shipment),
    # NOT total_weight, because interleaved routing means the vehicle
    # only carries one shipment's weight at a time.
    used_vehicle_ids = set()
    results = []

    for cluster in raw_clusters:
        vehicle = _recommend_vehicle(
            cluster["peak_weight"], cluster["peak_volume"], vehicles, used_vehicle_ids
        )

        if vehicle.get("overweight") or vehicle.get("shared"):
            overflow_ids.extend(cluster.get("shipment_ids", []))
            continue

        if vehicle.get("id"):
            used_vehicle_ids.add(vehicle["id"])

        cluster["vehicle"] = vehicle
        util_pct = 0.0
        if vehicle["max_weight"] > 0:
            weight_util = cluster["peak_weight"] / vehicle["max_weight"]
            volume_util = cluster["peak_volume"] / vehicle["max_volume"] if vehicle["max_volume"] else 0
            util_pct = round(max(weight_util, volume_util) * 100, 1)
        cluster["utilization_pct"] = util_pct
        results.append(cluster)

    # Sort by utilization descending (best clusters first)
    results.sort(key=lambda c: c["utilization_pct"], reverse=True)

    # ── Route chaining ──
    results = _chain_compatible_clusters(results, vehicles, used_vehicle_ids)

    # ── Build warnings ──
    if overflow_ids:
        available_count = len(vehicles) if vehicles else 0
        warnings.append(
            f"Only {available_count} vehicle(s) available. "
            f"{len(overflow_ids)} shipment(s) could not be assigned and will remain pending. "
            f"Deliveries for these may be delayed. Consider adding more vehicles."
        )

    if rejected_ids:
        warnings.append(
            f"{len(rejected_ids)} shipment(s) exceed the weight capacity of all available vehicles "
            f"(max {max_cap_weight:,.0f} kg). These shipments remain pending."
        )

    return {
        "clusters": results,
        "rejected_shipment_ids": rejected_ids,
        "overflow_shipment_ids": overflow_ids,
        "warnings": warnings,
    }


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
                # Peak load = heaviest individual shipment across both legs.
                peak_w = max(
                    current.get("peak_weight", current["total_weight"]),
                    clusters[j].get("peak_weight", clusters[j]["total_weight"]),
                )
                peak_v = max(
                    current.get("peak_volume", current["total_volume"]),
                    clusters[j].get("peak_volume", clusters[j]["total_volume"]),
                )
                can_fit = False
                sorted_v = sorted(vehicles, key=lambda v: v.get("max_weight_kg", v.get("max_weight", 0)))
                for v in sorted_v:
                    mw = v.get("max_weight_kg", v.get("max_weight", 0))
                    mv = v.get("max_volume_m3", v.get("max_volume", 0))
                    if mw >= peak_w and mv >= peak_v:
                        can_fit = True
                        break
                if can_fit:
                    best_j = j
                    best_dist = dist

        if best_j is not None:
            chained = clusters[best_j]
            merged.add(best_j)

            combined_shipments = current["shipments"] + chained["shipments"]
            combined_ids = current["shipment_ids"] + chained["shipment_ids"]
            combined_weight = current["total_weight"] + chained["total_weight"]
            combined_volume = current["total_volume"] + chained["total_volume"]

            peak_w = max(
                current.get("peak_weight", current["total_weight"]),
                chained.get("peak_weight", chained["total_weight"]),
            )
            peak_v = max(
                current.get("peak_volume", current["total_volume"]),
                chained.get("peak_volume", chained["total_volume"]),
            )

            # Re-pick best vehicle for heavier leg (release previous vehicles)
            old_vid = current["vehicle"].get("id")
            if old_vid:
                used_vehicle_ids.discard(old_vid)
            chained_vid = chained["vehicle"].get("id")
            if chained_vid:
                used_vehicle_ids.discard(chained_vid)

            vehicle = _recommend_vehicle(peak_w, peak_v, vehicles, used_vehicle_ids)
            if vehicle.get("id"):
                used_vehicle_ids.add(vehicle["id"])

            util_pct = 0.0
            if vehicle["max_weight"] > 0:
                weight_util = peak_w / vehicle["max_weight"]
                volume_util = peak_v / vehicle["max_volume"] if vehicle["max_volume"] else 0
                util_pct = round(max(weight_util, volume_util) * 100, 1)

            all_olats = [s.get("origin_lat", 0) for s in combined_shipments]
            all_olngs = [s.get("origin_lng", 0) for s in combined_shipments]

            result.append({
                "shipment_ids": combined_ids,
                "shipments":    combined_shipments,
                "vehicle":      vehicle,
                "total_weight": round(combined_weight, 2),
                "total_volume": round(combined_volume, 3),
                "peak_weight":  round(peak_w, 2),
                "peak_volume":  round(peak_v, 3),
                "utilization_pct": util_pct,
                "centroid_lat": round(sum(all_olats) / len(all_olats), 6),
                "centroid_lng": round(sum(all_olngs) / len(all_olngs), 6),
                "chained": True,
            })
        else:
            result.append(current)

    result.sort(key=lambda c: c["utilization_pct"], reverse=True)
    return result
