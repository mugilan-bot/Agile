import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, List
import joblib
import numpy as np
import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.models import Cafeteria, FoodItem, DemandHistory, InventoryItem, PredictionRecord
from backend.app.schemas.schemas import (
    PredictionRequest, PredictionResponse, PredictionFactor,
    NextDayDinerRecommendationResponse, NextDayItemPrepRecommendation,
    NextDayPrepPlanResponse, ProductWastePrepConsumedItem,
    ProductWastePrepConsumedResponse, ProductHistoryRecord
)
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
            factors_json=json.dumps([f.model_dump() if hasattr(f, 'model_dump') else f.dict() for f in factors]),
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

def recommend_next_day_diners(
    db: Session,
    cafeteria_id: str,
    target_date: Optional[str] = None,
    weather_condition: str = "Sunny",
    temperature_c: float = 22.0,
    is_holiday: bool = False,
    is_special_event: bool = False,
) -> NextDayDinerRecommendationResponse:
    """
    Intelligently recommends the expected diner headcount for the next day
    by combining historical day-of-week attendance distributions, rolling 14-day velocity,
    cafeteria capacity, and environmental adjustments (weather, weekend, holiday, event).
    """
    cafeteria = db.query(Cafeteria).filter(Cafeteria.id == cafeteria_id).first()
    caf_name = cafeteria.name if cafeteria else cafeteria_id
    base_traffic = cafeteria.avg_daily_traffic if cafeteria else 1000

    if not target_date:
        target_date = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")

    try:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        day_of_week = dt.strftime("%A")
    except Exception:
        dt = datetime.utcnow() + timedelta(days=1)
        day_of_week = dt.strftime("%A")
        target_date = dt.strftime("%Y-%m-%d")

    is_weekend = day_of_week in ["Saturday", "Sunday"]

    # 1. Query historical day-of-week attendance for this cafeteria
    dow_records = (
        db.query(DemandHistory.expected_customer_count)
        .filter(
            DemandHistory.cafeteria_id == cafeteria_id,
            DemandHistory.day_of_week == day_of_week
        )
        .all()
    )

    if dow_records and len(dow_records) > 0:
        counts = [r[0] for r in dow_records if r[0] is not None]
        dow_avg = float(np.mean(counts)) if counts else float(base_traffic)
    else:
        # Fallback profile multipliers
        dow_multipliers = {
            "Monday": 0.95, "Tuesday": 1.10, "Wednesday": 1.15,
            "Thursday": 0.95, "Friday": 0.75, "Saturday": 0.40, "Sunday": 0.40
        }
        dow_avg = float(base_traffic * dow_multipliers.get(day_of_week, 1.0))

    # 2. Query recent 14-day trailing momentum
    recent_records = (
        db.query(DemandHistory.expected_customer_count)
        .filter(DemandHistory.cafeteria_id == cafeteria_id)
        .order_by(DemandHistory.date.desc())
        .limit(14)
        .all()
    )
    if recent_records:
        r_counts = [r[0] for r in recent_records if r[0] is not None]
        recent_trend = float(np.mean(r_counts)) if r_counts else dow_avg
    else:
        recent_trend = dow_avg

    # 3. Blended baseline calculation: 70% historical day-of-week + 30% recent momentum
    calculated = (dow_avg * 0.70) + (recent_trend * 0.30)

    # 4. Environmental and calendar adjustments
    weather_desc = "Standard dining attendance expected."
    if weather_condition in ["Rainy", "Cold"] or temperature_c < 10.0:
        calculated *= 1.05
        weather_desc = f"{weather_condition} ({temperature_c}°C) drives +5% more diners to indoor dining halls."
    elif weather_condition == "Sunny" and temperature_c > 28.0:
        calculated *= 0.97
        weather_desc = f"Warm sunny weather ({temperature_c}°C) slightly disperses student lunch footfall."

    if is_weekend:
        if calculated > base_traffic * 0.55:
            calculated = min(calculated, base_traffic * 0.50)

    if is_holiday:
        calculated *= 0.35
    elif is_special_event:
        calculated *= 1.30

    recommended_count = int(round(max(50, calculated)))

    factors = [
        PredictionFactor(
            factor="Historical Day Pattern",
            impact=f"{round(dow_avg)} diners avg",
            description=f"Turnout pattern for {day_of_week}s at {caf_name}."
        ),
        PredictionFactor(
            factor="Calendar Status",
            impact="Weekend Turnout" if is_weekend else ("Holiday Dip" if is_holiday else ("Special Event Surge" if is_special_event else "Academic Weekday")),
            description="Adjusts for campus dorm residency and institutional calendar."
        ),
        PredictionFactor(
            factor="Weather Forecast",
            impact=f"{weather_condition} ({temperature_c}°C)",
            description=weather_desc
        ),
        PredictionFactor(
            factor="14-Day Trailing Trend",
            impact=f"{round(recent_trend)} diners avg",
            description="Captures recent enrollment and operational traffic volume."
        )
    ]

    confidence = 95.0 if dow_records and len(dow_records) > 20 else 89.0

    explanation = (
        f"Recommended expected diner attendance for tomorrow ({day_of_week}, {target_date}) is {recommended_count:,} diners "
        f"at {caf_name}. Synthesizes {day_of_week} baseline ({round(dow_avg)} diners), "
        f"14-day velocity ({round(recent_trend)} diners), and {weather_condition.lower()} weather."
    )

    return NextDayDinerRecommendationResponse(
        cafeteria_id=cafeteria_id,
        cafeteria_name=caf_name,
        target_date=target_date,
        day_of_week=day_of_week,
        recommended_customer_count=recommended_count,
        baseline_historical_avg=round(dow_avg, 1),
        recent_trend_avg=round(recent_trend, 1),
        weather_condition=weather_condition,
        temperature_c=float(temperature_c),
        is_weekend=bool(is_weekend),
        is_holiday=bool(is_holiday),
        is_special_event=bool(is_special_event),
        confidence_score=confidence,
        factors=factors,
        explanation=explanation,
    )

