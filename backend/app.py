"""
Lorri - AI Load Consolidation Optimization Engine
Flask Application Entry Point
"""

import os
import sys
from flask import Flask, jsonify
from flask_cors import CORS

# Ensure backend directory is in sys.path for relative imports
sys.path.insert(0, os.path.dirname(__file__))

from routes.shipments    import shipments_bp
from routes.consolidation import consolidation_bp
from routes.routing      import routing_bp
from routes.packing      import packing_bp
from routes.simulation   import simulation_bp
from routes.copilot      import copilot_bp
from routes.analytics    import analytics_bp
from routes.reports      import reports_bp
from routes.settings     import settings_bp
from routes.corridor     import corridor_bp
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = Flask(__name__)

# CORS: allow configured origins (falls back to allow-all for development)
allowed_origins = os.environ.get("CORS_ORIGINS", "*")
if allowed_origins != "*":
    allowed_origins = [o.strip() for o in allowed_origins.split(",")]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

# Register all blueprints
app.register_blueprint(shipments_bp)
app.register_blueprint(consolidation_bp)
app.register_blueprint(routing_bp)
app.register_blueprint(packing_bp)
app.register_blueprint(simulation_bp)
app.register_blueprint(copilot_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(corridor_bp)


@app.route("/api/health", methods=["GET"])
def health():
    """Health check — also shows which integrations are active."""
    from config import SUPABASE_URL, GROQ_API_KEY

    checks = {
        "supabase_configured": bool(SUPABASE_URL),
        "groq_configured":     bool(GROQ_API_KEY),
    }

    # Quick Supabase connectivity check
    try:
        from models.supabase_client import get_supabase
        sb = get_supabase()
        sb.table("shipments").select("id").limit(1).execute()
        checks["supabase_connected"] = True
    except Exception:
        checks["supabase_connected"] = False

    return jsonify({
        "status":  "ok",
        "service": "lorri-backend",
        "version": "1.0.0",
        "checks":  checks,
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found", "hint": "Check /api/health for available routes"}), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error", "detail": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV", "development") == "development"
    print(f"Lorri backend starting on port {port}")
    app.run(debug=debug, port=port, host="0.0.0.0")
