"""Report generation routes."""

from flask import Blueprint, jsonify
from models.supabase_client import get_supabase

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("/api/reports", methods=["GET"])
def list_reports():
    sb = get_supabase()
    result = sb.table("reports").select("*").execute()
    return jsonify(result.data)


@reports_bp.route("/api/reports/<report_type>", methods=["GET"])
def get_report(report_type):
    sb = get_supabase()
    result = sb.table("reports").select("*").eq("type", report_type).execute()
    return jsonify(result.data)
