"""Shipment CRUD routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from utils.geocoding import geocode
from config import GROQ_API_KEY, GROQ_MODEL
from datetime import datetime, timezone
import csv
import io
import uuid
import time
import json

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
    # Auto-track when status changes
    if "status" in data:
        data["status_changed_at"] = datetime.now(timezone.utc).isoformat()
    result = sb.table("shipments").update(data).eq("id", shipment_id).execute()
    if not result.data:
        return jsonify({"error": "Not found"}), 404
    return jsonify(result.data[0])


@shipments_bp.route("/api/shipments/progress-status", methods=["POST"])
def progress_status():
    """
    Auto-advance shipment statuses based on time since status_changed_at:
      consolidated  → in_transit   after 1 hour
      in_transit    → delivered    after 2 hours (i.e. 1 hour after in_transit)
    When all shipments in a cluster are delivered, mark cluster as delivered.
    """
    sb = get_supabase()
    now = datetime.now(timezone.utc)
    updated = {"to_in_transit": 0, "to_delivered": 0, "clusters_delivered": 0}

    try:
        # Fetch consolidated shipments
        consolidated = sb.table("shipments").select("id, status_changed_at").eq("status", "consolidated").execute()
        for s in (consolidated.data or []):
            changed_at = s.get("status_changed_at")
            if not changed_at:
                continue
            try:
                ts = datetime.fromisoformat(changed_at.replace("Z", "+00:00"))
                elapsed_min = (now - ts).total_seconds() / 60
                if elapsed_min >= 60:  # 1 hour → in_transit
                    sb.table("shipments").update({
                        "status": "in_transit",
                        "status_changed_at": now.isoformat(),
                    }).eq("id", s["id"]).execute()
                    updated["to_in_transit"] += 1
            except Exception:
                pass

        # Fetch in-transit shipments
        in_transit = sb.table("shipments").select("id, status_changed_at").eq("status", "in_transit").execute()
        for s in (in_transit.data or []):
            changed_at = s.get("status_changed_at")
            if not changed_at:
                continue
            try:
                ts = datetime.fromisoformat(changed_at.replace("Z", "+00:00"))
                elapsed_min = (now - ts).total_seconds() / 60
                if elapsed_min >= 60:  # 1 hour after in_transit → delivered
                    sb.table("shipments").update({
                        "status": "delivered",
                        "status_changed_at": now.isoformat(),
                    }).eq("id", s["id"]).execute()
                    updated["to_delivered"] += 1
            except Exception:
                pass

        # Mark clusters as delivered when all their shipments are delivered
        from utils.cluster_sync import mark_completed_clusters_as_delivered
        marked = mark_completed_clusters_as_delivered(sb)
        updated["clusters_delivered"] = marked
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(updated)


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


@shipments_bp.route("/api/shipments/preview-csv", methods=["POST"])
def preview_csv():
    """Parse CSV and return rows with validation info, without inserting."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    content = file.read().decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(content))

    def _safe_float(val, default=None):
        try:
            return float(val) if val and str(val).strip() else default
        except (ValueError, TypeError):
            return default

    rows = []
    parse_errors = []
    columns = []

    for i, row in enumerate(reader):
        if i == 0:
            columns = list(row.keys())
        try:
            # Normalize field names (handle multiple CSV formats)
            parsed = {
                "shipment_id":    (row.get("shipment_id") or row.get("shipment_code") or "").strip(),
                "origin_city":    (row.get("origin_city") or row.get("origin") or "").strip(),
                "origin_lat":     _safe_float(row.get("origin_lat")),
                "origin_lng":     _safe_float(row.get("origin_lng")),
                "dest_city":      (row.get("dest_city") or row.get("destination") or row.get("destination_city") or "").strip(),
                "dest_lat":       _safe_float(row.get("dest_lat")),
                "dest_lng":       _safe_float(row.get("dest_lng")),
                "weight_kg":      _safe_float(row.get("weight_kg") or row.get("weight")),
                "volume_m3":      _safe_float(row.get("volume_m3") or row.get("volume")),
                "length_cm":      _safe_float(row.get("length_cm") or row.get("length")),
                "width_cm":       _safe_float(row.get("width_cm") or row.get("width")),
                "height_cm":      _safe_float(row.get("height_cm") or row.get("height")),
                "delivery_start": (row.get("delivery_start") or row.get("delivery_window_start") or "").strip(),
                "delivery_end":   (row.get("delivery_end") or row.get("delivery_window_end") or "").strip(),
                "priority":       (row.get("priority") or "").strip().lower(),
                "cargo_type":     (row.get("cargo_type") or "").strip().lower(),
            }

            # Validate and flag missing/invalid fields
            issues = []
            essential_issues = []
            if not parsed["origin_city"]:
                issues.append("origin_city")
                essential_issues.append("origin_city")
            if not parsed["dest_city"]:
                issues.append("dest_city")
                essential_issues.append("dest_city")
            if not parsed["weight_kg"] or parsed["weight_kg"] <= 0:
                issues.append("weight_kg")
                essential_issues.append("weight_kg")
            if not parsed["length_cm"] or parsed["length_cm"] <= 0:
                issues.append("length_cm")
            if not parsed["width_cm"] or parsed["width_cm"] <= 0:
                issues.append("width_cm")
            if not parsed["height_cm"] or parsed["height_cm"] <= 0:
                issues.append("height_cm")
            if parsed["priority"] not in ("normal", "express", "critical"):
                issues.append("priority")
            if parsed["cargo_type"] not in ("general", "fragile", "refrigerated", "hazardous"):
                issues.append("cargo_type")
            if not parsed["delivery_start"]:
                issues.append("delivery_start")
            if not parsed["delivery_end"]:
                issues.append("delivery_end")

            parsed["_row"] = i + 2  # 1-indexed + header
            parsed["_issues"] = issues
            parsed["_essential_issues"] = essential_issues

            rows.append(parsed)
        except Exception as e:
            parse_errors.append({"row": i + 2, "error": str(e)})

    total_issues = sum(len(r["_issues"]) for r in rows)
    essential_missing = sum(len(r["_essential_issues"]) for r in rows)

    return jsonify({
        "rows": rows,
        "columns": columns,
        "total": len(rows),
        "total_issues": total_issues,
        "essential_missing": essential_missing,
        "parse_errors": parse_errors,
    })


