"""
Lorri — Dynamic Route Detection and Consolidation Engine

Automatically detects route patterns from shipments and consolidates them dynamically.
Works for ANY cities/locations across India without requiring predefined corridors.

Algorithm:
1. Group shipments by route similarity (origin→destination pairs)
2. Build dynamic routes by finding common paths
3. Consolidate shipments along detected routes
4. Use vehicles from database dynamically based on capacity
"""

from geopy.distance import geodesic
from typing import List, Dict, Tuple, Optional, Set
from collections import defaultdict


def detect_dynamic_routes(shipments: List[Dict]) -> Dict[str, List[Dict]]:
    """
    Detect route patterns from shipments and group them by route similarity.
    
    Args:
        shipments: List of shipment dicts with origin_city, dest_city, origin_lat, origin_lng, dest_lat, dest_lng
    
    Returns:
        Dict mapping route_key -> list of shipments on that route
        route_key format: "origin_city|dest_city" or "origin_city|intermediate|dest_city"
    """
    if not shipments:
        return {}
    
    # Group shipments by direct route (origin → destination)
    route_groups: Dict[str, List[Dict]] = defaultdict(list)
    
    for shipment in shipments:
        origin = shipment.get("origin_city", "").strip().lower()
        dest = shipment.get("dest_city", "").strip().lower()
        
        if not origin or not dest:
            continue
        
        # Create route key: origin|dest
        route_key = f"{origin}|{dest}"
        route_groups[route_key].append(shipment)
    
    # Now detect if shipments can share routes through intermediate cities
    # Example: Mumbai→Solapur and Mumbai→Pune→Baramati→Solapur can share route
    merged_routes = _merge_compatible_routes(route_groups, shipments)
    
    return merged_routes


def _merge_compatible_routes(
    route_groups: Dict[str, List[Dict]],
    all_shipments: List[Dict]
) -> Dict[str, List[Dict]]:
    """
    Merge routes that can share the same path.
    
    Example:
    - Route A: Mumbai → Solapur
    - Route B: Mumbai → Pune → Solapur
    - Route C: Pune → Baramati → Solapur
    
    All can share route: Mumbai → Pune → Baramati → Solapur
    """
    merged: Dict[str, List[Dict]] = {}
    processed_routes: Set[str] = set()
    
    # Build city graph: which cities connect to which
    city_graph: Dict[str, Set[str]] = defaultdict(set)
    for shipment in all_shipments:
        origin = shipment.get("origin_city", "").strip().lower()
        dest = shipment.get("dest_city", "").strip().lower()
        if origin and dest:
            city_graph[origin].add(dest)
    
    # Find routes that can be merged
    for route_key, shipments in route_groups.items():
        if route_key in processed_routes:
            continue
        
        origin, dest = route_key.split("|")
        
        # Find all shipments that can share this route
        compatible_shipments = list(shipments)
        
        # Check for intermediate routes that connect
        # Example: If we have Mumbai→Solapur, also include Mumbai→Pune if Pune→Solapur exists
        for other_key, other_shipments in route_groups.items():
            if other_key == route_key or other_key in processed_routes:
                continue
            
            other_origin, other_dest = other_key.split("|")
            
            # Check if routes can be merged
            if _can_merge_routes(origin, dest, other_origin, other_dest, city_graph):
                compatible_shipments.extend(other_shipments)
                processed_routes.add(other_key)
        
        # Create merged route
        merged[route_key] = compatible_shipments
        processed_routes.add(route_key)
    
    return merged


