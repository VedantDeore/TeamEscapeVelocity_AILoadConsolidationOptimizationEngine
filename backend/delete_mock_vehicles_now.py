"""
Lorri — Delete All Mock Vehicles from Database (non-interactive)
Run: python delete_mock_vehicles_now.py
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


def delete_all_mock_vehicles():
    """Delete all mock vehicles from database, including those assigned to clusters."""
    print("Deleting all mock vehicles from database...")
    print()
    
    removed_count = 0
    
    for vehicle_name in MOCK_VEHICLE_NAMES:
        try:
            # Find vehicles by name
            result = supabase.table("vehicles").select("id, name").ilike("name", f"%{vehicle_name}%").execute()
            
            if result.data:
                for vehicle in result.data:
                    vehicle_id = vehicle["id"]
                    vehicle_name_found = vehicle["name"]
                    
                    # Check if vehicle is used in any clusters
                    clusters_check = supabase.table("clusters").select("id").eq("vehicle_id", vehicle_id).execute()
                    
                    if clusters_check.data:
                        # Delete cluster_shipments and routes first
                        cluster_ids = [c["id"] for c in clusters_check.data]
                        print(f"  [INFO] {vehicle_name_found} (ID: {vehicle_id}) is used in {len(cluster_ids)} clusters. Deleting clusters first...")
                        
                        for cid in cluster_ids:
                            try:
                                # Delete cluster_shipments
                                supabase.table("cluster_shipments").delete().eq("cluster_id", cid).execute()
                                # Delete routes
                                supabase.table("routes").delete().eq("cluster_id", cid).execute()
                            except Exception:
                                pass
                        
                        # Delete clusters
                        try:
                            supabase.table("clusters").delete().eq("vehicle_id", vehicle_id).execute()
                            print(f"    [OK] Deleted {len(cluster_ids)} clusters")
                        except Exception as e:
                            print(f"    [WARN] Could not delete some clusters: {e}")
                    
                    # Now delete the vehicle
                    try:
                        supabase.table("vehicles").delete().eq("id", vehicle_id).execute()
                        print(f"  [OK] Deleted {vehicle_name_found} (ID: {vehicle_id})")
                        removed_count += 1
                    except Exception as e:
                        print(f"  [ERROR] Could not delete {vehicle_name_found}: {e}")
            else:
                print(f"  [-] {vehicle_name} not found")
        except Exception as e:
            print(f"  [ERROR] Error processing {vehicle_name}: {e}")
    
    return removed_count


def main():
    print("=" * 60)
    print("LORRI — Delete All Mock Vehicles from Database")
    print("=" * 60)
    print(f"URL: {SUPABASE_URL}")
    print()
    
    removed = delete_all_mock_vehicles()
    
    print()
    print("=" * 60)
    if removed > 0:
        print(f"DONE! Deleted {removed} mock vehicles from database.")
    else:
        print("No vehicles were deleted.")
    print("=" * 60)


if __name__ == "__main__":
    main()
