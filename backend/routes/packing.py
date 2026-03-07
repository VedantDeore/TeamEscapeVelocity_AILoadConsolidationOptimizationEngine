"""3D bin packing routes — on-demand packing computation."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from services.bin_packing import pack_cluster

packing_bp = Blueprint("packing", __name__)


@packing_bp.route("/api/packing/<cluster_id>", methods=["GET"])
def get_packing(cluster_id):
    """Return packing layout for a cluster (from stored data)."""
    sb = get_supabase()
    try:
        cluster       = sb.table("clusters").select("*").eq("id", cluster_id).single().execute()
        shipment_rows = sb.table("cluster_shipments").select(
            "shipment_id, load_order, position_x, position_y, position_z"
        ).eq("cluster_id", cluster_id).order("load_order").execute()

        shipment_ids = [r["shipment_id"] for r in (shipment_rows.data or [])]
        shipments    = []
        if shipment_ids:
            s_result  = sb.table("shipments").select("*").in_("id", shipment_ids).execute()
            shipments = s_result.data or []

        return jsonify({
            "cluster":        cluster.data,
            "shipments":      shipments,
            "packing_layout": cluster.data.get("packing_layout"),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@packing_bp.route("/api/packing/<cluster_id>", methods=["POST"])
def recompute_packing(cluster_id):
    """Re-run 3D bin packing on demand and persist updated layout."""
    sb = get_supabase()
    try:
        cluster       = sb.table("clusters").select("*").eq("id", cluster_id).single().execute()
        cluster_data  = cluster.data

        # Fetch shipments for this cluster
        shipment_rows = sb.table("cluster_shipments").select("shipment_id").eq("cluster_id", cluster_id).execute()
        shipment_ids  = [r["shipment_id"] for r in (shipment_rows.data or [])]
        if not shipment_ids:
            return jsonify({"error": "No shipments in cluster"}), 404

        s_result  = sb.table("shipments").select("*").in_("id", shipment_ids).execute()
        shipments = s_result.data or []

        # Get vehicle
        vehicle_id  = cluster_data.get("vehicle_id")
        vehicle     = {}
        if vehicle_id:
            v_result = sb.table("vehicles").select("*").eq("id", vehicle_id).single().execute()
            vehicle  = v_result.data or {}

        # Run bin packing
        packing = pack_cluster(shipments, vehicle)

        # Persist
        sb.table("clusters").update({"packing_layout": packing}).eq("id", cluster_id).execute()

        # Update positions in cluster_shipments
        for item in packing.get("items", []):
            try:
                sb.table("cluster_shipments").update({
                    "position_x": item["x"],
                    "position_y": item["y"],
                    "position_z": item["z"],
                }).eq("cluster_id", cluster_id).eq("shipment_id", item["shipment_id"]).execute()
            except Exception:
                pass

        return jsonify({
            "cluster_id":     cluster_id,
            "packing_layout": packing,
            "updated":        True,
        })
    except Exception as e:
"""
3D Bin Packing API Routes
=========================

Endpoints:
  POST /api/packing/pack          — Pack items into a single container
  POST /api/packing/multi-pack    — Pack items into multiple containers
  GET  /api/packing/demo          — Run demo packing with sample data
  POST /api/packing/compare       — Compare greedy vs hybrid algorithms
