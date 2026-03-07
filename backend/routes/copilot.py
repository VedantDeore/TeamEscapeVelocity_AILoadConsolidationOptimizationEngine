"""AI co-pilot chat routes — wired to Groq LLM agent."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase
from services.agent import process_query, get_proactive_suggestions
from datetime import datetime, timezone

copilot_bp = Blueprint("copilot", __name__)


def _build_context(sb) -> dict:
    """Collect current platform KPIs to inject into the agent prompt."""
    ctx = {}
    try:
        pending = sb.table("shipments").select("id", count="exact").eq("status", "pending").execute()
        ctx["pending_shipments"] = pending.count or 0
    except Exception:
        ctx["pending_shipments"] = 0

    try:
        plan = sb.table("consolidation_plans").select(
            "name, avg_utilization, total_cost_before, total_cost_after, co2_before, co2_after, trips_before, trips_after"
        ).order("created_at", desc=True).limit(1).execute()
        if plan.data:
            p = plan.data[0]
            ctx["plan_name"]       = p.get("name", "")
            ctx["total_clusters"]  = p.get("trips_after", 0)
            ctx["avg_utilization"] = p.get("avg_utilization", 0)
            ctx["cost_savings"]    = (p.get("total_cost_before", 0) or 0) - (p.get("total_cost_after", 0) or 0)
            ctx["co2_saved"]       = (p.get("co2_before", 0) or 0) - (p.get("co2_after", 0) or 0)
    except Exception:
        pass

    return ctx


@copilot_bp.route("/api/copilot/chat", methods=["POST"])
def chat():
    sb   = get_supabase()
    data = request.get_json(silent=True) or {}

    user_message = data.get("message", "").strip()
    session_id   = data.get("session_id", "default")

    if not user_message:
        return jsonify({"error": "message is required"}), 400

    # Save user message
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        sb.table("chat_messages").insert({
            "role":       "user",
            "content":    user_message,
            "timestamp":  datetime.now(timezone.utc).strftime("%I:%M %p"),
            "session_id": session_id,
        }).execute()
    except Exception:
        pass

    # Build context and call agent
    context  = _build_context(sb)
    response = process_query(user_message, context)

    # Save assistant response
    try:
        saved = sb.table("chat_messages").insert({
            "role":       "assistant",
            "content":    response["content"],
            "timestamp":  datetime.now(timezone.utc).strftime("%I:%M %p"),
            "actions":    response.get("actions", []),
            "session_id": session_id,
        }).execute()
        row = saved.data[0] if saved.data else {}
    except Exception:
        row = {}

    return jsonify({
        "id":             row.get("id", ""),
        "role":           "assistant",
        "content":        response["content"],
        "intent":         response.get("intent", "general"),
        "data":           response.get("data"),
        "actions":        response.get("actions", []),
        "proactive_tip":  response.get("proactive_tip"),
        "timestamp":      datetime.now(timezone.utc).strftime("%I:%M %p"),
    })


@copilot_bp.route("/api/copilot/save-message", methods=["POST"])
def save_message():
    """Save a single chat message (used by action handlers that bypass /chat)."""
    sb = get_supabase()
    data = request.get_json(silent=True) or {}
    role = data.get("role", "user")
    content = data.get("content", "")
    session_id = data.get("session_id", "default")
    actions = data.get("actions", [])

    if not content:
        return jsonify({"error": "content is required"}), 400

    try:
        saved = sb.table("chat_messages").insert({
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc).strftime("%I:%M %p"),
            "session_id": session_id,
            "actions": actions if actions else None,
        }).execute()
        row = saved.data[0] if saved.data else {}
        return jsonify({"id": row.get("id", ""), "ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@copilot_bp.route("/api/copilot/history", methods=["GET"])
def chat_history():
    sb         = get_supabase()
    session_id = request.args.get("session_id", "default")
    limit      = int(request.args.get("limit", 50))
    result     = sb.table("chat_messages").select("*").eq("session_id", session_id).order("created_at").limit(limit).execute()
    return jsonify(result.data)


@copilot_bp.route("/api/copilot/suggestions", methods=["GET"])
def suggestions():
    """Return quick-access prompt chips + proactive alerts."""
    sb = get_supabase()

    # Proactive alerts from pending shipments
    try:
        pending_result = sb.table("shipments").select("*").eq("status", "pending").limit(100).execute()
        alerts = get_proactive_suggestions(pending_result.data or [])
    except Exception:
        alerts = []

    prompts = [
        "Which Mumbai shipments can be merged tomorrow?",
        "Show me routes with less than 60% utilization",
        "What's the best vehicle for the Pune cluster?",
        "What if I add 5 more shipments to cluster 3?",
        "Generate a consolidation report for today",
        "How much CO₂ can we save this week?",
        "Which routes are underutilized right now?",
        "Compare AI optimised vs no consolidation",
    ]

    return jsonify({
        "prompts": prompts,
        "alerts":  alerts,
    })
