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
        return jsonify({"error": str(e)}), 500


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


def _get_vehicles_from_db() -> list:
    """Fetch vehicles from database, return empty list if none found."""
    try:
        sb = get_supabase()
        result = sb.table("vehicles").select("*").eq("is_available", True).limit(10).execute()
        if result.data:
            # Convert to expected format
            return [
                {
                    "id": v.get("id", ""),
                    "name": v.get("name", ""),
                    "widthCm": v.get("width_cm", 0),
                    "heightCm": v.get("height_cm", 0),
                    "lengthCm": v.get("length_cm", 0),
                    "maxWeightKg": v.get("max_weight_kg", 0),
                    "costPerKm": v.get("cost_per_km", 24),
                    "emissionFactor": v.get("emission_factor", 0.062),
                }
                for v in result.data
            ]
    except Exception:
        pass
    return []


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

        # Parse container - fetch from DB if not provided
        container_data = data.get("container")
        if not container_data:
            db_vehicles = _get_vehicles_from_db()
            if db_vehicles:
                container_data = db_vehicles[0]  # Use first available vehicle
            else:
                container_data = FALLBACK_VEHICLE
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

        containers_data = data.get("containers")
        if not containers_data:
            containers_data = _get_vehicles_from_db()
            if not containers_data:
                containers_data = [FALLBACK_VEHICLE]  # At least one container needed
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
        vehicle_id = request.args.get("vehicle")
        algorithm = request.args.get("algorithm", "hybrid")

        # Fetch vehicle from database or use fallback
        vehicle_data = None
        if vehicle_id:
            # Try to fetch from database by ID
            try:
                sb = get_supabase()
                result = sb.table("vehicles").select("*").eq("id", vehicle_id).eq("is_available", True).limit(1).execute()
                if result.data:
                    v = result.data[0]
                    vehicle_data = {
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
        
        # If not found, get first available from DB or use fallback
        if not vehicle_data:
            db_vehicles = _get_vehicles_from_db()
            if db_vehicles:
                vehicle_data = db_vehicles[0]
            else:
                vehicle_data = FALLBACK_VEHICLE
        
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

        container_data = data.get("container")
        if not container_data:
            db_vehicles = _get_vehicles_from_db()
            if db_vehicles:
                container_data = db_vehicles[0]
            else:
                container_data = FALLBACK_VEHICLE
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
