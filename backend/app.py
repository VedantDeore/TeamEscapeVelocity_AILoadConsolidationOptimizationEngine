"""
Lorri - AI Load Consolidation Optimization Engine
Flask Application Entry Point
"""

from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "ok", "service": "lorri-backend"}


if __name__ == "__main__":
    app.run(debug=True, port=5000)
