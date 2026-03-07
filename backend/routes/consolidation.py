"""Consolidation engine routes — wired to real AI/ML services."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from services.clustering import cluster_shipments
from services.bin_packing import pack_cluster
from services.vrp_solver   import optimize_route
from services.carbon       import calculate_emissions
from datetime import datetime, timezone

consolidation_bp = Blueprint("consolidation", __name__)

ROUTE_COLOURS = [
    "#635BFF", "#0CAF60", "#E5850B", "#DF1B41",
    "#00A2E8", "#FF6B35", "#9B59B6", "#1ABC9C",
]


# ── helpers ────────────────────────────────────────────────

def _get_pending_shipments(sb, filters: dict) -> list:
    query = sb.table("shipments").select("*").eq("status", "pending")

    if filters.get("origin_city"):
        query = query.ilike("origin_city", f"%{filters['origin_city']}%")
    if filters.get("dest_city"):
        query = query.ilike("dest_city", f"%{filters['dest_city']}%")

    result = query.limit(500).execute()
    return result.data or []


def _get_vehicle_by_name(sb, name: str) -> dict | None:
    try:
        result = sb.table("vehicles").select("*").ilike("name", f"%{name}%").limit(1).execute()
        return result.data[0] if result.data else None
    except Exception:
        return None


def _get_first_depot(sb) -> dict | None:
    try:
        result = sb.table("depots").select("*").limit(1).execute()
        return result.data[0] if result.data else None
    except Exception:
        return None


# ── plan endpoints ─────────────────────────────────────────

@consolidation_bp.route("/api/consolidate", methods=["GET"])
def list_plans():
    sb = get_supabase()
    result = sb.table("consolidation_plans").select("*").order("created_at", desc=True).execute()
    return jsonify(result.data)


@consolidation_bp.route("/api/consolidate/latest", methods=["GET"])
def get_latest_plan():
    sb = get_supabase()
    plan = sb.table("consolidation_plans").select("*").order("created_at", desc=True).limit(1).execute()
    if not plan.data:
        return jsonify(None)
    return _build_plan_response(sb, plan.data[0])


@consolidation_bp.route("/api/consolidate/<plan_id>", methods=["GET"])
def get_plan(plan_id):
    sb = get_supabase()
    try:
        plan = sb.table("consolidation_plans").select("*").eq("id", plan_id).single().execute()
        return _build_plan_response(sb, plan.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 404


def _build_plan_response(sb, plan_data: dict) -> object:
    pid = plan_data["id"]
    clusters = sb.table("clusters").select("*").eq("plan_id", pid).execute()
    for c in clusters.data:
        cs = sb.table("cluster_shipments").select(
            "shipment_id, load_order, position_x, position_y, position_z"
        ).eq("cluster_id", c["id"]).order("load_order").execute()
        c["shipment_ids"] = [r["shipment_id"] for r in cs.data]
    plan_data["clusters"] = clusters.data
    return jsonify(plan_data)


# ── CORE: run consolidation engine ────────────────────────

@consolidation_bp.route("/api/consolidate", methods=["POST"])
def run_consolidation():
    """
    Main endpoint — runs the full consolidation pipeline:
      1. DBSCAN clustering
      2. 3D bin packing per cluster
      3. VRP route optimisation per cluster
      4. Carbon emission calculation
      5. Persist plan + clusters + routes to Supabase
    """
    sb   = get_supabase()
    body = request.get_json(silent=True) or {}
    constraints = body.get("constraints", {})

    # --- 1. Fetch pending shipments ---
    shipments = _get_pending_shipments(sb, constraints)
    if not shipments:
        return jsonify({"error": "No pending shipments found to consolidate"}), 404

    n_shipments_before = sb.table("shipments").select("id", count="exact").execute().count or len(shipments)

    # Before metrics: count unique trips if no consolidation
    trips_before = len(shipments)
    cost_before  = trips_before * 9500   # rough avg per-trip cost
    co2_before_estimate = trips_before * 18.0  # rough kg CO₂ per solo trip

    # --- 2. DBSCAN clustering ---
    clusters = cluster_shipments(shipments, constraints)

    if not clusters:
        return jsonify({"error": "Clustering produced no groups"}), 500

    # --- 3. Prepare carbon inputs ---
    depot = _get_first_depot(sb)

    cluster_co2_inputs = []
    for c in clusters:
        cluster_co2_inputs.append({
            "route_distance_km": 600,        # will be updated after VRP
            "total_weight":      c["total_weight"],
            "vehicle_type":      c["vehicle"]["type"],
            "shipment_count":    len(c["shipment_ids"]),
        })

    # --- 4. Compute after carbon (quick estimate) ---
    emission_data = calculate_emissions(cluster_co2_inputs)

    avg_util    = sum(c["utilization_pct"] for c in clusters) / max(len(clusters), 1)
    total_cost_after = sum(
        cluster_co2_inputs[i]["route_distance_km"] *
        c["vehicle"].get("cost_per_km", 24)
        for i, c in enumerate(clusters)
    )

    # --- 5. Insert consolidation plan ---
    plan_name = f"Consolidation Plan — {datetime.now(timezone.utc).strftime('%b %d, %Y %H:%M')}"
    plan_result = sb.table("consolidation_plans").insert({
        "name":              plan_name,
        "status":            "active",
        "total_shipments":   len(shipments),
        "total_clusters":    len(clusters),
        "avg_utilization":   round(avg_util, 1),
        "total_cost_before": cost_before,
        "total_cost_after":  round(total_cost_after, 0),
        "co2_before":        round(emission_data["co2_before"], 2),
        "co2_after":         round(emission_data["co2_after"], 2),
        "trips_before":      trips_before,
        "trips_after":       len(clusters),
    }).execute()

    plan_id = plan_result.data[0]["id"]
    cluster_results = []

    # --- 6. Per-cluster: bin packing + VRP + persist ---
    for idx, c in enumerate(clusters):
        vname = c["vehicle"]["name"]

        # Fetch vehicle from DB for full dimensions
        db_vehicle = _get_vehicle_by_name(sb, vname) or {
            "id": None,
            "length_cm": 720, "width_cm": 240, "height_cm": 240,
            "max_weight_kg": c["vehicle"]["max_weight"], "max_volume_m3": 42,
            "cost_per_km": 24,
        }

        # 3D bin packing
        packing = pack_cluster(c["shipments"], db_vehicle)

        # VRP route optimisation
        route   = optimize_route(c["shipments"], db_vehicle, depot)

        dist_km        = route["total_distance_km"]
        est_cost       = dist_km * float(db_vehicle.get("cost_per_km", 24))
        co2_cluster    = calculate_emissions([{
            "route_distance_km": dist_km,
            "total_weight":      c["total_weight"],
            "vehicle_type":      c["vehicle"]["type"],
            "shipment_count":    len(c["shipment_ids"]),
        }])

        # Insert cluster
        cluster_row = sb.table("clusters").insert({
            "plan_id":          plan_id,
            "vehicle_id":       db_vehicle.get("id"),
            "vehicle_name":     vname,
            "utilization_pct":  c["utilization_pct"],
            "total_weight":     c["total_weight"],
            "total_volume":     c["total_volume"],
            "route_distance_km": dist_km,
            "estimated_cost":   round(est_cost, 2),
            "estimated_co2":    co2_cluster["co2_after"],
            "status":           "pending",
            "packing_layout":   packing,
            "route_geometry":   {"stops": route["stops"]},
        }).execute()

        cid = cluster_row.data[0]["id"]

        # Map shipments → cluster
        for i, sid in enumerate(c["shipment_ids"]):
            item = next((it for it in packing["items"] if it["shipment_id"] == sid), None)
            try:
                sb.table("cluster_shipments").insert({
                    "cluster_id":  cid,
                    "shipment_id": sid,
                    "load_order":  i + 1,
                    "position_x":  item["x"] if item else 0,
                    "position_y":  item["y"] if item else 0,
                    "position_z":  item["z"] if item else 0,
                }).execute()
            except Exception:
                pass

        # Update shipment status → consolidated
        try:
            sb.table("shipments").update({"status": "consolidated"}).in_("id", c["shipment_ids"]).execute()
        except Exception:
            pass

        # Insert route
        try:
            sb.table("routes").insert({
                "cluster_id":        cid,
                "vehicle_name":      vname,
                "color":             ROUTE_COLOURS[idx % len(ROUTE_COLOURS)],
                "points":            route["stops"],
                "total_distance_km": dist_km,
                "estimated_time":    route["estimated_time"],
                "fuel_cost":         route["fuel_cost"],
            }).execute()
        except Exception:
            pass

        cluster_results.append({
            "id":              cid,
            "vehicle_name":    vname,
            "shipment_ids":    c["shipment_ids"],
            "utilization_pct": c["utilization_pct"],
            "total_weight":    c["total_weight"],
            "total_volume":    c["total_volume"],
            "route_distance_km": dist_km,
            "estimated_cost":  round(est_cost, 2),
            "estimated_co2":   co2_cluster["co2_after"],
            "packing_layout":  packing,
            "route_stops":     route["stops"],
        })

    # --- 7. Activity feed ---
    cost_saved = round(cost_before - total_cost_after, 0)
    try:
        sb.table("activity_feed").insert({
            "type":      "consolidation",
            "message":   (
                f"Consolidation plan \"{plan_name}\" created — "
                f"{len(clusters)} clusters from {len(shipments)} shipments, "
                f"₹{cost_saved:,.0f} saved"
            ),
            "timestamp": "just now",
            "icon":      "layers",
        }).execute()
    except Exception:
        pass

    return jsonify({
        "plan_id":           plan_id,
        "plan_name":         plan_name,
        "total_shipments":   len(shipments),
        "total_clusters":    len(clusters),
        "avg_utilization":   round(avg_util, 1),
        "trips_before":      trips_before,
        "trips_after":       len(clusters),
        "cost_before":       cost_before,
        "cost_after":        round(total_cost_after, 0),
        "co2_before":        emission_data["co2_before"],
        "co2_after":         emission_data["co2_after"],
        "co2_saved":         emission_data["co2_saved"],
        "green_score":       emission_data["green_score"],
        "clusters":          cluster_results,
    }), 201


# ── feedback ───────────────────────────────────────────────

@consolidation_bp.route("/api/clusters/<cluster_id>/feedback", methods=["POST"])
def submit_feedback(cluster_id):
    sb   = get_supabase()
    data = request.get_json() or {}
    action = data.get("action", "accepted")

    try:
        sb.table("clusters").update({"status": action}).eq("id", cluster_id).execute()
        sb.table("feedback").insert({
            "cluster_id": cluster_id,
            "action":     action,
            "reason":     data.get("reason", ""),
        }).execute()
        # Activity feed
        sb.table("activity_feed").insert({
            "type":      "consolidation",
            "message":   f"Cluster {cluster_id[:8]}… {action} by logistics manager",
            "timestamp": "just now",
            "icon":      "check-circle" if action == "accepted" else "x-circle",
        }).execute()
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"status": "ok", "action": action})
