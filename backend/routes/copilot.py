"""AI co-pilot chat routes."""

from flask import Blueprint, request, jsonify
from models.supabase_client import get_supabase

copilot_bp = Blueprint("copilot", __name__)


@copilot_bp.route("/api/copilot/chat", methods=["POST"])
def chat():
    sb = get_supabase()
    data = request.get_json()
    user_message = data.get("message", "")
    session_id = data.get("session_id", "default")

    # Save user message
    sb.table("chat_messages").insert({
        "role": "user",
        "content": user_message,
        "timestamp": data.get("timestamp", ""),
        "session_id": session_id,
    }).execute()

    # Placeholder AI response (to be replaced with Groq/HF)
    response_text = "I'm analyzing your request. This feature will be connected to the AI engine soon. For now, I can show you the current consolidation data."

    # Save assistant message
    result = sb.table("chat_messages").insert({
        "role": "assistant",
        "content": response_text,
        "timestamp": "",
        "session_id": session_id,
    }).execute()

    return jsonify(result.data[0])


@copilot_bp.route("/api/copilot/history", methods=["GET"])
def chat_history():
    sb = get_supabase()
    session_id = request.args.get("session_id", "default")
    result = sb.table("chat_messages").select("*").eq("session_id", session_id).order("created_at").execute()
    return jsonify(result.data)


@copilot_bp.route("/api/copilot/suggestions", methods=["GET"])
def suggestions():
    prompts = [
        "Which Mumbai shipments can be merged tomorrow?",
        "Show me routes with less than 60% utilization",
        "What's the best vehicle for the Pune cluster?",
        "What if I add 5 more shipments to cluster 3?",
        "Generate a consolidation report for today",
        "How much CO₂ can we save this week?",
    ]
    return jsonify(prompts)
