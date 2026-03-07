"""
Seed sample truck corridors for testing corridor-based consolidation.
Run this script to populate the database with example corridors.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from models.supabase_client import get_supabase
from datetime import datetime

def seed_corridors():
    """Seed sample corridors."""
    sb = get_supabase()
    
    # Sample corridors based on common Indian logistics routes
    corridors = [
        {
            "truck_name": "Mumbai-Solapur Express",
            "capacity_kg": 12000,
            "operating_days": ["Monday", "Wednesday", "Friday"],
            "start_location": "Mumbai",
            "corridor": ["Mumbai", "Pune", "Baramati", "Solapur"],
            "corridor_coords": [
                {"lat": 19.0760, "lng": 72.8777},  # Mumbai
                {"lat": 18.5204, "lng": 73.8567},  # Pune
                {"lat": 18.1517, "lng": 74.5769},  # Baramati
                {"lat": 17.6599, "lng": 75.9064},  # Solapur
            ],
            "is_active": True,
        },
        {
            "truck_name": "Delhi-Mumbai Freight",
            "capacity_kg": 15000,
            "operating_days": ["Tuesday", "Thursday", "Saturday"],
            "start_location": "Delhi",
            "corridor": ["Delhi", "Jaipur", "Ahmedabad", "Mumbai"],
            "corridor_coords": [
                {"lat": 28.6139, "lng": 77.2090},  # Delhi
                {"lat": 26.9124, "lng": 75.7873},  # Jaipur
                {"lat": 23.0225, "lng": 72.5714},  # Ahmedabad
                {"lat": 19.0760, "lng": 72.8777},  # Mumbai
            ],
            "is_active": True,
        },
        {
            "truck_name": "Bangalore-Chennai Route",
            "capacity_kg": 10000,
            "operating_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "start_location": "Bangalore",
            "corridor": ["Bangalore", "Hosur", "Vellore", "Chennai"],
            "corridor_coords": [
                {"lat": 12.9716, "lng": 77.5946},  # Bangalore
                {"lat": 12.7400, "lng": 77.8300},  # Hosur
                {"lat": 12.9166, "lng": 79.1333},  # Vellore
                {"lat": 13.0827, "lng": 80.2707},  # Chennai
            ],
            "is_active": True,
        },
        {
            "truck_name": "Pune-Nashik Highway",
            "capacity_kg": 8000,
            "operating_days": ["Monday", "Wednesday", "Friday", "Sunday"],
            "start_location": "Pune",
            "corridor": ["Pune", "Nashik"],
            "corridor_coords": [
                {"lat": 18.5204, "lng": 73.8567},  # Pune
                {"lat": 19.9975, "lng": 73.7898},  # Nashik
            ],
            "is_active": True,
        },
    ]
    
    print("🌱 Seeding corridors...")
    inserted = 0
    
    for corridor in corridors:
        try:
            result = sb.table("truck_corridors").insert(corridor).execute()
            if result.data:
                inserted += 1
                print(f"  ✓ Added: {corridor['truck_name']}")
        except Exception as e:
            print(f"  ✗ Failed to add {corridor['truck_name']}: {e}")
    
    print(f"\n✅ Seeded {inserted} corridors successfully!")
    return inserted


if __name__ == "__main__":
    seed_corridors()
