"""Report generation routes — CSV/JSON export."""

from flask import Blueprint, jsonify, Response, request
from models.supabase_client import get_supabase
import csv
import io
import json

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("/api/reports", methods=["GET"])
def list_reports():
    sb     = get_supabase()
    result = sb.table("reports").select("*").execute()
    return jsonify(result.data)


VALID_REPORT_TYPES = {"consolidation", "utilization", "cost", "carbon"}

@reports_bp.route("/api/reports/<report_type>", methods=["GET"])
def get_report(report_type):
    if report_type not in VALID_REPORT_TYPES:
        return jsonify({"error": f"Unknown report type: {report_type}", "valid_types": sorted(VALID_REPORT_TYPES)}), 400
    sb     = get_supabase()
    result = sb.table("reports").select("*").eq("type", report_type).execute()
    return jsonify(result.data)


@reports_bp.route("/api/reports/<report_type>/download", methods=["GET"])
def download_report(report_type):
    """Generate and stream a CSV report."""
    sb     = get_supabase()
    fmt    = request.args.get("format", "csv").lower()

    if report_type == "consolidation":
        rows = _build_consolidation_report(sb)
        filename = "lorri_consolidation_report.csv"
        headers_list = ["cluster_id", "vehicle_name", "shipment_count",
                        "total_weight_kg", "utilization_pct",
                        "route_distance_km", "estimated_cost_inr", "estimated_co2_kg", "status"]

    elif report_type == "utilization":
        rows = _build_utilization_report(sb)
        filename = "lorri_utilization_report.csv"
        headers_list = ["vehicle_name", "utilization_pct", "total_weight_kg",
                        "total_volume_m3", "route_distance_km", "estimated_cost_inr"]

    elif report_type == "cost":
        rows = _build_cost_report(sb)
        filename = "lorri_cost_savings_report.csv"
        headers_list = ["plan_name", "trips_before", "trips_after", "trips_saved",
                        "cost_before_inr", "cost_after_inr", "cost_saved_inr",
                        "co2_before_kg", "co2_after_kg", "co2_saved_kg"]

    elif report_type == "carbon":
        rows = _build_carbon_report(sb)
        filename = "lorri_carbon_report.csv"
        headers_list = ["month", "co2_before_kg", "co2_after_kg", "savings_kg"]

    else:
        return jsonify({"error": f"Unknown report type: {report_type}"}), 400

    if fmt == "json":
        return Response(
            json.dumps(rows, indent=2),
            mimetype="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename.replace('.csv', '.json')}"}
        )

    # CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers_list, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── report builders ────────────────────────────────────────

def _build_consolidation_report(sb) -> list:
    clusters = sb.table("clusters").select("*").execute().data or []
    rows = []
    for c in clusters:
        n = len(sb.table("cluster_shipments").select("shipment_id").eq("cluster_id", c["id"]).execute().data or [])
        rows.append({
            "cluster_id":        c["id"][:8],
            "vehicle_name":      c.get("vehicle_name", ""),
            "shipment_count":    n,
            "total_weight_kg":   c.get("total_weight", 0),
            "utilization_pct":   c.get("utilization_pct", 0),
            "route_distance_km": c.get("route_distance_km", 0),
            "estimated_cost_inr": c.get("estimated_cost", 0),
            "estimated_co2_kg":  c.get("estimated_co2", 0),
            "status":            c.get("status", "pending"),
        })
    return rows


def _build_utilization_report(sb) -> list:
    clusters = sb.table("clusters").select("*").execute().data or []
    return [{
        "vehicle_name":      c.get("vehicle_name", ""),
        "utilization_pct":   c.get("utilization_pct", 0),
        "total_weight_kg":   c.get("total_weight", 0),
        "total_volume_m3":   c.get("total_volume", 0),
        "route_distance_km": c.get("route_distance_km", 0),
        "estimated_cost_inr": c.get("estimated_cost", 0),
    } for c in clusters]


def _build_cost_report(sb) -> list:
    plans = sb.table("consolidation_plans").select("*").order("created_at", desc=True).execute().data or []
    return [{
        "plan_name":       p.get("name", ""),
        "trips_before":    p.get("trips_before", 0),
        "trips_after":     p.get("trips_after", 0),
        "trips_saved":     (p.get("trips_before", 0) or 0) - (p.get("trips_after", 0) or 0),
        "cost_before_inr": p.get("total_cost_before", 0),
        "cost_after_inr":  p.get("total_cost_after", 0),
        "cost_saved_inr":  (p.get("total_cost_before", 0) or 0) - (p.get("total_cost_after", 0) or 0),
        "co2_before_kg":   p.get("co2_before", 0),
        "co2_after_kg":    p.get("co2_after", 0),
        "co2_saved_kg":    (p.get("co2_before", 0) or 0) - (p.get("co2_after", 0) or 0),
    } for p in plans]


def _build_carbon_report(sb) -> list:
    monthly = sb.table("carbon_monthly").select("*").execute().data or []
    return [{
        "month":         m.get("month", ""),
        "co2_before_kg": m.get("co2_before", 0),
        "co2_after_kg":  m.get("co2_after", 0),
        "savings_kg":    m.get("savings", 0),
    } for m in monthly]
