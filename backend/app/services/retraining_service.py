import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.models import DemandHistory, ModelVersionRecord
from backend.app.ml.train_model import (
    train_demand_model, chronological_split, evaluate_predictions,
    NUMERICAL_FEATURES, CATEGORICAL_FEATURES, TARGET_COLUMN
)
from backend.app.services.prediction_service import reload_active_model

def execute_controlled_retraining(
    db: Session,
    target_algorithm: str = "RandomForestRegressor",
    min_improvement_pct: float = 1.0,
    force_promote: bool = False
) -> Dict[str, Any]:
    """
    Executes controlled retraining workflow:
    1. Loads combined records from database.
    2. Verifies data volume meets minimum retraining threshold.
    3. Trains candidate model on chronological split.
    4. Compares candidate test MAE with active model test MAE.
    5. Promotes only if acceptance criteria met (or force_promote=True).
    6. Saves audit record and updates active model state.
    """
    # 1. Fetch records from DB
    records_count = db.query(DemandHistory).count()
    if records_count < settings.MIN_RETRAIN_RECORDS:
        return {
            "status": "insufficient_data",
            "candidate_version": "N/A",
            "active_version": "v1.0",
            "candidate_mae": 0.0,
            "candidate_rmse": 0.0,
            "active_mae": 0.0,
            "active_rmse": 0.0,
            "samples_used": records_count,
            "message": f"Insufficient historical records ({records_count} available, minimum required is {settings.MIN_RETRAIN_RECORDS})."
        }
        
    # Query all demand records into DataFrame
    query = db.query(DemandHistory).order_by(DemandHistory.date.asc())
    data = []
    for r in query.all():
        data.append({
            "date": r.date,
            "cafeteria_id": r.cafeteria_id,
            "food_item_id": r.food_item_id,
            "food_category": r.food_category,
            "day_of_week": r.day_of_week,
            "is_weekend": int(r.is_weekend),
            "is_holiday": int(r.is_holiday),
            "is_special_event": int(r.is_special_event),
            "weather_condition": r.weather_condition,
            "temperature_c": r.temperature_c,
            "expected_customer_count": r.expected_customer_count,
            "recent_avg_demand": r.recent_avg_demand,
            "historical_food_demand": r.historical_food_demand,
            "actual_demand": r.actual_demand,
        })
    df = pd.DataFrame(data)
    
    # Generate new candidate version tag
    candidate_tag = f"v{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    
    # Save temporary dataset for training script
    temp_dataset_path = settings.DATA_DIR / f"retrain_dataset_{candidate_tag}.csv"
    df.to_csv(temp_dataset_path, index=False)
    
    # Train candidate model
    candidate_meta = train_demand_model(
        data_path=temp_dataset_path,
        version_tag=candidate_tag,
        model_type="RandomForest"
    )
    
    # Fetch active model metadata
    metadata_path = settings.MODELS_DIR / "model_metadata.json"
    active_meta = {}
    if metadata_path.exists():
        with open(metadata_path, "r") as f:
            active_meta = json.load(f)
            
    active_mae = active_meta.get("mae", 999.0)
    active_rmse = active_meta.get("rmse", 999.0)
    candidate_mae = candidate_meta["mae"]
    candidate_rmse = candidate_meta["rmse"]
    
    # Acceptance Criteria Check:
    # Candidate must have MAE lower than or equal to active model + tolerance
    improvement_pct = ((active_mae - candidate_mae) / max(0.1, active_mae)) * 100.0
    should_promote = force_promote or (improvement_pct >= min_improvement_pct)
    
    if should_promote:
        # Promote candidate: update model_metadata.json as active
        candidate_meta["is_active"] = True
        with open(metadata_path, "w") as f:
            json.dump(candidate_meta, f, indent=2)
            
        # Update database ModelVersionRecords
        db.query(ModelVersionRecord).update({ModelVersionRecord.is_active: False})
        new_ver = ModelVersionRecord(
            version_tag=candidate_tag,
            algorithm=candidate_meta["algorithm"],
            train_samples_count=candidate_meta["train_samples_count"],
            test_samples_count=candidate_meta["test_samples_count"],
            mae=candidate_mae,
            rmse=candidate_rmse,
            r2=candidate_meta["r2"],
            is_active=True,
            artifact_path=str(settings.MODELS_DIR / candidate_meta["artifact_file"]),
            evaluation_notes=f"Promoted with {improvement_pct:.2f}% improvement over previous active model.",
        )
        db.add(new_ver)
        db.commit()
        
        # Reload memory cache
        reload_active_model()
        
        status = "promoted"
        msg = f"Candidate model {candidate_tag} successfully promoted! Test MAE improved from {active_mae:.2f} to {candidate_mae:.2f} ({improvement_pct:+.1f}%)."
    else:
        status = "rejected"
        # Store as unpromoted candidate
        new_ver = ModelVersionRecord(
            version_tag=candidate_tag,
            algorithm=candidate_meta["algorithm"],
            train_samples_count=candidate_meta["train_samples_count"],
            test_samples_count=candidate_meta["test_samples_count"],
            mae=candidate_mae,
            rmse=candidate_rmse,
            r2=candidate_meta["r2"],
            is_active=False,
            artifact_path=str(settings.MODELS_DIR / candidate_meta["artifact_file"]),
            evaluation_notes=f"Rejected: candidate MAE ({candidate_mae:.2f}) did not achieve required {min_improvement_pct}% improvement over active ({active_mae:.2f}).",
        )
        db.add(new_ver)
        db.commit()
        msg = f"Candidate model {candidate_tag} rejected. Candidate MAE {candidate_mae:.2f} did not outperform active MAE {active_mae:.2f} by >= {min_improvement_pct}%."
        
    # Clean up temp file
    if temp_dataset_path.exists():
        temp_dataset_path.unlink()
        
    return {
        "status": status,
        "candidate_version": candidate_tag,
        "active_version": active_meta.get("version_tag", "v1.0") if not should_promote else candidate_tag,
        "candidate_mae": candidate_mae,
        "candidate_rmse": candidate_rmse,
        "active_mae": active_mae,
        "active_rmse": active_rmse,
        "samples_used": len(df),
        "message": msg,
    }
