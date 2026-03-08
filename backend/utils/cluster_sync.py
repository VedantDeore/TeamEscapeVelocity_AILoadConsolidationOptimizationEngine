"""
Mark clusters as delivered when all their shipments are delivered.
Frees vehicles for consolidation.
"""


def _fetch_shipment_statuses(sb, shipment_ids):
    """Fetch shipment statuses, chunked to avoid URI length limits."""
    if not shipment_ids:
        return []
    all_data = []
    chunk_size = 15
    for i in range(0, len(shipment_ids), chunk_size):
        chunk = shipment_ids[i : i + chunk_size]
        try:
            r = sb.table("shipments").select("id, status").in_("id", chunk).execute()
            all_data.extend(r.data or [])
        except Exception:
            pass
    return all_data


def mark_completed_clusters_as_delivered(sb, force=False):
    """
    When all shipments in a cluster are delivered, mark cluster as delivered
    so the vehicle becomes available for consolidation again.
    Also catches up on existing clusters that already have all shipments delivered.

    Args:
        sb: Supabase client
        force: If True, mark ALL accepted/in_transit clusters as delivered
               without checking shipment status (use when all shipments are done)

    Returns: number of clusters marked as delivered
    """
    clusters = sb.table("clusters").select("id, vehicle_id").in_(
        "status", ["accepted", "in_transit"]
    ).execute()
    marked = 0
    for c in (clusters.data or []):
        cid = c.get("id")
        if not cid:
            continue
        cs = sb.table("cluster_shipments").select("shipment_id").eq(
            "cluster_id", cid
        ).execute()
        shipment_ids = [r["shipment_id"] for r in (cs.data or [])]
        if force:
            sb.table("clusters").update({"status": "delivered"}).eq("id", cid).execute()
            marked += 1
            continue
        if not shipment_ids:
            sb.table("clusters").update({"status": "delivered"}).eq("id", cid).execute()
            marked += 1
            continue
        shipped = _fetch_shipment_statuses(sb, shipment_ids)
        if len(shipped) != len(shipment_ids):
            continue
        all_delivered = all(
            str(s.get("status", "")).lower().strip() == "delivered"
            for s in shipped
        )
        if all_delivered:
            sb.table("clusters").update({"status": "delivered"}).eq("id", cid).execute()
            marked += 1
    return marked
