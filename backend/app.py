"""
Lorri - AI Load Consolidation Optimization Engine
Flask Application Entry Point
"""

from flask import Flask
from flask_cors import CORS

from routes.shipments import shipments_bp
from routes.consolidation import consolidation_bp
from routes.routing import routing_bp
from routes.packing import packing_bp
from routes.simulation import simulation_bp
from routes.copilot import copilot_bp
from routes.analytics import analytics_bp
from routes.reports import reports_bp
from routes.settings import settings_bp

app = Flask(__name__)
CORS(app)

# Register all route blueprints
app.register_blueprint(shipments_bp)
app.register_blueprint(consolidation_bp)
app.register_blueprint(routing_bp)
app.register_blueprint(packing_bp)
app.register_blueprint(simulation_bp)
app.register_blueprint(copilot_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(settings_bp)


@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "ok", "service": "lorri-backend"}


if __name__ == "__main__":
    app.run(debug=True, port=5000)