"""

from flask import Blueprint, jsonify, request
from services.bin_packing import (
    Container3D,
    Item3D,
    CargoType,
    Priority,
    pack_items,
    multi_container_pack,
    create_items_from_shipments,
    create_container_from_vehicle,
    ITEM_COLORS,
)
import random
import logging

logger = logging.getLogger(__name__)

packing_bp = Blueprint("packing", __name__, url_prefix="/api/packing")


# ── Default vehicles (Indian truck fleet) ─────────────────────────────────
DEFAULT_VEHICLES = [
    {"id": "v1", "name": "Tata 407", "widthCm": 180, "heightCm": 180, "lengthCm": 430, "maxWeightKg": 2500, "costPerKm": 12, "emissionFactor": 0.09},
    {"id": "v2", "name": "Eicher 10.59", "widthCm": 230, "heightCm": 200, "lengthCm": 600, "maxWeightKg": 7000, "costPerKm": 18, "emissionFactor": 0.075},
    {"id": "v3", "name": "Ashok Leyland 1612", "widthCm": 240, "heightCm": 240, "lengthCm": 720, "maxWeightKg": 12000, "costPerKm": 24, "emissionFactor": 0.062},
    {"id": "v4", "name": "Tata Prima 4028", "widthCm": 245, "heightCm": 270, "lengthCm": 1220, "maxWeightKg": 25000, "costPerKm": 32, "emissionFactor": 0.055},
    {"id": "v5", "name": "BharatBenz 2823", "widthCm": 240, "heightCm": 250, "lengthCm": 900, "maxWeightKg": 18000, "costPerKm": 28, "emissionFactor": 0.058},
]


def _generate_demo_items(count: int = 12) -> list[dict]:
    """Generate random shipment dicts for demo purposes."""
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


# ── POST /api/packing/pack ────────────────────────────────────────────────
@packing_bp.route("/pack", methods=["POST"])
def pack_single():
    """
    Pack items into a single container.

    Request body:
    {
      "container": { "id", "name", "widthCm", "heightCm", "lengthCm", "maxWeightKg" },
      "items": [{ "id", "shipmentCode", "widthCm", "heightCm", "lengthCm", "weightKg", ... }],
      "algorithm": "greedy" | "sa" | "hybrid",
      "sa_iterations": 500,
      "sa_initial_temp": 100.0,
      "sa_cooling_rate": 0.97
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400

        # Parse container
        container_data = data.get("container", DEFAULT_VEHICLES[2])  # default: Ashok Leyland
        container = create_container_from_vehicle(container_data)

        # Parse items
        items_data = data.get("items", [])
        if not items_data:
            return jsonify({"error": "At least one item is required"}), 400
        items = create_items_from_shipments(items_data)

        # Algorithm params
        algorithm = data.get("algorithm", "hybrid")
        sa_iterations = int(data.get("sa_iterations", 500))
        sa_initial_temp = float(data.get("sa_initial_temp", 100.0))
        sa_cooling_rate = float(data.get("sa_cooling_rate", 0.97))

        result = pack_items(
            container, items,
            algorithm=algorithm,
            sa_iterations=sa_iterations,
            sa_initial_temp=sa_initial_temp,
            sa_cooling_rate=sa_cooling_rate,
        )

        return jsonify(result.to_dict())

    except Exception as e:
        logger.exception("Error in pack_single")
        return jsonify({"error": str(e)}), 500


# ── POST /api/packing/multi-pack ──────────────────────────────────────────
@packing_bp.route("/multi-pack", methods=["POST"])
def pack_multi():
    """
    Pack items across multiple containers.

    Request body:
    {
      "containers": [{ ... }],
      "items": [{ ... }],
      "optimize": true,
      "sa_iterations": 300
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400

        containers_data = data.get("containers", DEFAULT_VEHICLES)
        containers = [create_container_from_vehicle(c) for c in containers_data]

        items_data = data.get("items", [])
        if not items_data:
            return jsonify({"error": "At least one item is required"}), 400
        items = create_items_from_shipments(items_data)

        optimize = data.get("optimize", True)
        sa_iterations = int(data.get("sa_iterations", 300))

        results = multi_container_pack(
            containers, items,
            optimize=optimize,
            sa_iterations=sa_iterations,
        )

        return jsonify({
            "containers_used": len(results),
            "total_items": len(items),
            "results": [r.to_dict() for r in results],
        })

    except Exception as e:
        logger.exception("Error in pack_multi")
        return jsonify({"error": str(e)}), 500


# ── GET /api/packing/demo ─────────────────────────────────────────────────
@packing_bp.route("/demo", methods=["GET"])
def pack_demo():
    """
    Run a demo packing with auto-generated sample data.

    Query params:
      ?items=12          — number of items (default 12)
      ?vehicle=v3        — vehicle id (default v3)
      ?algorithm=hybrid  — algorithm to use
    """
    try:
        num_items = int(request.args.get("items", 12))
        vehicle_id = request.args.get("vehicle", "v3")
        algorithm = request.args.get("algorithm", "hybrid")

        # Find vehicle
        vehicle_data = next(
            (v for v in DEFAULT_VEHICLES if v["id"] == vehicle_id),
            DEFAULT_VEHICLES[2],
        )
        container = create_container_from_vehicle(vehicle_data)

        # Generate demo items
        items_data = _generate_demo_items(num_items)
        items = create_items_from_shipments(items_data)

        result = pack_items(container, items, algorithm=algorithm)

        return jsonify(result.to_dict())

    except Exception as e:
        logger.exception("Error in pack_demo")
        return jsonify({"error": str(e)}), 500


# ── POST /api/packing/compare ─────────────────────────────────────────────
@packing_bp.route("/compare", methods=["POST"])
def compare_algorithms():
    """
    Compare greedy vs hybrid algorithm on the same data.

    Request body:
    {
      "container": { ... },
      "items": [{ ... }]
    }

    Returns both results side by side.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400

        container_data = data.get("container", DEFAULT_VEHICLES[2])
        container = create_container_from_vehicle(container_data)

        items_data = data.get("items", _generate_demo_items(15))
        items = create_items_from_shipments(items_data)

        greedy_result = pack_items(container, items, algorithm="greedy")
        hybrid_result = pack_items(container, items, algorithm="hybrid")

        return jsonify({
            "greedy": greedy_result.to_dict(),
            "hybrid": hybrid_result.to_dict(),
            "improvement": {
                "utilization_delta": round(
                    hybrid_result.volume_utilization - greedy_result.volume_utilization, 2
                ),
                "items_packed_delta": (
                    len(hybrid_result.placements) - len(greedy_result.placements)
                ),
            },
        })

    except Exception as e:
        logger.exception("Error in compare_algorithms")
        return jsonify({"error": str(e)}), 500
