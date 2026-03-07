"""
Lorri — Remove Mock Data from Database
Run: python remove_mock_data.py
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Mock vehicle names to remove
MOCK_VEHICLE_NAMES = [
    "Tata 407",
    "Eicher 10.59",
    "Ashok Leyland 1612",
    "Tata Prima 4028",
    "BharatBenz 2823",
    "Mahindra Blazo 25",
]

# Mock depot names to remove
MOCK_DEPOT_NAMES = [
    "Delhi Hub",
    "Mumbai Port",
    "Bangalore Center",
    "Chennai Warehouse",
]


def remove_mock_vehicles():
    """Remove mock vehicles from database."""
    print("Removing mock vehicles...")
    removed_count = 0
    
    for vehicle_name in MOCK_VEHICLE_NAMES:
        try:
            # Find vehicles by name
            result = supabase.table("vehicles").select("id").ilike("name", f"%{vehicle_name}%").execute()
            
            if result.data:
                for vehicle in result.data:
                    vehicle_id = vehicle["id"]
                    # Check if vehicle is used in any clusters
                    clusters_check = supabase.table("clusters").select("id").eq("vehicle_id", vehicle_id).limit(1).execute()
                    
                    if clusters_check.data:
                        print(f"  [SKIP] Skipping {vehicle_name} (ID: {vehicle_id}) - used in existing clusters")
                    else:
                        # Safe to delete
                        supabase.table("vehicles").delete().eq("id", vehicle_id).execute()
                        print(f"  [OK] Removed {vehicle_name} (ID: {vehicle_id})")
                        removed_count += 1
            else:
                print(f"  [-] {vehicle_name} not found")
        except Exception as e:
            print(f"  [ERROR] Error removing {vehicle_name}: {e}")
    
    print(f"  Total removed: {removed_count} vehicles")
    return removed_count


def remove_mock_depots():
    """Remove mock depots from database."""
    print("\nRemoving mock depots...")
    removed_count = 0
    
    for depot_name in MOCK_DEPOT_NAMES:
        try:
            result = supabase.table("depots").select("id").ilike("name", f"%{depot_name}%").execute()
            
            if result.data:
                for depot in result.data:
                    depot_id = depot["id"]
                    supabase.table("depots").delete().eq("id", depot_id).execute()
                    print(f"  [OK] Removed {depot_name} (ID: {depot_id})")
                    removed_count += 1
            else:
                print(f"  [-] {depot_name} not found")
        except Exception as e:
            print(f"  [ERROR] Error removing {depot_name}: {e}")
    
    print(f"  Total removed: {removed_count} depots")
    return removed_count


def main():
    print("=" * 60)
    print("LORRI — Remove Mock Data from Database")
    print("=" * 60)
    print(f"URL: {SUPABASE_URL}")
    print()
    
    vehicles_removed = remove_mock_vehicles()
    depots_removed = remove_mock_depots()
    
    print()
    print("=" * 60)
    print(f"DONE! Removed {vehicles_removed} vehicles and {depots_removed} depots.")
    print("=" * 60)
    print("\nNote: Vehicles that are assigned to existing clusters were not removed.")
    print("You can manually delete them from the Settings page after clearing clusters.")


if __name__ == "__main__":
    main()
