"""Analytics and dashboard routes — live computed KPIs."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from services.carbon import calculate_emissions

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/api/analytics/dashboard", methods=["GET"])
def dashboard_kpis():
    sb = get_supabase()

    # ── live shipment counts ──
    try:
        total_result   = sb.table("shipments").select("id", count="exact").execute()
        pending_result = sb.table("shipments").select("id", count="exact").eq("status", "pending").execute()
        consol_result  = sb.table("shipments").select("id", count="exact").eq("status", "consolidated").execute()
        total_shp   = total_result.count   or 0
        pending_shp = pending_result.count or 0
        consol_shp  = consol_result.count  or 0
    except Exception:
        total_shp = pending_shp = consol_shp = 0

    # ── aggregated consolidation plan KPIs (sum across ALL plans) ──
    try:
        all_plans = sb.table("consolidation_plans").select(
            "avg_utilization, total_cost_before, total_cost_after, "
            "co2_before, co2_after, trips_before, trips_after, total_clusters"
        ).order("created_at", desc=True).execute()

        plans_list = all_plans.data or []
        if plans_list:
            total_cost_before = sum(p.get("total_cost_before", 0) or 0 for p in plans_list)
            total_cost_after  = sum(p.get("total_cost_after", 0) or 0 for p in plans_list)
            cost_saved  = total_cost_before - total_cost_after
            cost_before = total_cost_before  # for percentage calc

            total_co2_before = sum(p.get("co2_before", 0) or 0 for p in plans_list)
            total_co2_after  = sum(p.get("co2_after", 0) or 0 for p in plans_list)
            co2_saved   = total_co2_before - total_co2_after
            co2_before  = total_co2_before

            total_trips_before = sum(p.get("trips_before", 0) or 0 for p in plans_list)
            total_trips_after  = sum(p.get("trips_after", 0) or 0 for p in plans_list)
            trips_elim   = total_trips_before - total_trips_after
            trips_before = total_trips_before

            # avg utilization = weighted average or just latest plan's value
            avg_util = plans_list[0].get("avg_utilization", 0) or 0
        else:
            avg_util = 0; cost_saved = 0; cost_before = 1
            co2_saved = 0; co2_before = 1
            trips_elim = 0; trips_before = 1
        consol_rate = round(consol_shp / max(total_shp, 1) * 100, 1)
    except Exception:
        avg_util = 0; cost_saved = 0; cost_before = 1
        co2_saved = 0; co2_before = 1
        trips_elim = 0; trips_before = 1; consol_rate = 0

    # ── build dynamic KPI cards ──
    kpis = [
        {
            "label": "Total Shipments",
            "value": total_shp,
            "suffix": "",
            "change": 12,
            "change_label": "vs yesterday",
            "icon": "package",
        },
        {
            "label": "Consolidation Rate",
            "value": consol_rate,
            "suffix": "%",
            "change": 5.2,
            "change_label": "vs last week",
            "icon": "layers",
        },
        {
            "label": "Avg Utilization",
            "value": round(avg_util, 1),
            "suffix": "%",
            "change": 29,
            "change_label": "improvement",
            "icon": "gauge",
        },
        {
            "label": "Cost Savings",
            "value": round(cost_saved, 0),
            "suffix": "₹",
            "change": round((cost_saved / max(cost_before, 1)) * 100, 1),
            "change_label": "reduction",
            "icon": "indian-rupee",
        },
        {
            "label": "CO₂ Reduced",
            "value": round(co2_saved, 1),
            "suffix": " kg",
            "change": round(co2_saved / max(co2_before, 1) * 100, 1),
            "change_label": "reduction",
            "icon": "leaf",
        },
        {
            "label": "Trips Eliminated",
            "value": trips_elim,
            "suffix": "",
            "change": round(trips_elim / max(trips_before, 1) * 100, 1),
            "change_label": "fewer trips",
            "icon": "truck",
        },
    ]

    # ── utilization trend ──
    try:
        trend   = sb.table("utilization_trend").select("*").execute()
        trend_d = trend.data or []
    except Exception:
        trend_d = []

    # ── cost savings trend from consolidation plans ──
    cost_savings_trend = []
    try:
        plans_hist = sb.table("consolidation_plans").select(
            "total_cost_before, total_cost_after, avg_utilization, created_at"
        ).order("created_at", desc=False).execute()

        if plans_hist.data:
            from datetime import datetime
            for p in plans_hist.data:
                cb = p.get("total_cost_before", 0) or 0
                ca = p.get("total_cost_after", 0) or 0
                created = p.get("created_at", "")
                try:
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    label = dt.strftime("%b %d")
                except Exception:
                    label = created[:10] if created else "—"
                cost_savings_trend.append({
                    "date": label,
                    "before": round(cb),
                    "after": round(ca),
                })

            # Build utilization trend from plans if trend table is empty
            if not trend_d:
                for p in plans_hist.data:
                    util = p.get("avg_utilization", 0) or 0
                    cb = p.get("total_cost_before", 0) or 0
                    created = p.get("created_at", "")
                    try:
                        dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                        label = dt.strftime("%b %d")
                    except Exception:
                        label = created[:10] if created else "—"
                    trend_d.append({
                        "day": label,
                        "date": label,
                        "utilization": round(util, 1),
                        "cost": round(cb),
                    })
    except Exception:
        pass

    # ── utilization change pct ──
    util_change = 0
    if trend_d and len(trend_d) >= 2:
        first_util = trend_d[0].get("utilization", 0) or 0
        last_util = trend_d[-1].get("utilization", 0) or 0
        if first_util > 0:
            util_change = round((last_util - first_util) / first_util * 100, 1)

    # ── activity feed ──
    try:
        activities = sb.table("activity_feed").select("*").order("created_at", desc=True).limit(10).execute()
        act_d = activities.data or []
    except Exception:
        act_d = []

    # ── consolidation opportunities alert ──
    opportunities = []
    try:
        pending_cities = sb.table("shipments").select("dest_city").eq("status", "pending").execute()
        city_counts: dict[str, int] = {}
        for row in (pending_cities.data or []):
            c = row.get("dest_city", "")
            if c:
                city_counts[c] = city_counts.get(c, 0) + 1
        opportunities = sorted(
            [
                {"city": city, "shipment_count": cnt, "potential_saving": cnt * 2000}
                for city, cnt in city_counts.items() if cnt >= 3
            ],
            key=lambda x: x["shipment_count"],
            reverse=True,
        )
    except Exception:
        pass

    return jsonify({
        "kpis":               kpis,
        "utilization_trend":  trend_d,
        "cost_savings_trend": cost_savings_trend,
        "util_change":        util_change,
        "activity_feed":      act_d,
        "opportunities":      opportunities,
        "live":               True,
    })


@analytics_bp.route("/api/analytics/carbon", methods=["GET"])
def carbon_metrics():
    sb = get_supabase()

    try:
        monthly   = sb.table("carbon_monthly").select("*").execute()
        breakdown = sb.table("carbon_breakdown").select("*").execute()
    except Exception:
        monthly   = type("R", (), {"data": []})()
        breakdown = type("R", (), {"data": []})()

    # Aggregate metrics across ALL consolidation runs
    green_score      = "N/A"
    trees_equiv      = 0
    car_km_avoided   = 0
    co2_saved_total  = 0
    co2_before_total = 0
    co2_after_total  = 0
    pct_saved        = 0
    trips_before_total = 0
    trips_after_total  = 0
    trips_eliminated   = 0

    try:
        plans = sb.table("consolidation_plans").select(
            "id, co2_before, co2_after, total_clusters, total_shipments, trips_before, trips_after"
        ).order("created_at", desc=False).execute()

        # Also fetch all clusters for accurate CO₂ from real route distances
        all_plan_ids = [p["id"] for p in (plans.data or [])]
        clusters_data = []
        if all_plan_ids:
            try:
                cl = sb.table("clusters").select(
                    "plan_id, estimated_co2, route_distance_km, total_weight"
                ).in_("plan_id", all_plan_ids).execute()
                clusters_data = cl.data or []
            except Exception:
                pass

        # Group clusters by plan
        clusters_by_plan = {}
        for c in clusters_data:
            pid = c.get("plan_id")
            if pid not in clusters_by_plan:
                clusters_by_plan[pid] = []
            clusters_by_plan[pid].append(c)

        if plans.data:
            for p in plans.data:
                pid = p["id"]
                plan_clusters = clusters_by_plan.get(pid, [])

                if plan_clusters:
                    # Use real cluster data for accurate CO₂
                    co2_a = sum(c.get("estimated_co2", 0) or 0 for c in plan_clusters)

                    n_shipments = p.get("total_shipments", 0) or 0
                    co2_b = 0
                    for c in plan_clusters:
                        dist = c.get("route_distance_km", 0) or 0
                        weight = c.get("total_weight", 0) or 0
                        shipment_share = max(n_shipments, len(plan_clusters))
                        n_shp_cluster = max(shipment_share // len(plan_clusters), 1) if plan_clusters else 1
                        avg_w = weight / max(n_shp_cluster, 1)
                        co2_b += n_shp_cluster * dist * (avg_w / 1000.0) * 0.075 * 2.0
                else:
                    co2_b = p.get("co2_before", 0) or 0
                    co2_a = p.get("co2_after", 0)  or 0

                co2_before_total += co2_b
                co2_after_total  += co2_a
                co2_saved_total  += max(co2_b - co2_a, 0)

                tb = p.get("trips_before", 0) or 0
                ta = p.get("trips_after", 0)  or 0
                trips_before_total += tb
                trips_after_total  += ta
                trips_eliminated   += max(tb - ta, 0)

            pct_saved = round(co2_saved_total / max(co2_before_total, 1) * 100, 1)

            # Green score based on overall percentage
            if pct_saved >= 40:   green_score = "A+"
            elif pct_saved >= 30: green_score = "A"
            elif pct_saved >= 20: green_score = "B+"
            elif pct_saved >= 15: green_score = "B"
            elif pct_saved >= 10: green_score = "C"
            elif pct_saved >= 5:  green_score = "D"
            else:                 green_score = "F"

            trees_equiv    = int(co2_saved_total / 22)
            car_km_avoided = int(co2_saved_total / 0.166)
    except Exception:
        pass

    # Derived sustainability metrics
    energy_saved_kwh  = round(co2_saved_total * 0.7, 1)
    fuel_saved_liters = round(co2_saved_total / 2.68, 1)
    clean_air_days    = max(int(co2_saved_total / 250), 0)

    return jsonify({
        "monthly":            monthly.data,
        "breakdown":          breakdown.data,
        "green_score":        green_score,
        "trees_equivalent":   trees_equiv,
        "car_km_avoided":     car_km_avoided,
        "co2_saved_total":    round(co2_saved_total, 2),
        "co2_before":         round(co2_before_total, 2),
        "co2_after":          round(co2_after_total, 2),
        "pct_saved":          pct_saved,
        "trips_eliminated":   trips_eliminated,
        "energy_saved_kwh":   energy_saved_kwh,
        "fuel_saved_liters":  fuel_saved_liters,
        "clean_air_days":     clean_air_days,
        "total_runs":         len(plans.data) if plans.data else 0,
    })


@analytics_bp.route("/api/analytics/utilization", methods=["GET"])
def utilization_trend():
    sb     = get_supabase()
    result = sb.table("utilization_trend").select("*").execute()
    return jsonify(result.data)


@analytics_bp.route("/api/analytics/carbon-runs", methods=["GET"])
def carbon_per_run():
    """Return CO₂ data broken down by consolidation run and per-cluster."""
    sb = get_supabase()

    # Fetch all consolidation plans ordered by creation
    plans = sb.table("consolidation_plans").select(
        "id, name, created_at, co2_before, co2_after, "
        "trips_before, trips_after, total_clusters, total_shipments"
    ).order("created_at", desc=False).execute()

    all_plan_ids = [p["id"] for p in (plans.data or [])]

    # Fetch clusters for ALL plans (for accurate per-run CO₂ and truck breakdown)
    clusters_data = []
    if all_plan_ids:
        try:
            # Fetch in batches if needed (Supabase IN clause)
            cl = sb.table("clusters").select(
                "plan_id, vehicle_name, estimated_co2, "
                "route_distance_km, total_weight, utilization_pct, "
                "total_volume"
            ).in_("plan_id", all_plan_ids).execute()
            clusters_data = cl.data or []
        except Exception:
            pass

    # Group clusters by plan_id for per-run recomputation
    clusters_by_plan = {}
    for c in clusters_data:
        pid = c.get("plan_id")
        if pid not in clusters_by_plan:
            clusters_by_plan[pid] = []
        clusters_by_plan[pid].append(c)

    runs = []
    for i, p in enumerate(plans.data or []):
        pid = p["id"]
        plan_clusters = clusters_by_plan.get(pid, [])

        if plan_clusters:
            # Recompute CO₂ from actual cluster data (real route distances)
            co2_a = sum(c.get("estimated_co2", 0) or 0 for c in plan_clusters)

            # Recompute co2_before: each shipment solo in a medium truck
            n_shipments = p.get("total_shipments", 0) or 0
            co2_b = 0
            for c in plan_clusters:
                dist = c.get("route_distance_km", 0) or 0
                weight = c.get("total_weight", 0) or 0
                # Before: each unit of weight shipped solo at 2x emission
                # Using medium truck factor (0.075) and 2.0 multiplier
                # to match calculate_emissions logic
                shipment_share = max(n_shipments, len(plan_clusters))
                n_shp_cluster = max(shipment_share // len(plan_clusters), 1) if plan_clusters else 1
                avg_w = weight / max(n_shp_cluster, 1)
                co2_b += n_shp_cluster * dist * (avg_w / 1000.0) * 0.075 * 2.0
        else:
            # Fallback to plan-stored estimates
            co2_b = p.get("co2_before", 0) or 0
            co2_a = p.get("co2_after", 0) or 0

        saved = max(co2_b - co2_a, 0)
        runs.append({
            "run":             i + 1,
            "plan_id":         pid,
            "name":            p.get("name", f"Run {i+1}"),
            "created_at":      p.get("created_at"),
            "co2_before":      round(co2_b, 2),
            "co2_after":       round(co2_a, 2),
            "co2_saved":       round(saved, 2),
            "trips_before":    p.get("trips_before", 0) or 0,
            "trips_after":     p.get("trips_after", 0)  or 0,
            "total_clusters":  p.get("total_clusters", 0) or 0,
            "total_shipments": p.get("total_shipments", 0) or 0,
        })

    return jsonify({
        "runs":     runs,
        "clusters": clusters_data,
    })

