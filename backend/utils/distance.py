"""
Lightweight geodesic distance calculation using the Haversine formula.
Drop-in replacement for geopy.distance.geodesic to avoid the slow geopy
import on Windows.
"""

import math

_EARTH_RADIUS_KM = 6371.0


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return _EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(a))


class _Distance:
    """Mimics the geopy Distance object so callers can use .km and .meters."""

    def __init__(self, km: float):
        self.km = km
        self.kilometers = km
        self.meters = km * 1000
        self.m = self.meters
        self.miles = km * 0.621371

    def __float__(self):
        return self.km

    def __repr__(self):
        return f"Distance({self.km:.4f} km)"


def geodesic(point1, point2) -> _Distance:
    """
    Calculate geodesic distance between two (lat, lng) tuples.
    Compatible with geopy.distance.geodesic usage.
    """
    lat1, lon1 = float(point1[0]), float(point1[1])
    lat2, lon2 = float(point2[0]), float(point2[1])
    return _Distance(_haversine(lat1, lon1, lat2, lon2))
