import math
from typing import Dict, Any, Tuple

def calculate_preparation_recommendation(
    predicted_demand: float,
    existing_usable_inventory: float = 0.0,
    safety_buffer_pct: float = 0.10,
    shelf_life_hours: int = 24,
    category: str = "Grains",
) -> Dict[str, Any]:
    """
    Food Preparation Decision Engine (Rule-based business logic):
    Recommended preparation quantity = max(0, rounded-up demand forecast including configurable buffer minus usable existing inventory).
    """
    # 1. Base prediction
    base_demand = max(0.0, float(predicted_demand))
    
    # 2. Configurable safety buffer
    buffer_pct = max(0.0, min(0.50, float(safety_buffer_pct)))
    buffered_demand = base_demand * (1.0 + buffer_pct)
    
    # 3. Rounded up demand forecast including buffer
    rounded_buffered_demand = math.ceil(round(buffered_demand * 10, 4)) / 10.0  # round up to 1 decimal place
    buffer_added_qty = round(rounded_buffered_demand - base_demand, 1)
    
    # 4. Usable inventory deduction
    usable_inventory = max(0.0, float(existing_usable_inventory))
    net_needed = rounded_buffered_demand - usable_inventory
    recommended_prep = round(max(0.0, net_needed), 1)
    
    # 5. Surplus and waste risk estimation
    # Assess if existing inventory already covers demand or if high perishability increases risk
    surplus_risk_level, risk_score, risk_reasons = assess_surplus_waste_risk(
        predicted_demand=base_demand,
        recommended_prep=recommended_prep,
        existing_inventory=usable_inventory,
        buffer_pct=buffer_pct,
        shelf_life_hours=shelf_life_hours,
        category=category,
    )
    
    explanation = (
        f"Demand forecast is {base_demand:.1f} units. With a {buffer_pct*100:.0f}% safety buffer (+{buffer_added_qty:.1f} units), "
        f"total required food is {rounded_buffered_demand:.1f} units. Deducting {usable_inventory:.1f} units of usable stock "
        f"yields a recommended preparation of {recommended_prep:.1f} units."
    )
    
    return {
        "predicted_demand": base_demand,
        "safety_buffer_pct": buffer_pct,
        "buffer_added_qty": buffer_added_qty,
        "rounded_buffered_demand": rounded_buffered_demand,
        "existing_usable_inventory": usable_inventory,
        "recommended_prep": recommended_prep,
        "surplus_risk_level": surplus_risk_level,
        "risk_score": risk_score,
        "risk_reasons": risk_reasons,
        "explanation": explanation,
    }

def assess_surplus_waste_risk(
    predicted_demand: float,
    recommended_prep: float,
    existing_inventory: float,
    buffer_pct: float,
    shelf_life_hours: int,
    category: str,
) -> Tuple[str, float, list]:
    """
    Evaluates probability and magnitude of leftover excess and spoilage risk.
    """
    reasons = []
    risk_score = 10.0  # Base nominal risk
    
    total_supply = recommended_prep + existing_inventory
    excess_ratio = (total_supply - predicted_demand) / max(1.0, predicted_demand)
    
    if excess_ratio > 0.25:
        risk_score += 40
        reasons.append(f"Total supply exceeds predicted demand by {excess_ratio*100:.0f}%")
    elif excess_ratio > 0.12:
        risk_score += 20
        reasons.append(f"Supply contains elevated buffer (+{excess_ratio*100:.0f}%)")
        
    if shelf_life_hours <= 12:
        risk_score += 30
        reasons.append(f"Short shelf-life ({shelf_life_hours}h) increases spoilage vulnerability")
    elif shelf_life_hours <= 24:
        risk_score += 15
        
    if category in ["Salads", "Soups"]:
        risk_score += 15
        reasons.append(f"Category '{category}' has higher historical spoilage rates")
        
    if existing_inventory > predicted_demand * 0.5:
        risk_score += 20
        reasons.append(f"Existing inventory is large ({existing_inventory:.1f} units) relative to demand")
        
    risk_score = min(100.0, max(0.0, risk_score))
    
    if risk_score >= 60:
        level = "high"
    elif risk_score >= 35:
        level = "medium"
    else:
        level = "low"
        
    if not reasons:
        reasons.append("Planned supply closely matches forecasted demand with minimal spoilage exposure")
        
    return level, round(risk_score, 1), reasons
