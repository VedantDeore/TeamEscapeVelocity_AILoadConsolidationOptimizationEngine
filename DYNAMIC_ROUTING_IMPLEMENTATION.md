# Dynamic Routing Implementation

## Overview
Dynamic routing automatically detects route patterns from shipments and consolidates them without requiring predefined corridors. Works for ANY cities/locations across India.

## How It Works

1. **Route Detection**: Analyzes shipments to find route patterns
   - Groups shipments by origin→destination pairs
   - Detects if shipments can share routes through intermediate cities
   - Example: Mumbai→Solapur and Mumbai→Pune→Baramati→Solapur can share route

2. **Dynamic Route Building**: Creates optimal routes from shipments
   - Orders cities by geographic proximity
   - Handles any combination of cities
   - No need for predefined corridors

3. **Consolidation**: Uses vehicles from database dynamically
   - Fetches all available vehicles from settings
   - Selects smallest vehicle that fits the load
   - Respects weight and volume capacity

## API Endpoint

**POST** `/api/consolidate/dynamic`

Automatically detects routes and consolidates shipments for ANY cities in India.

### Request Body (optional):
```json
{
  "origin_city": "mumbai",  // optional filter
  "dest_city": "solapur"    // optional filter
}
```

### Response:
Same format as regular consolidation endpoint with clusters containing dynamically detected routes.

## Usage

The dynamic routing system:
- ✅ Works for ANY cities/locations in India
- ✅ Automatically detects route patterns
- ✅ Consolidates shipments along detected routes
- ✅ Uses vehicles from database dynamically
- ✅ Handles intermediate stops automatically

## Example

**Shipments:**
- Nashik → Solapur (500 kg)
- Pune → Baramati (500 kg)

**Result:**
- System detects they can share a route
- Creates dynamic route: Pune → Baramati → Nashik → Solapur (or optimal order)
- Consolidates into one truck if total weight fits
- Uses appropriate vehicle from database

## Integration

The dynamic routing endpoint is available at `/api/consolidate/dynamic` and works alongside:
- DBSCAN clustering (`/api/consolidate`)
- Corridor-based consolidation (`/api/corridor/consolidate`)

Choose the method that best fits your needs!