def _can_merge_routes(
    origin1: str, dest1: str,
    origin2: str, dest2: str,
    city_graph: Dict[str, Set[str]]
) -> bool:
    """
    Check if two routes can be merged into one.
    
    Routes can merge if:
    1. Same origin and one destination is intermediate to the other
    2. One route is a sub-path of the other
    3. Routes share intermediate cities
    """
    # Case 1: Same origin, one dest is intermediate
    if origin1 == origin2:
        # Check if dest1 → dest2 or dest2 → dest1 path exists
        if dest1 in city_graph.get(dest2, set()) or dest2 in city_graph.get(dest1, set()):
            return True
    
    # Case 2: One route is sub-path of another
    # origin1 → dest1 is part of origin2 → dest2
    if origin1 == origin2 and _is_path_between(dest1, dest2, city_graph):
        return True
    
    # Case 3: Routes share intermediate connection
    # origin1 → dest1 and origin2 → dest2, but origin1 → origin2 → dest1 → dest2 exists
    if origin1 != origin2 and dest1 != dest2:
        # Check if they form a continuous path
        if origin2 in city_graph.get(origin1, set()) and dest1 in city_graph.get(origin2, set()):
            return True
    
    return False


def _is_path_between(start: str, end: str, city_graph: Dict[str, Set[str]], max_depth: int = 3) -> bool:
    """Check if there's a path between two cities (BFS with depth limit)."""
    if start == end:
        return True
    
    visited = set()
    queue = [(start, 0)]
    
    while queue:
        current, depth = queue.pop(0)
        if depth > max_depth:
            continue
        
        if current == end:
            return True
        
        visited.add(current)
        for neighbor in city_graph.get(current, set()):
            if neighbor not in visited:
                queue.append((neighbor, depth + 1))
    
    return False


def build_dynamic_route(shipments: List[Dict]) -> Dict:
    """
    Build a dynamic route from a list of shipments.
    Orders cities by geographic proximity to create optimal route.
    
    Args:
        shipments: List of shipments to consolidate
    
    Returns:
        Route dict with ordered cities and coordinates
    """
    if not shipments:
        return {"cities": [], "coords": []}
    
    # Collect all unique cities (origins and destinations)
    city_map: Dict[str, Dict] = {}
    
    for shipment in shipments:
        origin = shipment.get("origin_city", "").strip()
        dest = shipment.get("dest_city", "").strip()
        
        origin_lat = shipment.get("origin_lat")
        origin_lng = shipment.get("origin_lng")
        dest_lat = shipment.get("dest_lat")
        dest_lng = shipment.get("dest_lng")
        
        if origin and origin_lat and origin_lng:
            city_map[origin.lower()] = {
                "name": origin,
                "lat": origin_lat,
                "lng": origin_lng,
                "type": "origin"
            }
        
        if dest and dest_lat and dest_lng:
            city_map[dest.lower()] = {
                "name": dest,
                "lat": dest_lat,
                "lng": dest_lng,
                "type": "destination"
            }
    
    # Order cities by geographic proximity (nearest neighbor)
    ordered_cities = []
    ordered_coords = []
    
    if not city_map:
        return {"cities": [], "coords": []}
    
    # Start with the westernmost/northernmost city (or first origin)
    remaining = list(city_map.values())
    current = remaining[0]
    ordered_cities.append(current["name"])
    ordered_coords.append({"lat": current["lat"], "lng": current["lng"]})
    remaining.remove(current)
    
    # Greedily add nearest unvisited city
    while remaining:
        nearest = None
        min_dist = float('inf')
        
        for city in remaining:
            dist = geodesic(
                (current["lat"], current["lng"]),
                (city["lat"], city["lng"])
            ).km
            
            if dist < min_dist:
                min_dist = dist
                nearest = city
        
        if nearest:
            ordered_cities.append(nearest["name"])
            ordered_coords.append({"lat": nearest["lat"], "lng": nearest["lng"]})
            remaining.remove(nearest)
            current = nearest
    
    return {
        "cities": ordered_cities,
        "coords": ordered_coords
    }


