"""
Lorri — 3D Bin Packing Service

Implements a layer-based First Fit Decreasing (FFD) algorithm.
Assigns (x, y, z) positions inside the vehicle container so the
frontend Three.js viewer can render exact placement.
"""

import math
import random


# ── palette for box colours ────────────────────────────────
COLOURS = [
    "#635BFF", "#0CAF60", "#E5850B", "#DF1B41",
    "#00A2E8", "#FF6B35", "#9B59B6", "#1ABC9C",
    "#F39C12", "#E74C3C", "#3498DB", "#2ECC71",
]


def _cm_to_m(val: float) -> float:
    return val / 100.0


def pack_cluster(shipments: list, vehicle: dict) -> dict:
    """
    Fit shipments into vehicle using 3D FFD (layer-based).

    Args:
        shipments: list of shipment dicts with length_cm, width_cm, height_cm, weight_kg
        vehicle:   dict with length_cm, width_cm, height_cm, max_weight_kg, max_volume_m3

    Returns:
        {
          "items":          [...],  # each item with position + dimensions
          "utilization_pct": float,
          "total_weight":   float,
          "total_volume":   float,
          "container":      {"length": m, "width": m, "height": m},
          "fits":           bool,
        }
    """
    if not shipments:
        return _empty_result(vehicle)

    # Container dimensions (metres)
    c_len = _cm_to_m(float(vehicle.get("length_cm", 720)))
    c_wid = _cm_to_m(float(vehicle.get("width_cm", 240)))
    c_hei = _cm_to_m(float(vehicle.get("height_cm", 240)))
    c_vol = c_len * c_wid * c_hei

    # Sort items largest-volume-first
    items = sorted(shipments, key=lambda s: (
        float(s.get("length_cm", 100)) *
        float(s.get("width_cm",  80))  *
        float(s.get("height_cm", 60))
    ), reverse=True)

    placed   = []
    fits     = True
    cur_x    = 0.0   # current position along vehicle length
    cur_y    = 0.0   # current position along width
    row_max_l = 0.0  # tallest item in current width-row
    layer_max_x = 0.0  # how far the current length-layer extends

    for idx, item in enumerate(items):
        # Item dimensions in metres
        il = _cm_to_m(float(item.get("length_cm", 100)))
        iw = _cm_to_m(float(item.get("width_cm",  80)))
        ih = _cm_to_m(float(item.get("height_cm", 60)))

        # Try current position
        placed_ok = False

        # If it fits in current row
        if cur_y + iw <= c_wid and cur_x + il <= c_len:
            pos_x, pos_y, pos_z = cur_x, cur_y, 0.0
            cur_y     += iw
            row_max_l  = max(row_max_l, il)
            placed_ok  = True

        elif cur_x + row_max_l + il <= c_len:
            # Start a new width-row
            cur_x    += row_max_l
            cur_y     = 0.0
            row_max_l = 0.0
            if cur_y + iw <= c_wid:
                pos_x, pos_y, pos_z = cur_x, cur_y, 0.0
                cur_y     += iw
                row_max_l  = il
                placed_ok  = True

        if not placed_ok:
            fits = False
            # Still add it (stacked / overflow) but mark as outside
            pos_x = cur_x + 0.1
            pos_y = cur_y + 0.1
            pos_z = 0.0

        placed.append({
            "shipment_id":  item.get("id", f"item-{idx}"),
            "shipment_code": item.get("shipment_code", f"ITEM-{idx+1}"),
            "x": round(pos_x, 3),
            "y": round(pos_y, 3),
            "z": round(pos_z, 3),
            "length": round(il, 3),
            "width":  round(iw, 3),
            "height": round(ih, 3),
            "weight_kg": item.get("weight_kg", 0),
            "cargo_type": item.get("cargo_type", "general"),
            "priority":   item.get("priority", "normal"),
            "color": COLOURS[idx % len(COLOURS)],
        })

    total_weight = sum(float(s.get("weight_kg", 0)) for s in shipments)
    total_volume = sum(
        _cm_to_m(float(s.get("length_cm", 100))) *
        _cm_to_m(float(s.get("width_cm", 80))) *
        _cm_to_m(float(s.get("height_cm", 60)))
        for s in shipments
    )

    wt_cap  = float(vehicle.get("max_weight_kg", 12000)) or 1
    vol_cap = float(vehicle.get("max_volume_m3", c_vol * 0.95)) or 1

    util_pct = round(max(
        total_weight / wt_cap,
        total_volume / vol_cap
    ) * 100, 1)
    util_pct = min(util_pct, 100.0)

    return {
        "items":           placed,
        "utilization_pct": util_pct,
        "total_weight":    round(total_weight, 2),
        "total_volume":    round(total_volume, 3),
        "container": {
            "length": round(c_len, 3),
            "width":  round(c_wid, 3),
            "height": round(c_hei, 3),
        },
        "fits": fits,
    }


def _empty_result(vehicle: dict) -> dict:
    c_len = _cm_to_m(float(vehicle.get("length_cm", 720)))
    c_wid = _cm_to_m(float(vehicle.get("width_cm", 240)))
    c_hei = _cm_to_m(float(vehicle.get("height_cm", 240)))
    return {
        "items": [],
        "utilization_pct": 0.0,
        "total_weight": 0.0,
        "total_volume": 0.0,
        "container": {"length": c_len, "width": c_wid, "height": c_hei},
        "fits": True,
    }
