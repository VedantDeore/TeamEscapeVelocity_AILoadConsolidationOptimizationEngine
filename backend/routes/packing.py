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
