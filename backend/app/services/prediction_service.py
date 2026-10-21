import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import joblib
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.models import FoodItem, DemandHistory, InventoryItem, PredictionRecord
from backend.app.schemas.schemas import PredictionRequest, PredictionResponse, PredictionFactor
from backend.app.services.decision_engine import calculate_preparation_recommendation

_LOADED_MODEL = None
_LOADED_METADATA = None

def get_active_model():
    """Loads and caches the active ML model pipeline from disk."""
    global _LOADED_MODEL, _LOADED_METADATA
    if _LOADED_MODEL is not None:
        return _LOADED_MODEL, _LOADED_METADATA
        
    metadata_path = settings.MODELS_DIR / "model_metadata.json"
    if not metadata_path.exists():
        from backend.app.ml.train_model import train_demand_model
        print("Model not found. Automatically training initial model...")
        train_demand_model(version_tag="v1.0")
        
    with open(metadata_path, "r") as f:
        _LOADED_METADATA = json.load(f)
        
    artifact_path = settings.MODELS_DIR / _LOADED_METADATA.get("artifact_file", "demand_model_v1.0.joblib")
    _LOADED_MODEL = joblib.load(artifact_path)
    return _LOADED_MODEL, _LOADED_METADATA

def reload_active_model():
    """Forces cache refresh when a new model is promoted."""
    global _LOADED_MODEL, _LOADED_METADATA
    _LOADED_MODEL = None
    _LOADED_METADATA = None
    return get_active_model()

