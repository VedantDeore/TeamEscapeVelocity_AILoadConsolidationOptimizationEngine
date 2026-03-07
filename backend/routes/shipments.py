"""Shipment CRUD routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
import csv
import io

shipments_bp = Blueprint("shipments", __name__)


@shipments_bp.route("/api/shipments", methods=["GET"])
def list_shipments():
    sb = get_supabase()
    status = request.args.get("status")
    origin = request.args.get("origin_city")
    dest = request.args.get("dest_city")
    priority = request.args.get("priority")

    query = sb.table("shipments").select("*").order("created_at", desc=True)

    if status:
        query = query.eq("status", status)
    if origin:
        query = query.eq("origin_city", origin)
    if dest:
        query = query.eq("dest_city", dest)
    if priority:
        query = query.eq("priority", priority)

    result = query.execute()
    return jsonify(result.data)


@shipments_bp.route("/api/shipments/<shipment_id>", methods=["GET"])
def get_shipment(shipment_id):
    sb = get_supabase()
    result = sb.table("shipments").select("*").eq("id", shipment_id).single().execute()
    return jsonify(result.data)


@shipments_bp.route("/api/shipments", methods=["POST"])
def create_shipment():
    sb = get_supabase()
    data = request.get_json()
    result = sb.table("shipments").insert(data).execute()
    return jsonify(result.data[0]), 201


@shipments_bp.route("/api/shipments/<shipment_id>", methods=["PATCH"])
def update_shipment(shipment_id):
    sb = get_supabase()
    data = request.get_json()
    result = sb.table("shipments").update(data).eq("id", shipment_id).execute()
    return jsonify(result.data[0])


@shipments_bp.route("/api/shipments/<shipment_id>", methods=["DELETE"])
def delete_shipment(shipment_id):
    sb = get_supabase()
    sb.table("shipments").delete().eq("id", shipment_id).execute()
    return jsonify({"status": "deleted"}), 200


@shipments_bp.route("/api/shipments/upload", methods=["POST"])
def upload_csv():
    sb = get_supabase()

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    content = file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))

    shipments = []
    for row in reader:
        shipments.append({
            "shipment_code": row.get("shipment_id", "").strip(),
            "origin_city": row.get("origin_city", "").strip(),
            "origin_lat": float(row.get("origin_lat", 0)),
            "origin_lng": float(row.get("origin_lng", 0)),
            "dest_city": row.get("dest_city", "").strip(),
            "dest_lat": float(row.get("dest_lat", 0)),
            "dest_lng": float(row.get("dest_lng", 0)),
            "weight_kg": float(row.get("weight_kg", 0)),
            "volume_m3": float(row.get("volume_m3", 0)),
            "length_cm": float(row.get("length_cm", 0)),
            "width_cm": float(row.get("width_cm", 0)),
            "height_cm": float(row.get("height_cm", 0)),
            "delivery_window_start": row.get("delivery_start", "2026-03-07T08:00:00+00:00").strip(),
            "delivery_window_end": row.get("delivery_end", "2026-03-08T18:00:00+00:00").strip(),
            "priority": row.get("priority", "normal").strip(),
            "cargo_type": row.get("cargo_type", "general").strip(),
            "status": "pending",
        })

    if not shipments:
        return jsonify({"error": "No valid rows in CSV"}), 400

    inserted = 0
    for i in range(0, len(shipments), 50):
        batch = shipments[i : i + 50]
        sb.table("shipments").insert(batch).execute()
        inserted += len(batch)

    return jsonify({"inserted": inserted}), 201
