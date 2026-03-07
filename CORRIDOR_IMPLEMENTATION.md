# Corridor-Based Consolidation Implementation

## Overview

This implementation adds **corridor-based consolidation** alongside the existing DBSCAN + VRP approach. This provides a more realistic solution for Indian logistics where trucks     run on fixed routes.

## What Was Implemented

### 1. Database Schema (`backend/setup_supabase.sql`)
- Added `truck_corridors` table with:
  - `truck_name`: Name of the truck/route
  - `capacity_kg`: Maximum weight capacity
  - `operating_days`: Array of days the truck operates
  - `start_location`: Starting city
  - `corridor`: Array of city names in route order
  - `corridor_coords`: Array of {lat, lng} coordinates for each stop
  - `is_active`: Whether the corridor is currently active

### 2. Backend Services (`backend/services/corridor_engine.py`)
- **`match_shipments_to_corridors()`**: Matches shipments to corridors if both origin and destination are on the corridor route
- **`consolidate_corridor()`**: Bin-packs shipments into truck capacity using greedy approach
- **`generate_route_plan()`**: Generates route plan following corridor order with pickup/delivery stops

### 3. Backend API (`backend/routes/corridor.py`)
- `GET /api/corridors` - List all corridors
- `POST /api/corridors` - Create a new corridor
- `PATCH /api/corridors/<id>` - Update a corridor
- `DELETE /api/corridors/<id>` - Delete a corridor
- `POST /api/corridor/consolidate` - Run corridor-based consolidation

### 4. Frontend API (`frontend/lib/api.ts`)
- Added `getCorridors()`, `createCorridor()`, `updateCorridor()`, `deleteCorridor()`
- Added `runCorridorConsolidation()` for triggering corridor-based consolidation

### 5. Settings Page (`frontend/app/settings/page.tsx`)
- **Corridor Management Section**: 
  - List all corridors with status (Active/Inactive)
  - Add new corridors with city selection
  - Delete corridors with confirmation
  - Shows route path and capacity for each corridor
- **Vehicle Management Enhancements**:
  - Edit vehicle functionality (modal with pre-filled form)
  - Delete vehicle with confirmation dialog
  - Toast notifications for all operations

### 6. Consolidation Page (`frontend/app/consolidate/page.tsx`)
- **Mode Selector**: Toggle between "DBSCAN + VRP" and "Corridor-Based" modes
- **Enhanced Cluster Display**:
  - Truck name prominently displayed
  - Weight shown as "used / max kg" format
  - Capacity percentage badge
  - Utilization bar with clear labels
- Fetches vehicle data to show max capacity

### 7. Sample Data (`backend/seed_corridors.py`)
- Script to seed 4 sample corridors:
  - Mumbai-Solapur Express (Mumbai → Pune → Baramati → Solapur)
  - Delhi-Mumbai Freight (Delhi → Jaipur → Ahmedabad → Mumbai)
  - Bangalore-Chennai Route (Bangalore → Hosur → Vellore → Chennai)
  - Pune-Nashik Highway (Pune → Nashik)

## How to Use

### 1. Set Up Database
Run the updated `backend/setup_supabase.sql` in your Supabase SQL Editor to create the `truck_corridors` table.

### 2. Seed Sample Corridors (Optional)
```bash
cd backend
python seed_corridors.py
```

### 3. Add Corridors via UI
1. Go to **Settings** page
2. Scroll to **"Truck Corridors (Fixed Routes)"** section
3. Click **"Add Corridor"**
4. Fill in:
   - Truck name
   - Capacity (kg)
   - Start location
   - Add cities to corridor (select from dropdown)
5. Click **"Add Corridor"**

### 4. Run Corridor-Based Consolidation
1. Go to **Consolidation** page
2. Select **"Corridor-Based"** mode (toggle next to Run button)
3. Click **"Run Consolidation"**
4. The system will:
   - Match shipments to corridors based on origin/destination
   - Bin-pack shipments into truck capacity
   - Generate route plans following corridor order
   - Display results with truck capacity information

## How It Works

### Corridor Matching
- A shipment matches a corridor if:
  1. Shipment's `origin_city` is found in the corridor's city list
  2. Shipment's `dest_city` is found in the corridor's city list
  3. Origin comes **before** destination in corridor order

### Consolidation Process
1. **Match**: Find all shipments that match each corridor
2. **Bin-Pack**: Greedily pack shipments into truck capacity (largest first)
3. **Route Planning**: Generate route following corridor order:
   - Pickup stops: Where shipments originate
   - Delivery stops: Where shipments are delivered
   - Sequential order: Must follow corridor sequence
4. **Cost/CO₂**: Calculate distance, fuel cost, and emissions

### Example
**Corridor**: Mumbai → Pune → Baramati → Solapur

**Shipments**:
- Shipment A: Mumbai → Pune ✓ (matches)
- Shipment B: Pune → Baramati ✓ (matches)
- Shipment C: Mumbai → Solapur ✓ (matches)
- Shipment D: Pune → Mumbai ✗ (doesn't match - wrong direction)

**Result**: Shipments A, B, C are consolidated into one trip following the corridor route.

## Benefits

1. **Realistic**: Matches real-world Indian logistics where trucks run fixed routes
2. **Flexible**: Works alongside DBSCAN approach - choose the best method
3. **Efficient**: Reduces empty miles by consolidating along known routes
4. **User-Friendly**: Easy to manage corridors via Settings UI

## Technical Notes

- Corridor matching uses case-insensitive fuzzy matching for city names
- Coordinates are stored for accurate distance calculations
- Route plans include pickup/delivery sequence with weight tracking
- Consolidation respects vehicle capacity constraints
- Both approaches (DBSCAN and Corridor) create `consolidation_plans` and `clusters` in the same format

## Next Steps

- Add corridor editing functionality (currently only add/delete)
- Add corridor analytics (utilization per corridor, popular routes)
- Support multi-stop pickups/deliveries within same city
- Add corridor scheduling (time windows, frequency)
