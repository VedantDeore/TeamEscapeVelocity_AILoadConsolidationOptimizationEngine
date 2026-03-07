"""
Lorri — Carbon Emission Calculator Service

Formula: CO₂ (kg) = distance_km × load_factor × emission_factor
Emission factors (kg CO₂ / ton-km):
  Trailer      0.055
  Heavy truck  0.062
  Medium truck 0.075
  Light truck  0.09
"""

# ── emission factors by vehicle type ──────────────────────
EMISSION_FACTORS = {
    "trailer":       0.055,
    "heavy truck":   0.062,
    "medium truck":  0.075,
    "light truck":   0.090,
    "default":       0.075,
}

# ── equivalencies ──────────────────────────────────────────
KG_CO2_PER_TREE_PER_YEAR    = 22.0   # average tree absorbs ~22 kg CO₂/year
KG_CO2_PER_KM_CAR            = 0.166  # average petrol car (IPCC)


def _factor_for(vehicle_type: str) -> float:
    key = (vehicle_type or "").lower()
    for k, v in EMISSION_FACTORS.items():
        if k in key:
            return v
    return EMISSION_FACTORS["default"]


def calculate_single(distance_km: float, weight_kg: float, vehicle_type: str) -> float:
    """Return CO₂ in kg for a single cluster trip."""
    factor     = _factor_for(vehicle_type)
    weight_ton = weight_kg / 1000.0
    co2        = distance_km * weight_ton * factor
    return round(co2, 2)


def calculate_emissions(clusters: list, baseline_trips: int | None = None) -> dict:
    """
    Compute before / after CO₂ for a set of clusters.

    Args:
        clusters: list of dicts with keys:
                    route_distance_km, total_weight, vehicle_type,
                    utilization_pct, shipment_count
        baseline_trips: if given, compute 'before' assuming each shipment
                        travels alone in a half-loaded truck.

    Returns:
        {
          "co2_after":       float,   # kg — with consolidation
          "co2_before":      float,   # kg — without consolidation (solo trips)
          "co2_saved":       float,
          "pct_saved":       float,
          "trees_equivalent": int,
          "car_km_avoided":  int,
          "green_score":     str,     # A+ → F
          "clusters":        [{co2, pct_of_total}, ...],
        }
    """
    if not clusters:
        return {
            "co2_after": 0, "co2_before": 0, "co2_saved": 0,
            "pct_saved": 0, "trees_equivalent": 0, "car_km_avoided": 0,
            "green_score": "N/A", "clusters": [],
        }

    co2_after_total  = 0.0
    co2_before_total = 0.0
    cluster_co2      = []

    for c in clusters:
        dist   = float(c.get("route_distance_km", 500))
        weight = float(c.get("total_weight", 5000))
        vtype  = c.get("vehicle_type", "heavy truck")
        n_shp  = int(c.get("shipment_count", len(c.get("shipment_ids", [1]))))

        # After: consolidated trip
        co2_after = calculate_single(dist, weight, vtype)
        co2_after_total += co2_after

        # Before: each shipment travels alone in a 50% loaded medium truck
        avg_single_weight = weight / max(n_shp, 1)
        solo_emission     = _factor_for("medium truck")
        co2_before        = n_shp * dist * (avg_single_weight / 1000.0) * solo_emission * 2.0
        co2_before_total += co2_before

        cluster_co2.append({
            "co2": round(co2_after, 2),
            "co2_before": round(co2_before, 2),
        })

    co2_saved = max(co2_before_total - co2_after_total, 0)
    pct_saved = (co2_saved / co2_before_total * 100) if co2_before_total > 0 else 0

    trees  = int(co2_saved / KG_CO2_PER_TREE_PER_YEAR)
    car_km = int(co2_saved / KG_CO2_PER_KM_CAR)

    # Green score
    if pct_saved >= 40:   score = "A+"
    elif pct_saved >= 30: score = "A"
    elif pct_saved >= 20: score = "B+"
    elif pct_saved >= 15: score = "B"
    elif pct_saved >= 10: score = "C"
    elif pct_saved >= 5:  score = "D"
    else:                 score = "F"

    return {
        "co2_after":        round(co2_after_total, 2),
        "co2_before":       round(co2_before_total, 2),
        "co2_saved":        round(co2_saved, 2),
        "pct_saved":        round(pct_saved, 1),
        "trees_equivalent": trees,
        "car_km_avoided":   car_km,
        "green_score":      score,
        "clusters":         cluster_co2,
    }
