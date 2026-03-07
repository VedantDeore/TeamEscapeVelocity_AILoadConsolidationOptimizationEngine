"""Shipment CRUD routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from utils.geocoding import geocode
import csv
import io
import uuid
import time

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
    
    # Generate shipment_code if missing (ensure uniqueness)
    if not data.get("shipment_code"):
        max_attempts = 10
        for _ in range(max_attempts):
            code = f"SHP-{str(uuid.uuid4())[:8].upper()}"
            # Check if code already exists
            try:
                existing = sb.table("shipments").select("id").eq("shipment_code", code).limit(1).execute()
                if not existing.data:
                    data["shipment_code"] = code
                    break
            except Exception:
                data["shipment_code"] = code
                break
        else:
            # Fallback if all attempts failed
            data["shipment_code"] = f"SHP-{str(uuid.uuid4())[:8].upper()}-{int(time.time())}"
    
    # Lookup city coordinates if missing
    def _get_city_coords(city_name):
        if not city_name:
            return None, None
        # Try database lookup first (case-insensitive)
        try:
            result = sb.table("cities").select("lat, lng").ilike("name", f"%{city_name.strip()}%").limit(1).execute()
            if result.data:
                return result.data[0].get("lat"), result.data[0].get("lng")
        except Exception:
            pass
        
        # Fallback to geocoding if not in database
        try:
            geo_result = geocode(f"{city_name.strip()}, India")
            if geo_result:
                return geo_result.get("lat"), geo_result.get("lng")
        except Exception:
            pass
        
        return None, None
    
    # Fill in missing coordinates
    if not data.get("origin_lat") or not data.get("origin_lng"):
        if data.get("origin_city"):
            lat, lng = _get_city_coords(data["origin_city"])
            if lat and lng:
                data["origin_lat"] = lat
                data["origin_lng"] = lng
            else:
                # Set default coordinates if lookup fails (Delhi as fallback)
                data["origin_lat"] = 28.6139
                data["origin_lng"] = 77.2090
    
    if not data.get("dest_lat") or not data.get("dest_lng"):
        if data.get("dest_city"):
            lat, lng = _get_city_coords(data["dest_city"])
            if lat and lng:
                data["dest_lat"] = lat
                data["dest_lng"] = lng
            else:
                # Set default coordinates if lookup fails (Mumbai as fallback)
                data["dest_lat"] = 19.0760
                data["dest_lng"] = 72.8777
    
    # Set defaults
    if not data.get("status"):
        data["status"] = "pending"
    if not data.get("priority"):
        data["priority"] = "normal"
    if not data.get("cargo_type"):
        data["cargo_type"] = "general"
    
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
    try:
        # First check if shipment exists
        check_result = sb.table("shipments").select("id").eq("id", shipment_id).execute()
        if not check_result.data:
            return jsonify({"error": "Shipment not found"}), 404
        
        # Delete from cluster_shipments first (if exists) to avoid FK constraint issues
        try:
            sb.table("cluster_shipments").delete().eq("shipment_id", shipment_id).execute()
        except Exception:
            pass  # Ignore if no cluster_shipments entries exist
        
        # Delete the shipment
        result = sb.table("shipments").delete().eq("id", shipment_id).execute()
        
        # Verify deletion by checking if it still exists
        verify_result = sb.table("shipments").select("id").eq("id", shipment_id).execute()
        if verify_result.data:
            return jsonify({"error": "Failed to delete shipment"}), 500
        
        return jsonify({"status": "deleted", "id": shipment_id}), 200
    except Exception as e:
        import traceback
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500


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
    
    def _get_city_coords(city_name):
        if not city_name:
            return None, None
        # Try database lookup first (case-insensitive)
        try:
            result = sb.table("cities").select("lat, lng").ilike("name", f"%{city_name.strip()}%").limit(1).execute()
            if result.data:
                return result.data[0].get("lat"), result.data[0].get("lng")
        except Exception:
            pass
        
        # Fallback to geocoding if not in database
        try:
            geo_result = geocode(f"{city_name.strip()}, India")
            if geo_result:
                return geo_result.get("lat"), geo_result.get("lng")
        except Exception:
            pass
        
        return None, None
    
    def _generate_unique_shipment_code(base_code, existing_codes):
        """Generate a unique shipment code, checking against existing codes."""
        if not base_code:
            base_code = f"UPLOAD-{int(time.time())}"
        
        # Check if base code is unique
        if base_code not in existing_codes:
            try:
                # Also check database
                result = sb.table("shipments").select("id").eq("shipment_code", base_code).limit(1).execute()
                if not result.data:
                    existing_codes.add(base_code)
                    return base_code
            except Exception:
                existing_codes.add(base_code)
                return base_code
        
        # Generate unique code
        max_attempts = 10
        for i in range(max_attempts):
            unique_code = f"{base_code}-{str(uuid.uuid4())[:8].upper()}"
            if unique_code not in existing_codes:
                try:
                    result = sb.table("shipments").select("id").eq("shipment_code", unique_code).limit(1).execute()
                    if not result.data:
                        existing_codes.add(unique_code)
                        return unique_code
                except Exception:
                    existing_codes.add(unique_code)
                    return unique_code
        
        # Final fallback
        final_code = f"{base_code}-{int(time.time())}"
        existing_codes.add(final_code)
        return final_code

    shipments = []
    errors    = []
    existing_codes = set()
    
    # First, get all existing shipment codes to avoid duplicates
    try:
        existing_result = sb.table("shipments").select("shipment_code").execute()
        existing_codes = {row["shipment_code"] for row in existing_result.data if row.get("shipment_code")}
    except Exception:
        pass
    
    for i, row in enumerate(reader):
        try:
            origin_city = row.get("origin_city", "").strip()
            dest_city = row.get("dest_city", "").strip()
            
            origin_lat = _safe_float(row.get("origin_lat"), None)
            origin_lng = _safe_float(row.get("origin_lng"), None)
            if (not origin_lat or not origin_lng) and origin_city:
                lat, lng = _get_city_coords(origin_city)
                if lat and lng:
                    origin_lat = lat
                    origin_lng = lng
                else:
                    # Default to Delhi if geocoding fails
                    origin_lat = 28.6139
                    origin_lng = 77.2090
            
            dest_lat = _safe_float(row.get("dest_lat"), None)
            dest_lng = _safe_float(row.get("dest_lng"), None)
            if (not dest_lat or not dest_lng) and dest_city:
                lat, lng = _get_city_coords(dest_city)
                if lat and lng:
                    dest_lat = lat
                    dest_lng = lng
                else:
                    # Default to Mumbai if geocoding fails
                    dest_lat = 19.0760
                    dest_lng = 72.8777
            
            # Generate unique shipment code
            base_code = row.get("shipment_id", "").strip()
            if not base_code:
                base_code = f"UPLOAD-{i+1}"
            unique_code = _generate_unique_shipment_code(base_code, existing_codes)
            
            shipments.append({
                "shipment_code":         unique_code,
                "origin_city":           origin_city,
                "origin_lat":            origin_lat or 28.6139,
                "origin_lng":            origin_lng or 77.2090,
                "dest_city":             dest_city,
                "dest_lat":              dest_lat or 19.0760,
                "dest_lng":              dest_lng or 72.8777,
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
    skipped = 0
    for i in range(0, len(shipments), 50):
        batch = shipments[i: i + 50]
        try:
            sb.table("shipments").insert(batch).execute()
            inserted += len(batch)
        except Exception as e:
            # Handle batch errors - try inserting one by one
            error_str = str(e)
            if "duplicate key" in error_str.lower() or "23505" in error_str:
                for shipment in batch:
                    try:
                        sb.table("shipments").insert(shipment).execute()
                        inserted += 1
                    except Exception:
                        skipped += 1
                        errors.append({"row": "batch", "error": f"Duplicate shipment_code: {shipment.get('shipment_code')}"})
            else:
                skipped += len(batch)
                errors.append({"row": f"batch {i//50 + 1}", "error": error_str})

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

    return jsonify({
        "inserted": inserted,
        "skipped": skipped,
        "parse_errors": errors,
        "message": f"Successfully inserted {inserted} shipments" + (f", skipped {skipped} duplicates" if skipped > 0 else "")
    }), 201