@shipments_bp.route("/api/shipments/ai-fix", methods=["POST"])
def ai_fix_csv():
    """Use Groq LLM to fix/fill missing values in previewed CSV rows."""
    data = request.get_json()
    if not data or "rows" not in data:
        return jsonify({"error": "No rows provided"}), 400

    rows = data["rows"]

    # Find rows that have issues
    rows_with_issues = [r for r in rows if r.get("_issues")]
    if not rows_with_issues:
        return jsonify({"rows": rows, "fixed_count": 0, "message": "No issues to fix"})

    # Build prompt for Groq
    prompt_rows = []
    for r in rows_with_issues:
        prompt_rows.append({
            "row": r.get("_row"),
            "data": {k: v for k, v in r.items() if not k.startswith("_")},
            "missing_fields": r.get("_issues", []),
        })

    system_prompt = """You are a logistics data expert. You will be given shipment rows with missing or invalid fields.
Fix the missing values using realistic, contextually appropriate values for Indian logistics:

Rules:
- origin_city / dest_city: Use real Indian cities (Delhi, Mumbai, Chennai, Kolkata, Bangalore, Pune, Ahmedabad, Hyderabad, Jaipur, Lucknow, Kochi, Nagpur, Surat, Vadodara, Indore). If origin is present, pick a DIFFERENT city for dest and vice versa.
- weight_kg: Realistic shipment weight between 50-5000 kg based on cargo_type (fragile: 50-500, general: 100-3000, refrigerated: 200-2000, hazardous: 100-1500)
- length_cm, width_cm, height_cm: Realistic dimensions (length: 50-300, width: 40-200, height: 30-200). Volume should be reasonable for the weight.
- volume_m3: Calculate as (length_cm * width_cm * height_cm) / 1000000
- priority: One of "normal", "express", "critical". Default to "normal".
- cargo_type: One of "general", "fragile", "refrigerated", "hazardous". Default to "general".
- delivery_start: ISO datetime, reasonable pickup time (e.g. morning hours). Use 2026-03-08 as base date.
- delivery_end: ISO datetime, 12-48 hours after delivery_start.
- origin_lat/origin_lng, dest_lat/dest_lng: Look up approximate coordinates for the city.

Respond with ONLY a valid JSON array of the fixed rows. Each object should have the same fields as input but with missing values filled in. Include the "row" field to map back."""

    user_prompt = f"Fix these shipment rows:\n{json.dumps(prompt_rows, indent=2)}"

    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=4096,
        )

        raw = response.choices[0].message.content.strip()
        # Extract JSON from response (handle markdown code blocks)
        if "```" in raw:
            json_match = raw.split("```")[1]
            if json_match.startswith("json"):
                json_match = json_match[4:]
            raw = json_match.strip()

        fixed_data = json.loads(raw)

        # Merge fixed values back into original rows
        fixed_map = {}
        for fd in fixed_data:
            row_num = fd.get("row")
            if row_num:
                fixed_map[row_num] = fd.get("data", fd)

        fixed_count = 0
        for r in rows:
            row_num = r.get("_row")
            if row_num in fixed_map:
                fix = fixed_map[row_num]
                for field in r.get("_issues", []):
                    if field in fix and fix[field]:
                        r[field] = fix[field]
                        fixed_count += 1
                # Recompute volume if dimensions were fixed
                if r.get("length_cm") and r.get("width_cm") and r.get("height_cm"):
                    try:
                        r["volume_m3"] = round(float(r["length_cm"]) * float(r["width_cm"]) * float(r["height_cm"]) / 1_000_000, 3)
                    except (ValueError, TypeError):
                        pass
                # Re-validate
                new_issues = []
                new_essential = []
                if not r.get("origin_city"):
                    new_issues.append("origin_city")
                    new_essential.append("origin_city")
                if not r.get("dest_city"):
                    new_issues.append("dest_city")
                    new_essential.append("dest_city")
                if not r.get("weight_kg") or float(r.get("weight_kg", 0)) <= 0:
                    new_issues.append("weight_kg")
                    new_essential.append("weight_kg")
                if not r.get("length_cm") or float(r.get("length_cm", 0)) <= 0:
                    new_issues.append("length_cm")
                if not r.get("width_cm") or float(r.get("width_cm", 0)) <= 0:
                    new_issues.append("width_cm")
                if not r.get("height_cm") or float(r.get("height_cm", 0)) <= 0:
                    new_issues.append("height_cm")
                if str(r.get("priority", "")).lower() not in ("normal", "express", "critical"):
                    new_issues.append("priority")
                if str(r.get("cargo_type", "")).lower() not in ("general", "fragile", "refrigerated", "hazardous"):
                    new_issues.append("cargo_type")
                if not r.get("delivery_start"):
                    new_issues.append("delivery_start")
                if not r.get("delivery_end"):
                    new_issues.append("delivery_end")
                r["_issues"] = new_issues
                r["_essential_issues"] = new_essential

        return jsonify({"rows": rows, "fixed_count": fixed_count, "message": f"AI fixed {fixed_count} values"})

    except ImportError:
        return jsonify({"error": "Groq SDK not installed. Run: pip install groq"}), 500
    except json.JSONDecodeError as e:
        return jsonify({"error": f"AI returned invalid JSON: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"AI fix failed: {str(e)}"}), 500


@shipments_bp.route("/api/shipments/insert-batch", methods=["POST"])
def insert_batch():
    """Insert previewed/fixed shipment rows into the database."""
    from config import SUPABASE_URL, SUPABASE_KEY
    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({"error": "Supabase is not configured. Add SUPABASE_URL and SUPABASE_KEY to backend/.env"}), 503
    sb = get_supabase()
    data = request.get_json()
    if not data or "rows" not in data:
        return jsonify({"error": "No rows provided"}), 400

    rows = data["rows"]
    offset = data.get("offset", 0)  # For chunked inserts, preserve UPLOAD-N numbering

    def _safe_float(val, default=0.0):
        try:
            return float(val) if val and str(val).strip() else default
        except (ValueError, TypeError):
            return default

    # Cache city coords to avoid repeated geocoding (major perf gain for batch inserts)
    city_coord_cache = {}

    def _get_city_coords(city_name):
        if not city_name:
            return None, None
        key = city_name.strip().lower()
        if key in city_coord_cache:
            return city_coord_cache[key]
        try:
            result = sb.table("cities").select("lat, lng").ilike("name", f"%{city_name.strip()}%").limit(1).execute()
            if result.data:
                lat, lng = result.data[0].get("lat"), result.data[0].get("lng")
                city_coord_cache[key] = (lat, lng)
                return lat, lng
        except Exception:
            pass
        try:
            geo_result = geocode(f"{city_name.strip()}, India")
            if geo_result:
                lat, lng = geo_result.get("lat"), geo_result.get("lng")
                city_coord_cache[key] = (lat, lng)
                return lat, lng
        except Exception:
            pass
        city_coord_cache[key] = (None, None)
        return None, None

    # Gather existing shipment codes
    existing_codes = set()
    try:
        existing_result = sb.table("shipments").select("shipment_code").execute()
        existing_codes = {row["shipment_code"] for row in existing_result.data if row.get("shipment_code")}
    except Exception:
        pass

    shipments = []
    errors = []

    for i, row in enumerate(rows):
        try:
            origin_city = (row.get("origin_city") or "").strip()
            dest_city = (row.get("dest_city") or "").strip()

            origin_lat = _safe_float(row.get("origin_lat"), None)
            origin_lng = _safe_float(row.get("origin_lng"), None)
            if (not origin_lat or not origin_lng) and origin_city:
                lat, lng = _get_city_coords(origin_city)
                if lat and lng:
                    origin_lat, origin_lng = lat, lng
                else:
                    origin_lat, origin_lng = 28.6139, 77.2090

            dest_lat = _safe_float(row.get("dest_lat"), None)
            dest_lng = _safe_float(row.get("dest_lng"), None)
            if (not dest_lat or not dest_lng) and dest_city:
                lat, lng = _get_city_coords(dest_city)
                if lat and lng:
                    dest_lat, dest_lng = lat, lng
                else:
                    dest_lat, dest_lng = 19.0760, 72.8777

            # Generate unique shipment code
            base_code = (row.get("shipment_id") or "").strip()
            if not base_code:
                base_code = f"UPLOAD-{offset + i + 1}"
            code = base_code
            if code in existing_codes:
                code = f"{base_code}-{str(uuid.uuid4())[:8].upper()}"
            existing_codes.add(code)

            shipments.append({
                "shipment_code":         code,
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
                "delivery_window_start": (row.get("delivery_start") or "2026-03-08T08:00:00+00:00").strip(),
                "delivery_window_end":   (row.get("delivery_end") or "2026-03-09T18:00:00+00:00").strip(),
                "priority":              (row.get("priority") or "normal").strip().lower(),
                "cargo_type":            (row.get("cargo_type") or "general").strip().lower(),
                "status":                "pending",
            })
        except Exception as e:
            errors.append({"row": i + 1, "error": str(e)})

    if not shipments:
        return jsonify({"error": "No valid rows to insert", "parse_errors": errors}), 400

    inserted = 0
    skipped = 0
    for i in range(0, len(shipments), 50):
        batch = shipments[i: i + 50]
        try:
            sb.table("shipments").insert(batch).execute()
            inserted += len(batch)
        except Exception as e:
            error_str = str(e)
            if "duplicate key" in error_str.lower() or "23505" in error_str:
                for shipment in batch:
                    try:
                        sb.table("shipments").insert(shipment).execute()
                        inserted += 1
                    except Exception:
                        skipped += 1
            else:
                skipped += len(batch)
                errors.append({"row": f"batch {i//50 + 1}", "error": error_str})

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
