"""
Lorri — Agentic AI Co-Pilot Service

Pipeline:
  1. Classify user intent using Groq LLM (fast, free-tier)
  2. Route intent to the appropriate backend tool
  3. Return structured response: {content, data, actions}

Intents:
  consolidation_query  → cluster current pending shipments
  route_query          → get route optimisation results
  analytics_query      → query KPIs / utilization data
  what_if              → run scenario simulation
  general              → conversational response with logistics context
"""

import json
import re
import os

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

from config import GROQ_API_KEY, GROQ_MODEL

# ── system prompt ──────────────────────────────────────────

SYSTEM_PROMPT = """You are Lorri, an expert AI logistics co-pilot for an AI Load Consolidation Optimization Engine.

Your role is to help logistics managers make smarter decisions about:
- Shipment consolidation (grouping shipments to reduce trips)
- Vehicle capacity optimization (3D bin packing)
- Route optimization (shortest, most efficient routes)
- Carbon emissions reduction (sustainability / ESG)
- Cost savings analysis

You have access to real-time data from the Lorri platform.

When answering queries:
1. Be concise and data-driven
2. Always mention specific numbers (cost savings, CO₂ reduction, utilization %)
3. Suggest actionable next steps
4. Use Indian logistics context (₹ for currency, Indian cities)

Classify the user's intent as one of:
  - consolidation_query: questions about shipment grouping, clusters, merging
  - route_query: questions about routes, distances, stops, directions
  - analytics_query: questions about KPIs, utilization, cost trends
  - what_if: hypothetical scenarios ("what if I add X shipments...")
  - general: greetings, how-to questions, or anything else

Classify the user's intent as one of:
  - shipment_query: questions about pending shipments, shipment count, shipment status

Use ONLY these action IDs in your response:
  - view_shipments: show pending shipments preview
  - run_consolidation: run the consolidation engine
  - view_route_map: show route map
  - view_packing: open 3D packing view
  - view_carbon: open carbon impact page
  - view_dashboard: open analytics dashboard
  - view_simulate: open scenario simulator
  - view_reports: open reports page

ALWAYS respond in valid JSON with this structure:
{
  "intent": "<one of the intents above>",
  "content": "<your natural language answer, 2-4 sentences>",
  "data": null,
  "actions": [
    {"label": "<button label>", "action": "<action_id from list above>"}
  ],
  "proactive_tip": "<optional: a 1-line proactive insight or null>"
}
"""

# ── intent regex fallback (if Groq is unavailable) ─────────

INTENT_PATTERNS = {
    "shipment_query": [
        r"shipment", r"pending", r"how many", r"remaining",
        r"status", r"awaiting", r"unprocessed", r"left",
    ],
    "consolidation_query": [
        r"consolidat", r"merg", r"cluster", r"group", r"combine",
        r"shipment.*(together|together)", r"how many (clusters|groups)",
        r"run.*engine", r"optimiz",
    ],
    "route_query": [
        r"route", r"distance", r"km|kilomet", r"path", r"stop",
        r"direction", r"drive", r"travel", r"map",
    ],
    "analytics_query": [
        r"utiliz", r"KPI", r"saving", r"cost", r"trend",
        r"percentage", r"rate", r"dashboard",
    ],
    "what_if": [
        r"what if", r"if i add", r"simulate", r"scenario", r"suppose",
        r"hypothetical", r"what would happen",
    ],
}


def _classify_intent_regex(message: str) -> str:
    """Fallback intent classifier using keyword matching."""
    msg_lower = message.lower()
    for intent, patterns in INTENT_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, msg_lower):
                return intent
    return "general"


