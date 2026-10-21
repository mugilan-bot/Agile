from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.models.models import (
    InventoryItem, FoodItem, RecipientOrganization, RedistributionTransaction, Cafeteria
)
from backend.app.schemas.schemas import (
    SurplusMatchResponse, MatchCandidate, RedistributionAllocateRequest,
    RedistributionTransactionResponse
)

def get_available_surplus_batches(db: Session, cafeteria_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieves inventory items that have surplus available for redistribution.
    Calculates remaining safe-use hours based on expiry_date.
    """
    query = (
        db.query(InventoryItem, FoodItem)
        .join(FoodItem, InventoryItem.food_item_id == FoodItem.id)
        .filter(
            InventoryItem.status.in_(["surplus", "usable"]),
            (InventoryItem.surplus_qty > InventoryItem.allocated_qty) | 
            ((InventoryItem.leftover_qty > 0) & (InventoryItem.waste_qty == 0))
        )
    )
    if cafeteria_id:
        query = query.filter(InventoryItem.cafeteria_id == cafeteria_id)
        
    results = query.all()
    surplus_list = []
    now = datetime.utcnow()
    
    for inv, food in results:
        # Determine available surplus quantity
        available = max(0.0, inv.surplus_qty - inv.allocated_qty)
        if available == 0.0 and inv.leftover_qty > 0:
            available = max(0.0, inv.leftover_qty - inv.allocated_qty)
            
        if available <= 0.0:
            continue
            
        # Parse expiry to estimate remaining safe hours
        safe_hours = 12.0
        try:
            exp_dt = datetime.fromisoformat(inv.expiry_date.replace("Z", ""))
            delta = (exp_dt - now).total_seconds() / 3600.0
            safe_hours = round(max(0.0, delta), 1)
        except Exception:
            safe_hours = 8.0
            
        surplus_list.append({
            "inventory_item_id": inv.id,
            "batch_number": inv.batch_number,
            "cafeteria_id": inv.cafeteria_id,
            "food_item_id": food.id,
            "food_name": food.name,
            "category": food.category,
            "available_surplus_qty": round(available, 1),
            "unit": inv.unit,
            "prep_date": inv.prep_date,
            "expiry_date": inv.expiry_date,
            "safe_use_remaining_hours": safe_hours,
            "storage_type": inv.storage_type,
            "status": inv.status,
        })
        
    return surplus_list

def match_recipients_for_surplus(
    surplus_batch: Dict[str, Any],
    db: Session
) -> SurplusMatchResponse:
    """
    Intelligent Matching Engine:
    Evaluates food compatibility, capacity, pickup ability, distance, and safe-use shelf-life.
    Returns ranked candidates with transparent match scores and reasons.
    """
    recipients = db.query(RecipientOrganization).filter(RecipientOrganization.active_status == True).all()
    candidates: List[MatchCandidate] = []
    
    food_category = surplus_batch["category"].lower()
    qty_kg = surplus_batch["available_surplus_qty"]  # Normalized or direct
    safe_hours = surplus_batch["safe_use_remaining_hours"]
    
    for recip in recipients:
        reasons = []
        score = 100.0
        
        # 1. Compatibility Check
        accepted = [cat.strip().lower() for cat in recip.accepted_categories.split(",")]
        is_compatible = (food_category in accepted) or ("all" in accepted)
        if not is_compatible:
            score -= 60.0
            reasons.append(f"Does not accept category '{surplus_batch['category']}'")
        else:
            reasons.append(f"Accepts {surplus_batch['category']}")
            
        # 2. Capacity Check
        available_cap = max(0.0, recip.storage_capacity_kg - recip.current_stored_kg)
        if available_cap < qty_kg:
            deficit = qty_kg - available_cap
            score -= min(40.0, (deficit / qty_kg) * 40.0)
            reasons.append(f"Limited capacity ({available_cap:.0f} kg available of {qty_kg:.0f} kg needed)")
        else:
            reasons.append(f"Sufficient capacity ({available_cap:.0f} kg remaining)")
            
        # 3. Safe Shelf-Life Check
        if safe_hours < recip.min_shelf_life_hours:
            score -= 30.0
            reasons.append(f"Safe time ({safe_hours}h) is below recipient minimum ({recip.min_shelf_life_hours}h)")
        else:
            reasons.append(f"Meets safe transit window ({safe_hours}h remaining)")
            
        # 4. Proximity & Distance Weighting (Deduct 2 points per km beyond 2km)
        dist = recip.distance_km
        if dist > 2.0:
            dist_penalty = min(25.0, (dist - 2.0) * 2.0)
            score -= dist_penalty
        reasons.append(f"Distance: {dist:.1f} km away")
        
        # 5. Pickup Capability
        if recip.allows_pickup:
            reasons.append("Provides own collection/pickup fleet")
        else:
            score -= 10.0
            reasons.append("Requires donor drop-off delivery")
            
        final_score = max(0.0, min(100.0, round(score, 1)))
        is_recommended = final_score >= 65.0 and is_compatible
        
        candidates.append(MatchCandidate(
            recipient_id=recip.id,
            recipient_name=recip.name,
            org_type=recip.org_type,
            distance_km=recip.distance_km,
            available_capacity_kg=round(available_cap, 1),
            compatibility_score=final_score,
            pickup_available=recip.allows_pickup,
            is_recommended=is_recommended,
            reasons=reasons,
        ))
        
    # Sort candidates by score descending
    candidates.sort(key=lambda c: c.compatibility_score, reverse=True)
    
    return SurplusMatchResponse(
        inventory_item_id=surplus_batch["inventory_item_id"],
        batch_number=surplus_batch["batch_number"],
        food_item_id=surplus_batch["food_item_id"],
        food_name=surplus_batch["food_name"],
        category=surplus_batch["category"],
        available_surplus_qty=surplus_batch["available_surplus_qty"],
        unit=surplus_batch["unit"],
        safe_use_remaining_hours=surplus_batch["safe_use_remaining_hours"],
        storage_type=surplus_batch["storage_type"],
        candidates=candidates,
    )

def allocate_surplus_transaction(
    req: RedistributionAllocateRequest,
    db: Session
) -> RedistributionTransactionResponse:
    """
    Transactionally allocates surplus food to a recipient organization.
    Prevents double-allocation using explicit reservation.
    """
    # 1. Fetch inventory item with lock
    inv = db.query(InventoryItem).filter(InventoryItem.id == req.inventory_item_id).with_for_update().first()
    if not inv:
        raise ValueError(f"Inventory item with ID {req.inventory_item_id} not found.")
        
    recipient = db.query(RecipientOrganization).filter(RecipientOrganization.id == req.recipient_id).first()
    if not recipient:
        raise ValueError(f"Recipient organization '{req.recipient_id}' not found.")
        
    food = db.query(FoodItem).filter(FoodItem.id == inv.food_item_id).first()
    food_name = food.name if food else inv.food_item_id
    
    # Calculate available unallocated surplus
    available = max(0.0, inv.surplus_qty - inv.allocated_qty)
    if available == 0.0 and inv.leftover_qty > 0:
        available = max(0.0, inv.leftover_qty - inv.allocated_qty)
        inv.surplus_qty = inv.leftover_qty
        
    if req.quantity > available + 1e-4:
        raise ValueError(
            f"Over-allocation error: Requested {req.quantity} {inv.unit}, but only {available:.1f} {inv.unit} "
            f"remains unallocated for batch {inv.batch_number}."
        )
        
    # Update inventory allocation
    inv.allocated_qty += req.quantity
    if inv.allocated_qty >= inv.surplus_qty - 1e-4:
        inv.status = "allocated"
    else:
        inv.status = "surplus"
        
    # Update recipient stored quantity
    recipient.current_stored_kg += req.quantity
    
    # Generate unique transaction code
    import uuid
    tx_code = f"TX-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    
    tx = RedistributionTransaction(
        transaction_code=tx_code,
        cafeteria_id=inv.cafeteria_id,
        recipient_id=recipient.id,
        inventory_item_id=inv.id,
        food_item_id=inv.food_item_id,
        food_name=food_name,
        quantity=req.quantity,
        unit=inv.unit,
        matched_date=datetime.utcnow().strftime("%Y-%m-%d"),
        scheduled_pickup=req.scheduled_pickup or (datetime.utcnow().strftime("%Y-%m-%d 16:00")),
        status="scheduled",
        match_score=94.5,
        match_reason=f"Matched {food_name} with {recipient.name} based on capacity & category compatibility.",
        donor_notes=req.notes or "Scheduled for pickup via FoodFlow redistribution.",
        is_synthetic=True,
    )
    
    db.add(tx)
    db.commit()
    db.refresh(tx)
    
    return RedistributionTransactionResponse(
        id=tx.id,
        transaction_code=tx.transaction_code,
        cafeteria_id=tx.cafeteria_id,
        recipient_id=tx.recipient_id,
        recipient_name=recipient.name,
        food_name=tx.food_name,
        quantity=tx.quantity,
        unit=tx.unit,
        matched_date=tx.matched_date,
        scheduled_pickup=tx.scheduled_pickup,
        status=tx.status,
        match_score=tx.match_score,
        match_reason=tx.match_reason,
        donor_notes=tx.donor_notes,
        is_synthetic=tx.is_synthetic,
        created_at=tx.created_at,
    )
