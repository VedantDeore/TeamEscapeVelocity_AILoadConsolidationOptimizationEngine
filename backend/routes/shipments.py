"""Shipment CRUD routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
import csv
import io

shipments_bp = Blueprint("shipments", __name__)


@shipments_bp.route("/api/shipments", methods=["GET"])
def list_shipments():
    sb = get_supabase()
    status   = request.args.get("status")
    origin   = request.args.get("origin_city")
    dest     = request.args.get("dest_city")
    priority = request.args.get("priority")
    limit    = int(request.args.get("limit", 500))

    query = sb.table("shipments").select("*").order("created_at", desc=True).limit(limit)

    if status:
        query = query.eq("status", status)
    if origin:
        query = query.ilike("origin_city", f"%{origin}%")
    if dest:
        query = query.ilike("dest_city", f"%{dest}%")
    if priority:
        query = query.eq("priority", priority)

    result = query.execute()
    return jsonify(result.data)


@shipments_bp.route("/api/shipments/<shipment_id>", methods=["GET"])
def get_shipment(shipment_id):
    sb = get_supabase()
    try:
        result = sb.table("shipments").select("*").eq("id", shipment_id).single().execute()
        return jsonify(result.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@shipments_bp.route("/api/shipments", methods=["POST"])
def create_shipment():
    sb = get_supabase()
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    try:
        result = sb.table("shipments").insert(data).execute()
        return jsonify(result.data[0]), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@shipments_bp.route("/api/shipments/<shipment_id>", methods=["PATCH"])
def update_shipment(shipment_id):
    sb = get_supabase()
    data = request.get_json()
    result = sb.table("shipments").update(data).eq("id", shipment_id).execute()
    if not result.data:
        return jsonify({"error": "Not found"}), 404
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

    file    = request.files["file"]
    content = file.read().decode("utf-8", errors="replace")
    reader  = csv.DictReader(io.StringIO(content))

    def _safe_float(val, default=0.0):
        try:
            return float(val) if val and str(val).strip() else default
        except (ValueError, TypeError):
            return default

    shipments = []
    errors    = []
    for i, row in enumerate(reader):
        try:
            shipments.append({
                "shipment_code":         row.get("shipment_id", f"UPLOAD-{i+1}").strip(),
                "origin_city":           row.get("origin_city", "").strip(),
                "origin_lat":            _safe_float(row.get("origin_lat")),
                "origin_lng":            _safe_float(row.get("origin_lng")),
                "dest_city":             row.get("dest_city", "").strip(),
                "dest_lat":              _safe_float(row.get("dest_lat")),
                "dest_lng":              _safe_float(row.get("dest_lng")),
                "weight_kg":             _safe_float(row.get("weight_kg"), 100),
                "volume_m3":             _safe_float(row.get("volume_m3"), 1),
                "length_cm":             _safe_float(row.get("length_cm"), 100),
                "width_cm":              _safe_float(row.get("width_cm"), 80),
                "height_cm":             _safe_float(row.get("height_cm"), 60),
                "delivery_window_start": (row.get("delivery_start") or "2026-03-07T08:00:00+00:00").strip(),
                "delivery_window_end":   (row.get("delivery_end")   or "2026-03-08T18:00:00+00:00").strip(),
                "priority":              (row.get("priority") or "normal").strip().lower(),
                "cargo_type":            (row.get("cargo_type") or "general").strip().lower(),
                "status":                "pending",
            })
        except Exception as e:
            errors.append({"row": i + 2, "error": str(e)})

    if not shipments:
        return jsonify({"error": "No valid rows in CSV", "parse_errors": errors}), 400

    inserted = 0
    for i in range(0, len(shipments), 50):
        batch = shipments[i: i + 50]
        sb.table("shipments").insert(batch).execute()
        inserted += len(batch)

    # Add to activity feed
    try:
        sb.table("activity_feed").insert({
            "type":      "shipment",
            "message":   f"{inserted} shipments uploaded from CSV",
            "timestamp": "just now",
            "icon":      "upload",
        }).execute()
    except Exception:
        pass

    return jsonify({"inserted": inserted, "parse_errors": errors}), 201
