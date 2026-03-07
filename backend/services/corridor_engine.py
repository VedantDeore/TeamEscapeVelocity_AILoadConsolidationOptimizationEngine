"""
Lorri — Corridor-Based Consolidation Engine

Matches shipments to fixed truck corridors and consolidates them efficiently.
This is more realistic for Indian logistics where trucks run on fixed routes.
"""

from geopy.distance import geodesic
from typing import List, Dict, Tuple, Optional


def match_shipments_to_corridors(
    shipments: List[Dict],
    corridors: List[Dict]
) -> Dict[str, List[Dict]]:
    """
    Match shipments to corridors based on origin and destination being on the corridor.
    
    Args:
        shipments: List of shipment dicts with origin_city, dest_city, origin_lat, origin_lng, dest_lat, dest_lng
        corridors: List of corridor dicts with corridor (list of city names), corridor_coords (list of {lat, lng})
    
    Returns:
        Dict mapping corridor_id -> list of matched shipments
    """
    matches: Dict[str, List[Dict]] = {}
    
    for corridor in corridors:
        if not corridor.get("is_active", True):
            continue
            
        corridor_id = corridor.get("id", "")
        corridor_stops = corridor.get("corridor", [])
        corridor_coords = corridor.get("corridor_coords", [])
        
        if not corridor_stops or not corridor_coords:
            continue
        
        matched = []
        
        for shipment in shipments:
            origin_city = shipment.get("origin_city", "").strip()
            dest_city = shipment.get("dest_city", "").strip()
            
            # Check if both origin and destination are on the corridor
            origin_idx = _find_city_in_corridor(origin_city, corridor_stops, corridor_coords)
            dest_idx = _find_city_in_corridor(dest_city, corridor_stops, corridor_coords)
            
            if origin_idx is not None and dest_idx is not None:
                # Origin must come before destination in corridor order
                if origin_idx < dest_idx:
                    matched.append({
                        **shipment,
                        "_origin_idx": origin_idx,
                        "_dest_idx": dest_idx,
                    })
        
        if matched:
            matches[corridor_id] = matched
    
    return matches


def _find_city_in_corridor(
    city_name: str,
    corridor_stops: List[str],
    corridor_coords: List[Dict]
) -> Optional[int]:
    """
    Find if a city is in the corridor, return its index.
    Uses fuzzy matching (case-insensitive, partial match).
    """
    city_lower = city_name.lower().strip()
    
    for idx, stop in enumerate(corridor_stops):
        stop_lower = stop.lower().strip()
        if city_lower == stop_lower or city_lower in stop_lower or stop_lower in city_lower:
            return idx
    
    # Also check coordinates if city name doesn't match exactly
    if not city_name:
        return None
    
    # Try to match by coordinates (would need shipment lat/lng, but for now use name matching)
    return None


def consolidate_corridor(
    corridor: Dict,
    matched_shipments: List[Dict],
    vehicle_capacity_kg: float
) -> List[Dict]:
    """
    Bin-pack shipments into the corridor's truck capacity using greedy approach.
    
    Args:
        corridor: Corridor dict with capacity_kg
        matched_shipments: List of shipments matched to this corridor
        vehicle_capacity_kg: Max weight capacity
    
    Returns:
        List of assignment dicts, each containing shipments that fit in one trip
    """
    if not matched_shipments:
        return []
    
    # Sort shipments by weight (largest first) for better packing
    sorted_shipments = sorted(matched_shipments, key=lambda s: s.get("weight_kg", 0), reverse=True)
    
    assignments = []
    current_trip = []
    current_weight = 0.0
    
    for shipment in sorted_shipments:
        weight = shipment.get("weight_kg", 0)
        
        if current_weight + weight <= vehicle_capacity_kg:
            current_trip.append(shipment)
            current_weight += weight
        else:
            # Current trip is full, start a new one
            if current_trip:
                assignments.append({
                    "shipments": current_trip,
                    "total_weight": current_weight,
                    "utilization_pct": round((current_weight / vehicle_capacity_kg) * 100, 1),
                })
            current_trip = [shipment]
            current_weight = weight
    
    # Add the last trip
    if current_trip:
        assignments.append({
            "shipments": current_trip,
            "total_weight": current_weight,
            "utilization_pct": round((current_weight / vehicle_capacity_kg) * 100, 1),
        })
    
    return assignments


def generate_route_plan(
    corridor: Dict,
    assigned_shipments: List[Dict]
) -> Dict:
    """
    Generate route plan following the corridor order.
    
    Args:
        corridor: Corridor dict with corridor (city names) and corridor_coords
        assigned_shipments: List of shipments assigned to this trip
    
    Returns:
        Route plan dict with stops, distance, cost, CO2
    """
    corridor_stops = corridor.get("corridor", [])
    corridor_coords = corridor.get("corridor_coords", [])
    
    if not corridor_stops or not corridor_coords:
        return {
            "stops": [],
            "total_distance_km": 0,
            "estimated_time": "0h 0m",
            "fuel_cost": 0,
        }
    
    # Build stops in corridor order with pickup/delivery info
    stops = []
    seen_cities = set()
    
    for idx, city_name in enumerate(corridor_stops):
        coord = corridor_coords[idx] if idx < len(corridor_coords) else {}
        lat = coord.get("lat", 0)
        lng = coord.get("lng", 0)
        
        # Find shipments to pickup at this city
        pickups = [
            s for s in assigned_shipments
            if s.get("_origin_idx") == idx
        ]
        
        # Find shipments to deliver at this city
        deliveries = [
            s for s in assigned_shipments
            if s.get("_dest_idx") == idx
        ]
        
        if pickups or deliveries or idx == 0:  # Include start location
            stop_type = "depot" if idx == 0 else ("pickup" if pickups else "delivery")
            if pickups and deliveries:
                stop_type = "pickup_delivery"
            
            stops.append({
                "lat": lat,
                "lng": lng,
                "city": city_name,
                "type": stop_type,
                "sequence": len(stops) + 1,
                "pickups": [s.get("shipment_code", "") for s in pickups],
                "deliveries": [s.get("shipment_code", "") for s in deliveries],
                "weight_to_pickup": sum(s.get("weight_kg", 0) for s in pickups),
                "weight_to_deliver": sum(s.get("weight_kg", 0) for s in deliveries),
            })
    
    # Calculate total distance along corridor
    total_km = 0.0
    for i in range(len(stops) - 1):
        km = geodesic(
            (stops[i]["lat"], stops[i]["lng"]),
            (stops[i + 1]["lat"], stops[i + 1]["lng"])
        ).km
        total_km += km
    
    # Estimate time (60 km/h average)
    total_hours = total_km / 60.0 if total_km > 0 else 0
    hours = int(total_hours)
    minutes = int((total_hours - hours) * 60)
    
    # Fuel cost (₹8.5/km average)
    fuel_cost = round(total_km * 8.5, 2)
    
    return {
        "stops": stops,
        "total_distance_km": round(total_km, 2),
        "estimated_time": f"{hours}h {minutes}m",
        "fuel_cost": fuel_cost,
    }