def predict_food_demand(
    req: PredictionRequest, 
    db: Session
) -> PredictionResponse:
    """
    Executes end-to-end demand prediction using the trained ML model,
    integrates with inventory for preparation recommendations,
    and records prediction log in the database.
    """
    model, metadata = get_active_model()
    
    # 1. Resolve food item and category
    food_item = db.query(FoodItem).filter(FoodItem.id == req.food_item_id).first()
    food_name = food_item.name if food_item else req.food_item_id
    category = food_item.category if food_item else "Grains"
    unit = food_item.unit if food_item else "kg"
    shelf_life = food_item.default_shelf_life_hours if food_item else 24
    
    # 2. Derive day of week & weekend indicator from target_date
    try:
        dt = datetime.strptime(req.target_date, "%Y-%m-%d")
        day_of_week = dt.strftime("%A")
        is_weekend = int(day_of_week in ["Saturday", "Sunday"])
    except Exception:
        day_of_week = req.day_of_week or "Wednesday"
        is_weekend = 0
        
    # 3. Fetch recent historical demand from database if available, else derive sensible estimate
    recent_records = (
        db.query(DemandHistory.actual_demand)
        .filter(
            DemandHistory.cafeteria_id == req.cafeteria_id,
            DemandHistory.food_item_id == req.food_item_id
        )
        .order_by(DemandHistory.date.desc())
        .limit(14)
        .all()
    )
    
    if recent_records and len(recent_records) > 0:
        recent_vals = [r[0] for r in recent_records]
        recent_avg = float(np.mean(recent_vals[:7]))
        hist_avg = float(np.mean(recent_vals))
    else:
        # Fallback based on expected customer count and category base rate
        base_rate = 0.12 if category == "Grains" else 0.10
        recent_avg = float(req.expected_customer_count * base_rate)
        hist_avg = recent_avg
        
    # 4. Construct input DataFrame with exact features expected by preprocessor
    feature_row = {
        "expected_customer_count": req.expected_customer_count,
        "recent_avg_demand": round(recent_avg, 1),
        "historical_food_demand": round(hist_avg, 1),
        "temperature_c": float(req.temperature_c),
        "is_weekend": is_weekend,
        "is_holiday": int(req.is_holiday),
        "is_special_event": int(req.is_special_event),
        "cafeteria_id": req.cafeteria_id,
        "food_item_id": req.food_item_id,
        "food_category": category,
        "day_of_week": day_of_week,
        "weather_condition": req.weather_condition,
    }
    
    input_df = pd.DataFrame([feature_row])
    
    # 5. Model Inference
    raw_pred = model.predict(input_df)[0]
    predicted_demand = round(max(1.0, float(raw_pred)), 1)
    
    # 6. Check existing usable inventory in database
    existing_items = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.cafeteria_id == req.cafeteria_id,
            InventoryItem.food_item_id == req.food_item_id,
            InventoryItem.status.in_(["usable", "surplus"])
        )
        .all()
    )
    existing_usable = sum(item.quantity for item in existing_items)
    
    # 7. Preparation Decision Engine
    decision = calculate_preparation_recommendation(
        predicted_demand=predicted_demand,
        existing_usable_inventory=existing_usable,
        safety_buffer_pct=req.safety_buffer_pct or settings.DEFAULT_PREP_BUFFER,
        shelf_life_hours=shelf_life,
        category=category,
    )
    
    # 8. Interpretable Prediction Factors
    factors = [
        PredictionFactor(
            factor="Expected Attendance",
            impact="+High" if req.expected_customer_count > 900 else "Neutral",
            description=f"Expected {req.expected_customer_count} diners directly scales base kitchen demand."
        ),
        PredictionFactor(
            factor="Day of Week Pattern",
            impact="-Lower" if is_weekend else ("+Higher" if day_of_week in ["Tuesday", "Wednesday"] else "Moderate"),
            description=f"{day_of_week} historical student traffic pattern."
        ),
        PredictionFactor(
            factor="Weather & Temperature",
            impact=f"{req.weather_condition} ({req.temperature_c}°C)",
            description=f"Weather conditions affect dining preference for {category} items."
        ),
        PredictionFactor(
            factor="Recent 7-Day Velocity",
            impact=f"{recent_avg:.1f} {unit} avg",
            description="Lag moving average provides baseline operational smoothing."
        )
    ]
    if req.is_special_event:
        factors.append(PredictionFactor(
            factor="Special Campus Event",
            impact="+20% to +35%",
            description="Campus event increases visitor footfall and dining participation."
        ))
        
    # 9. Save prediction log to database
    try:
        pred_record = PredictionRecord(
            cafeteria_id=req.cafeteria_id,
            food_item_id=req.food_item_id,
            food_name=food_name,
            target_date=req.target_date,
            expected_customer_count=req.expected_customer_count,
            predicted_demand=predicted_demand,
            recommended_prep=decision["recommended_prep"],
            safety_buffer_pct=decision["safety_buffer_pct"],
            existing_usable_inventory=decision["existing_usable_inventory"],
            surplus_risk_level=decision["surplus_risk_level"],
            unit=unit,
            model_version=metadata.get("version_tag", "v1.0"),
            model_mae=metadata.get("mae", 7.0),
            model_rmse=metadata.get("rmse", 11.5),
            factors_json=json.dumps([f.dict() for f in factors]),
            is_synthetic=True,
        )
        db.add(pred_record)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Warning: Failed to save prediction log: {e}")
        
    return PredictionResponse(
        cafeteria_id=req.cafeteria_id,
        food_item_id=req.food_item_id,
        food_name=food_name,
        target_date=req.target_date,
        expected_customer_count=req.expected_customer_count,
        predicted_demand=predicted_demand,
        recommended_prep=decision["recommended_prep"],
        safety_buffer_pct=decision["safety_buffer_pct"],
        buffer_added_qty=decision["buffer_added_qty"],
        existing_usable_inventory=decision["existing_usable_inventory"],
        net_preparation_needed=decision["recommended_prep"],
        surplus_risk_level=decision["surplus_risk_level"],
        unit=unit,
        model_version=metadata.get("version_tag", "v1.0"),
        model_mae=metadata.get("mae", 7.028),
        model_rmse=metadata.get("rmse", 11.588),
        model_r2=metadata.get("r2", 0.9787),
        factors=factors,
        is_synthetic=True,
        explanation=decision["explanation"],
    )