def _rule_based_response(intent: str, message: str, context: dict) -> dict:
    """Fallback responses when Groq is unavailable."""
    pending = context.get("pending_shipments", 0)
    cost_savings = context.get("cost_savings", 140000)
    co2_saved = context.get("co2_saved", 800)
    avg_util = context.get("avg_utilization", 0)
    total_clusters = context.get("total_clusters", 0)

    if intent == "shipment_query":
        return {
            "intent": intent,
            "content": (
                f"There {'is' if pending == 1 else 'are'} currently **{pending}** pending "
                f"shipment{'s' if pending != 1 else ''} in the system"
                + (f", with an average utilization of {avg_util}% and a total of "
                   f"{total_clusters} cluster{'s' if total_clusters != 1 else ''}. "
                   f"This has resulted in cost savings of ₹{cost_savings:,.0f} "
                   f"and a reduction of {co2_saved} kg in CO₂ emissions."
                   if total_clusters > 0
                   else ". Ready to consolidate them!")
            ),
            "data": {"pending": pending},
            "actions": [
                {"label": "📊 View Shipments", "action": "view_shipments"},
                {"label": "⚡ Run Consolidation", "action": "run_consolidation"},
            ],
            "proactive_tip": (
                f"💡 You have {pending} pending shipments — click View Shipments to preview them!"
                if pending > 0 else None
            ),
        }

    elif intent == "consolidation_query":
        clusters_possible = max(pending // 5, 1)
        return {
            "intent": intent,
            "content": (
                f"Based on current data, I can identify approximately {clusters_possible} optimal clusters "
                f"from {pending} pending shipments. Consolidating these could reduce trips by ~34% and "
                f"save ₹{cost_savings:,.0f} in logistics costs."
            ),
            "data": {"pending": pending, "estimated_clusters": clusters_possible},
            "actions": [
                {"label": "⚡ Run Consolidation Engine", "action": "run_consolidation"},
                {"label": "📊 View Shipments", "action": "view_shipments"},
            ],
            "proactive_tip": "Tip: Prioritise critical shipments first when reviewing clusters.",
        }

    elif intent == "route_query":
        return {
            "intent": intent,
            "content": (
                "The latest optimised routes show an average reduction of 22% in total distance "
                "compared to unoptimised routes. Your most efficient corridor is currently "
                "Mumbai → Pune → Hyderabad → Bangalore."
            ),
            "data": None,
            "actions": [
                {"label": "🗺️ View Route Map", "action": "view_route_map"},
            ],
            "proactive_tip": None,
        }

    elif intent == "analytics_query":
        return {
            "intent": intent,
            "content": (
                f"Current platform performance: vehicle utilization at {avg_util}% "
                f"(▲ vs baseline), cost savings of ₹{cost_savings:,.0f}, and "
                f"{co2_saved} kg CO₂ reduced. "
                f"Consolidation rate is excellent for fleet optimization."
            ),
            "data": {"utilization": avg_util, "cost_savings": cost_savings, "co2_saved": co2_saved},
            "actions": [
                {"label": "📊 View Dashboard", "action": "view_dashboard"},
                {"label": "🌱 Carbon Impact", "action": "view_carbon"},
            ],
            "proactive_tip": "Your green score is excellent — consider sharing this in your ESG report.",
        }

    elif intent == "what_if":
        return {
            "intent": intent,
            "content": (
                "I can run a scenario simulation to compare different consolidation strategies. "
                "The Scenario Simulator lets you compare No Consolidation vs AI Optimised vs Custom configurations."
            ),
            "data": None,
            "actions": [
                {"label": "🧪 Open Scenario Simulator", "action": "view_simulate"},
            ],
            "proactive_tip": None,
        }

    else:
        return {
            "intent": "general",
            "content": (
                "👋 I'm Lorri, your AI logistics co-pilot. I can help you consolidate shipments, "
                "optimise routes, analyse carbon impact, and generate reports. "
                "What would you like to explore first?"
            ),
            "data": None,
            "actions": [
                {"label": "📊 View Shipments", "action": "view_shipments"},
                {"label": "⚡ Run Consolidation", "action": "run_consolidation"},
            ],
            "proactive_tip": (
                f"💡 You have {pending} pending shipments — ready for optimisation!"
                if pending > 0 else None
            ),
        }


# ── Groq API call ──────────────────────────────────────────

def _call_groq(message: str, context: dict) -> dict | None:
    """Call Groq LLM and parse the JSON response."""
    if not GROQ_AVAILABLE or not GROQ_API_KEY:
        return None

    try:
        client = Groq(api_key=GROQ_API_KEY)

        # Build context block
        ctx_block = (
            f"Current platform context:\n"
            f"- Pending shipments: {context.get('pending_shipments', 0)}\n"
            f"- Latest plan: {context.get('plan_name', 'N/A')}\n"
            f"- Total clusters: {context.get('total_clusters', 0)}\n"
            f"- Avg utilization: {context.get('avg_utilization', 0)}%\n"
            f"- Cost savings: ₹{context.get('cost_savings', 0):,.0f}\n"
            f"- CO₂ saved: {context.get('co2_saved', 0)} kg\n"
        )

        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": f"{ctx_block}\n\nUser query: {message}"},
            ],
            temperature=0.4,
            max_tokens=600,
            response_format={"type": "json_object"},
        )

        raw = completion.choices[0].message.content.strip()
        return json.loads(raw)

    except Exception as e:
        print(f"[agent] Groq error: {e}")
        return None


# ── public entry point ─────────────────────────────────────

def process_query(message: str, context: dict | None = None) -> dict:
    """
    Process a natural language query and return a structured AI response.

    Args:
        message: user's natural language message
        context: dict with current platform KPIs

    Returns:
        {
          "intent":         str,
          "content":        str,   # main text response
          "data":           any,   # optional structured data
          "actions":        list,  # [{label, action}]
          "proactive_tip":  str | None,
        }
    """
    ctx = context or {}

    # 1. Try Groq LLM
    result = _call_groq(message, ctx)

    # 2. Fallback to rule-based
    if result is None:
        intent = _classify_intent_regex(message)
        result = _rule_based_response(intent, message, ctx)

    # Ensure required fields
    result.setdefault("intent",        "general")
    result.setdefault("content",       "I'm here to help with your logistics queries.")
    result.setdefault("data",          None)
    result.setdefault("actions",       [])
    result.setdefault("proactive_tip", None)

    return result


def get_proactive_suggestions(pending_shipments: list) -> list[str]:
    """
    Analyse pending shipments and return proactive alert messages.
    """
    suggestions = []

    if not pending_shipments:
        return suggestions

    # Group by destination city
    dest_groups: dict[str, list] = {}
    for s in pending_shipments:
        city = s.get("dest_city", "Unknown")
        dest_groups.setdefault(city, []).append(s)

    for city, shipments in dest_groups.items():
        if len(shipments) >= 4:
            total_weight = sum(s.get("weight_kg", 0) for s in shipments)
            total_cost_saved = len(shipments) * 8000   # estimated
            suggestions.append(
                f"💡 {len(shipments)} shipments are heading to {city} — "
                f"consolidating them could save ₹{total_cost_saved:,}"
            )

    # High utilization potential
    total = len(pending_shipments)
    if total >= 20:
        suggestions.append(
            f"🚀 {total} shipments are pending optimisation. "
            f"Running consolidation now could reduce trips by ~30%."
        )

    return suggestions[:5]   # max 5 proactive tips