def recommend_next_day_dinner_prep(
    db: Session,
    cafeteria_id: str,
    target_date: Optional[str] = None,
    category: Optional[str] = None,
    weather_condition: str = "Sunny",
    temperature_c: float = 22.0,
    is_holiday: bool = False,
    is_special_event: bool = False,
    safety_buffer_pct: Optional[float] = 0.10,
) -> NextDayPrepPlanResponse:
    """
    Generates a full next-day dinner preparation schedule across all food items,
    powered by the next-day diner footfall recommendation, ML demand forecasting,
    and live inventory deduction.
    """
    # 1. First get the recommended expected diners for next day
    diner_rec = recommend_next_day_diners(
        db=db,
        cafeteria_id=cafeteria_id,
        target_date=target_date,
        weather_condition=weather_condition,
        temperature_c=temperature_c,
        is_holiday=is_holiday,
        is_special_event=is_special_event,
    )

    # 2. Query food products
    item_query = db.query(FoodItem).filter(FoodItem.is_active == True)
    if category and category.lower() != "all":
        item_query = item_query.filter(FoodItem.category == category)
    items = item_query.order_by(FoodItem.category, FoodItem.name).all()

    model, metadata = get_active_model()
    buffer_pct = safety_buffer_pct if safety_buffer_pct is not None else settings.DEFAULT_PREP_BUFFER

    prep_items: List[NextDayItemPrepRecommendation] = []
    total_predicted_demand = 0.0
    total_usable_inventory = 0.0
    total_recommended_prep = 0.0
    total_estimated_prep_cost = 0.0

    for item in items:
        # Fetch recent historical demand for this specific item
        recent_records = (
            db.query(DemandHistory.actual_demand)
            .filter(
                DemandHistory.cafeteria_id == cafeteria_id,
                DemandHistory.food_item_id == item.id
            )
            .order_by(DemandHistory.date.desc())
            .limit(14)
            .all()
        )
        if recent_records:
            recent_vals = [r[0] for r in recent_records]
            recent_avg = float(np.mean(recent_vals[:7]))
            hist_avg = float(np.mean(recent_vals))
        else:
            base_rate = 0.12 if item.category in ["Grains", "Proteins"] else 0.08
            recent_avg = float(diner_rec.recommended_customer_count * base_rate)
            hist_avg = recent_avg

        feature_row = {
            "expected_customer_count": diner_rec.recommended_customer_count,
            "recent_avg_demand": round(recent_avg, 1),
            "historical_food_demand": round(hist_avg, 1),
            "temperature_c": float(temperature_c),
            "is_weekend": int(diner_rec.is_weekend),
            "is_holiday": int(is_holiday),
            "is_special_event": int(is_special_event),
            "cafeteria_id": cafeteria_id,
            "food_item_id": item.id,
            "food_category": item.category,
            "day_of_week": diner_rec.day_of_week,
            "weather_condition": weather_condition,
        }
        input_df = pd.DataFrame([feature_row])
        raw_pred = model.predict(input_df)[0]
        predicted_demand = round(max(1.0, float(raw_pred)), 1)

        # Usable inventory currently on hand in this cafeteria
        existing_batches = (
            db.query(InventoryItem)
            .filter(
                InventoryItem.cafeteria_id == cafeteria_id,
                InventoryItem.food_item_id == item.id,
                InventoryItem.status.in_(["usable", "surplus"])
            )
            .all()
        )
        usable_stock = round(sum(b.quantity for b in existing_batches), 1)

        # Run decision engine
        decision = calculate_preparation_recommendation(
            predicted_demand=predicted_demand,
            existing_usable_inventory=usable_stock,
            safety_buffer_pct=buffer_pct,
            shelf_life_hours=item.default_shelf_life_hours,
            category=item.category,
        )

        rec_prep = decision["recommended_prep"]
        est_cost = round(rec_prep * item.unit_cost, 2)

        total_predicted_demand += predicted_demand
        total_usable_inventory += usable_stock
        total_recommended_prep += rec_prep
        total_estimated_prep_cost += est_cost

        prep_items.append(NextDayItemPrepRecommendation(
            food_item_id=item.id,
            food_name=item.name,
            category=item.category,
            unit=item.unit,
            unit_cost=item.unit_cost,
            predicted_demand=predicted_demand,
            existing_usable_inventory=usable_stock,
            buffer_added_qty=decision["buffer_added_qty"],
            recommended_prep=rec_prep,
            surplus_risk_level=decision["surplus_risk_level"],
            estimated_prep_cost=est_cost,
            explanation=decision["explanation"],
        ))

    return NextDayPrepPlanResponse(
        cafeteria_id=cafeteria_id,
        cafeteria_name=diner_rec.cafeteria_name,
        target_date=diner_rec.target_date,
        day_of_week=diner_rec.day_of_week,
        expected_customer_count=diner_rec.recommended_customer_count,
        total_predicted_demand=round(total_predicted_demand, 1),
        total_usable_inventory=round(total_usable_inventory, 1),
        total_recommended_prep=round(total_recommended_prep, 1),
        total_estimated_prep_cost=round(total_estimated_prep_cost, 2),
        weather_condition=weather_condition,
        temperature_c=temperature_c,
        items=prep_items,
        diner_recommendation=diner_rec,
        generated_at=datetime.utcnow().isoformat(),
    )

