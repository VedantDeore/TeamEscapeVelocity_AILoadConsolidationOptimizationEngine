"""Analytics and dashboard routes."""

from flask import Blueprint, jsonify
from models.supabase_client import get_supabase

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/api/analytics/dashboard", methods=["GET"])
def dashboard_kpis():
    sb = get_supabase()
    kpis = sb.table("dashboard_kpis").select("*").execute()
    trend = sb.table("utilization_trend").select("*").execute()
    activities = sb.table("activity_feed").select("*").order("created_at", desc=True).execute()
    return jsonify({
        "kpis": kpis.data,
        "utilization_trend": trend.data,
        "activity_feed": activities.data,
    })


@analytics_bp.route("/api/analytics/carbon", methods=["GET"])
def carbon_metrics():
    sb = get_supabase()
    monthly = sb.table("carbon_monthly").select("*").execute()
    breakdown = sb.table("carbon_breakdown").select("*").execute()
    return jsonify({
        "monthly": monthly.data,
        "breakdown": breakdown.data,
    })


@analytics_bp.route("/api/analytics/utilization", methods=["GET"])
def utilization_trend():
    sb = get_supabase()
    result = sb.table("utilization_trend").select("*").execute()
    return jsonify(result.data)
