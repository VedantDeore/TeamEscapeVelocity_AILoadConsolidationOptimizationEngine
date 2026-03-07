"""
Lorri — Sample Data Generator
Generates 150 realistic Indian logistics shipments as a CSV.
Run: python utils/data_generator.py
"""

import csv
import random
import os
from datetime import datetime, timedelta, timezone

CITIES = [
    {"name": "Delhi",      "lat": 28.6139, "lng": 77.2090},
    {"name": "Mumbai",     "lat": 19.0760, "lng": 72.8777},
    {"name": "Chennai",    "lat": 13.0827, "lng": 80.2707},
    {"name": "Kolkata",    "lat": 22.5726, "lng": 88.3639},
    {"name": "Bangalore",  "lat": 12.9716, "lng": 77.5946},
    {"name": "Pune",       "lat": 18.5204, "lng": 73.8567},
    {"name": "Ahmedabad",  "lat": 23.0225, "lng": 72.5714},
    {"name": "Hyderabad",  "lat": 17.3850, "lng": 78.4867},
    {"name": "Jaipur",     "lat": 26.9124, "lng": 75.7873},
    {"name": "Lucknow",    "lat": 26.8467, "lng": 80.9462},
    {"name": "Kochi",      "lat": 9.9312,  "lng": 76.2673},
    {"name": "Nagpur",     "lat": 21.1458, "lng": 79.0882},
]

PRIORITIES  = ["normal", "normal", "normal", "express", "critical"]
CARGO_TYPES = ["general", "general", "fragile", "refrigerated", "hazardous"]

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "../../data/sample_shipments.csv")

FIELDNAMES = [
    "shipment_id", "origin_city", "origin_lat", "origin_lng",
    "dest_city", "dest_lat", "dest_lng",
    "weight_kg", "volume_m3", "length_cm", "width_cm", "height_cm",
    "delivery_start", "delivery_end", "priority", "cargo_type",
]


def generate(count: int = 150, seed: int = 42) -> list[dict]:
    random.seed(seed)
    now     = datetime.now(timezone.utc)
    records = []

    for i in range(count):
        origin = random.choice(CITIES)
        dest   = random.choice([c for c in CITIES if c["name"] != origin["name"]])
        weight = random.randint(50, 5000)
        length = random.randint(50, 300)
        width  = random.randint(40, 200)
        height = random.randint(30, 200)
        volume = round((length * width * height) / 1_000_000, 3)

        window_start = now + timedelta(hours=random.randint(1, 12))
        window_end   = window_start + timedelta(hours=random.randint(12, 48))

        records.append({
            "shipment_id":   f"SHP-{str(i+1).zfill(4)}",
            "origin_city":   origin["name"],
            "origin_lat":    round(origin["lat"] + (random.random() - 0.5) * 0.1, 6),
            "origin_lng":    round(origin["lng"] + (random.random() - 0.5) * 0.1, 6),
            "dest_city":     dest["name"],
            "dest_lat":      round(dest["lat"] + (random.random() - 0.5) * 0.1, 6),
            "dest_lng":      round(dest["lng"] + (random.random() - 0.5) * 0.1, 6),
            "weight_kg":     weight,
            "volume_m3":     volume,
            "length_cm":     length,
            "width_cm":      width,
            "height_cm":     height,
            "delivery_start": window_start.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
            "delivery_end":   window_end.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
            "priority":      random.choice(PRIORITIES),
            "cargo_type":    random.choice(CARGO_TYPES),
        })

    return records


def write_csv(records: list[dict], path: str = OUTPUT_PATH):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(records)
    print(f"Written {len(records)} records → {path}")


if __name__ == "__main__":
    records = generate(150)
    write_csv(records)