def get_product_waste_prep_consumed_summary(
    db: Session,
    cafeteria_id: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    sort_by: str = "wasted_qty",
    sort_order: str = "desc"
) -> ProductWastePrepConsumedResponse:
    """
    Computes all historical waste, preparation, and consumed data for each product,
    supporting search by Product Name or Product ID.
    """
    food_items_query = db.query(FoodItem)
    if category and category.lower() != "all":
        food_items_query = food_items_query.filter(FoodItem.category == category)
    food_items = food_items_query.all()

    # Pre-filter by search query (name or id) if specified
    if search and search.strip():
        s = search.strip().lower()
        food_items = [f for f in food_items if s in f.id.lower() or s in f.name.lower()]

    items_result: List[ProductWastePrepConsumedItem] = []
    tot_prep = 0.0
    tot_consumed = 0.0
    tot_waste = 0.0
    tot_cost = 0.0

    for f in food_items:
        q = db.query(DemandHistory).filter(DemandHistory.food_item_id == f.id)
        if cafeteria_id:
            q = q.filter(DemandHistory.cafeteria_id == cafeteria_id)

        history_rows = q.order_by(DemandHistory.date.desc()).all()

        p_prep = sum(r.actual_prepared_qty for r in history_rows)
        p_consumed = sum(r.actual_consumption for r in history_rows)
        p_waste = sum(r.wasted_qty for r in history_rows)
        p_leftover = sum(r.leftover_qty for r in history_rows)
        p_cost = sum(r.total_waste_cost for r in history_rows)
        rec_count = len(history_rows)

        cons_pct = round((p_consumed / max(1.0, p_prep)) * 100.0, 1) if p_prep > 0 else 0.0
        waste_pct = round((p_waste / max(1.0, p_prep)) * 100.0, 1) if p_prep > 0 else 0.0

        if waste_pct < 6.0:
            status = "optimal"
        elif waste_pct < 15.0:
            status = "moderate_waste"
        else:
            status = "high_waste"

        recent_logs = [
            ProductHistoryRecord(
                date=r.date,
                cafeteria_id=r.cafeteria_id,
                prepared_qty=round(r.actual_prepared_qty, 1),
                consumed_qty=round(r.actual_consumption, 1),
                wasted_qty=round(r.wasted_qty, 1),
                leftover_qty=round(r.leftover_qty, 1),
                waste_cost=round(r.total_waste_cost, 2),
            )
            for r in history_rows[:10]
        ]

        tot_prep += p_prep
        tot_consumed += p_consumed
        tot_waste += p_waste
        tot_cost += p_cost

        items_result.append(
            ProductWastePrepConsumedItem(
                food_item_id=f.id,
                food_name=f.name,
                category=f.category,
                unit=f.unit,
                unit_cost=f.unit_cost,
                total_prepared_qty=round(p_prep, 1),
                total_consumed_qty=round(p_consumed, 1),
                total_wasted_qty=round(p_waste, 1),
                total_leftover_qty=round(p_leftover, 1),
                total_waste_cost=round(p_cost, 2),
                consumption_efficiency_pct=cons_pct,
                waste_pct=waste_pct,
                records_count=rec_count,
                status_level=status,
                recent_history=recent_logs,
            )
        )

    # Sorting
    reverse = sort_order.lower() == "desc"
    if sort_by == "wasted_qty":
        items_result.sort(key=lambda x: x.total_wasted_qty, reverse=reverse)
    elif sort_by == "prepared_qty":
        items_result.sort(key=lambda x: x.total_prepared_qty, reverse=reverse)
    elif sort_by == "consumed_qty":
        items_result.sort(key=lambda x: x.total_consumed_qty, reverse=reverse)
    elif sort_by == "waste_cost":
        items_result.sort(key=lambda x: x.total_waste_cost, reverse=reverse)
    elif sort_by == "food_name":
        items_result.sort(key=lambda x: x.food_name.lower(), reverse=reverse)
    elif sort_by == "food_item_id":
        items_result.sort(key=lambda x: x.food_item_id.lower(), reverse=reverse)

    overall_cons = round((tot_consumed / max(1.0, tot_prep)) * 100.0, 1) if tot_prep > 0 else 0.0
    overall_waste = round((tot_waste / max(1.0, tot_prep)) * 100.0, 1) if tot_prep > 0 else 0.0

    return ProductWastePrepConsumedResponse(
        total_products_count=len(items_result),
        total_prepared_qty=round(tot_prep, 1),
        total_consumed_qty=round(tot_consumed, 1),
        total_wasted_qty=round(tot_waste, 1),
        total_waste_cost=round(tot_cost, 2),
        overall_consumption_efficiency_pct=overall_cons,
        overall_waste_pct=overall_waste,
        products=items_result,
    )

def get_product_flow_detail(
    db: Session,
    product_id_or_name: str,
    cafeteria_id: Optional[str] = None
) -> Optional[ProductWastePrepConsumedItem]:
    """Fetches comprehensive waste, prep, and consumed metrics for a specific product by ID or Name."""
    s = product_id_or_name.strip().lower()
    item = db.query(FoodItem).filter(
        (func.lower(FoodItem.id) == s) | (func.lower(FoodItem.name) == s)
    ).first()

    if not item:
        # Partial match
        item = db.query(FoodItem).filter(
            FoodItem.id.ilike(f"%{s}%") | FoodItem.name.ilike(f"%{s}%")
        ).first()

    if not item:
        return None

    res = get_product_waste_prep_consumed_summary(
        db=db,
        cafeteria_id=cafeteria_id,
        search=item.id,
    )
    if res.products:
        return res.products[0]
    return None

