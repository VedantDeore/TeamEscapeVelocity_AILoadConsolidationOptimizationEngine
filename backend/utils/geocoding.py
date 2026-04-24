"""
Lorri — Geocoding utility using Nominatim (OpenStreetMap).
Rate-limited to ~1 req/sec per Nominatim ToS.
Results are cached in-memory to avoid duplicate calls.

geopy is imported lazily to avoid blocking server startup (its SSL
certificate resolution can hang on Windows).
"""

import time
import threading

_geolocator = None
_cache: dict[str, dict | None] = {}
_lock  = threading.Lock()
_last_call = 0.0


def _get_geolocator():
    global _geolocator
    if _geolocator is None:
        from geopy.geocoders import Nominatim
        _geolocator = Nominatim(user_agent="lorri-logistics-ai/1.0")
    return _geolocator


def geocode(address: str) -> dict | None:
    """
    Convert an address string to {lat, lng, display_name}.
    Returns None if geocoding fails.
    """
    global _last_call
    from geopy.exc import GeocoderTimedOut, GeocoderServiceError

    key = address.strip().lower()
    if key in _cache:
        return _cache[key]

    # Rate-limit to 1 req/sec
    with _lock:
        elapsed = time.time() - _last_call
        if elapsed < 1.1:
            time.sleep(1.1 - elapsed)

        try:
            location = _get_geolocator().geocode(address, timeout=5)
            _last_call = time.time()
        except (GeocoderTimedOut, GeocoderServiceError):
            _cache[key] = None
            return None
        except Exception:
            _cache[key] = None
            return None

    if location:
        result = {
            "lat":          location.latitude,
            "lng":          location.longitude,
            "display_name": location.address,
        }
        _cache[key] = result
        return result

    _cache[key] = None
    return None


def batch_geocode(addresses: list[str]) -> list[dict | None]:
    """Geocode a list of addresses, returning results in order."""
    return [geocode(addr) for addr in addresses]