def consolidate_dynamic_routes(
    route_groups: Dict[str, List[Dict]],
    vehicles: List[Dict]
) -> List[Dict]:
    """
    Consolidate shipments along detected routes using vehicles from database.
    
    Args:
        route_groups: Dict mapping route_key -> list of shipments
        vehicles: List of available vehicles from database
    
    Returns:
        List of cluster dicts ready for consolidation plan
    """
    if not vehicles:
        # Fallback to default vehicle if none available
        vehicles = [{
            "id": None,
            "name": "Default Truck",
            "max_weight_kg": 12000,
            "max_volume_m3": 42,
            "cost_per_km": 24
        }]
    
    clusters = []
    
    for route_key, shipments in route_groups.items():
        if not shipments:
            continue
        
        # Build dynamic route
        route = build_dynamic_route(shipments)
        
        # Sort vehicles by capacity (smallest first for better utilization)
        sorted_vehicles = sorted(vehicles, key=lambda v: v.get("max_weight_kg", 0))
        
        # Bin-pack shipments into vehicles
        sorted_shipments = sorted(shipments, key=lambda s: s.get("weight_kg", 0), reverse=True)
        
        current_cluster = []
        current_weight = 0.0
        current_volume = 0.0
        selected_vehicle = None
        
        for shipment in sorted_shipments:
            weight = shipment.get("weight_kg", 0)
            volume = shipment.get("volume_m3", 0)
            
            # Find smallest vehicle that can fit this shipment
            vehicle = None
            for v in sorted_vehicles:
                if v.get("max_weight_kg", 0) >= weight and v.get("max_volume_m3", 0) >= volume:
                    vehicle = v
                    break
            
            if not vehicle:
                # Use largest vehicle as fallback
                vehicle = sorted_vehicles[-1]
            
            # Check if current cluster can accommodate this shipment
            if (selected_vehicle and 
                current_weight + weight <= selected_vehicle.get("max_weight_kg", 0) and
                current_volume + volume <= selected_vehicle.get("max_volume_m3", 0)):
                # Add to current cluster
                current_cluster.append(shipment)
                current_weight += weight
                current_volume += volume
            else:
                # Save current cluster if it has shipments
                if current_cluster:
                    clusters.append(_create_cluster(
                        current_cluster,
                        selected_vehicle,
                        route,
                        current_weight,
                        current_volume
                    ))
                
                # Start new cluster
                current_cluster = [shipment]
                current_weight = weight
                current_volume = volume
                selected_vehicle = vehicle
        
        # Add last cluster
        if current_cluster:
            clusters.append(_create_cluster(
                current_cluster,
                selected_vehicle or sorted_vehicles[0],
                route,
                current_weight,
                current_volume
            ))
    
    return clusters


def _create_cluster(
    shipments: List[Dict],
    vehicle: Dict,
    route: Dict,
    total_weight: float,
    total_volume: float
) -> Dict:
    """Create a cluster dict from shipments, vehicle, and route."""
    max_weight = vehicle.get("max_weight_kg", 12000)
    max_volume = vehicle.get("max_volume_m3", 42)
    
    weight_util = (total_weight / max_weight * 100) if max_weight > 0 else 0
    volume_util = (total_volume / max_volume * 100) if max_volume > 0 else 0
    utilization_pct = round(max(weight_util, volume_util), 1)
    
    # Calculate route distance
    coords = route.get("coords", [])
    total_km = 0.0
    for i in range(len(coords) - 1):
        km = geodesic(
            (coords[i]["lat"], coords[i]["lng"]),
            (coords[i + 1]["lat"], coords[i + 1]["lng"])
        ).km
        total_km += km
    
    # Estimate cost
    cost_per_km = vehicle.get("cost_per_km", 24)
    estimated_cost = round(total_km * cost_per_km, 2)
    
    return {
        "shipment_ids": [s.get("id") for s in shipments if s.get("id")],
        "shipments": shipments,
        "vehicle_id": vehicle.get("id"),
        "vehicle_name": vehicle.get("name", "Unknown Truck"),
        "vehicle_type": vehicle.get("type", "Heavy Truck"),
        "total_weight": round(total_weight, 2),
        "total_volume": round(total_volume, 3),
        "utilization_pct": utilization_pct,
        "route_distance_km": round(total_km, 2),
        "estimated_cost": estimated_cost,
        "route_cities": route.get("cities", []),
        "route_coords": route.get("coords", []),
    }
