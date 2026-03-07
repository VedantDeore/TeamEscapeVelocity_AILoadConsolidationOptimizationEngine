"""3D bin packing routes."""

from flask import Blueprint, jsonify
from models.supabase_client import get_supabase

packing_bp = Blueprint("packing", __name__)


@packing_bp.route("/api/packing/<cluster_id>", methods=["GET"])
def get_packing(cluster_id):
    sb = get_supabase()
    cluster = sb.table("clusters").select("*").eq("id", cluster_id).single().execute()
    shipment_rows = sb.table("cluster_shipments").select("*").eq("cluster_id", cluster_id).order("load_order").execute()

    # Get the actual shipment details
    shipment_ids = [r["shipment_id"] for r in shipment_rows.data]
    shipments = []
    if shipment_ids:
        shipments_result = sb.table("shipments").select("*").in_("id", shipment_ids).execute()
        shipments = shipments_result.data

    return jsonify({
        "cluster": cluster.data,
        "shipments": shipments,
        "packing_layout": cluster.data.get("packing_layout"),
    })
