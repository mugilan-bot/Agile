import io
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.models import DemandHistory, WasteRecord, PipelineExecution, FoodItem

REQUIRED_COLUMNS = [
    "date",
    "cafeteria_id",
    "food_item_id",
    "actual_demand",
]

def generate_csv_template() -> str:
    """Generates sample CSV template content for cafeteria managers to upload."""
    header = (
        "date,cafeteria_id,food_item_id,food_name,food_category,day_of_week,"
        "is_weekend,is_holiday,is_special_event,weather_condition,temperature_c,"
        "expected_customer_count,historical_customer_count,recent_avg_demand,historical_food_demand,"
        "planned_preparation_qty,actual_prepared_qty,actual_demand,actual_consumption,"
        "leftover_qty,wasted_qty,unit,unit_cost\n"
    )
    sample_rows = (
        "2026-10-22,CAF-CENTRAL,ITEM-JASMINE-RICE,Steamed Jasmine Rice,Grains,Thursday,"
        "0,0,0,Sunny,24.0,1100,1080,125.0,120.0,140.0,138.0,122.0,122.0,16.0,4.5,kg,1.80\n"
        "2026-10-22,CAF-CENTRAL,ITEM-GRILLED-CHICKEN,Herb Grilled Chicken Breast,Proteins,Thursday,"
        "0,0,0,Sunny,24.0,1100,1080,145.0,142.0,160.0,158.0,148.0,148.0,10.0,2.0,kg,6.50\n"
        "2026-10-22,CAF-NORTH,ITEM-TOMATO-BASIL,Creamy Tomato Basil Soup,Soups,Thursday,"
        "0,0,0,Cloudy,19.5,750,720,55.0,52.0,65.0,64.0,58.0,58.0,6.0,2.5,liters,2.40\n"
    )
    return header + sample_rows

def process_uploaded_csv(
    file_bytes: bytes,
    filename: str,
    db: Session,
    source: str = "local_csv_upload"
) -> Dict[str, Any]:
    """
    Genuine data pipeline execution:
    1. Raw file staging
    2. Schema validation
    3. Type conversion & range validation
    4. Physical consistency auditing (consumption <= prep, waste <= leftovers)
    5. Duplicate record detection
    6. Processed dataset saving
    7. Database insertion with provenance tracking
    8. Pipeline audit logging
    """
    start_time = time.time()
    exec_id = f"PIPE-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
    
    # 1. Raw file staging
    raw_dir = settings.DATA_DIR / "raw_uploads"
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_file_path = raw_dir / f"{exec_id}_{filename}"
    with open(raw_file_path, "wb") as f:
        f.write(file_bytes)
        
    errors: List[str] = []
    valid_rows = []
    rejected_count = 0
    
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        err_msg = f"Failed to parse CSV file: {str(e)}"
        record_execution(
            db, exec_id, filename, len(file_bytes), source, "failed",
            0, 0, 0, duration_ms, err_msg, None
        )
        return {
            "execution_id": exec_id,
            "status": "failed",
            "total_records": 0,
            "valid_records": 0,
            "rejected_records": 0,
            "errors": [err_msg],
            "duration_ms": duration_ms,
        }
        
    total_records = len(df)
    
    # 2. Required columns check
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        err_msg = f"Missing mandatory schema columns: {', '.join(missing_cols)}"
        errors.append(err_msg)
        duration_ms = int((time.time() - start_time) * 1000)
        record_execution(
            db, exec_id, filename, len(file_bytes), source, "failed",
            total_records, 0, total_records, duration_ms, err_msg, None
        )
        return {
            "execution_id": exec_id,
            "status": "failed",
            "total_records": total_records,
            "valid_records": 0,
            "rejected_records": total_records,
            "errors": errors,
            "duration_ms": duration_ms,
        }
        
    # 3. Check for duplicates within upload
    key_cols = ["date", "cafeteria_id", "food_item_id"]
    dup_mask = df.duplicated(subset=key_cols, keep=False)
    if dup_mask.any():
        num_dups = int(dup_mask.sum())
        errors.append(f"Detected {num_dups} duplicate records with identical (date, cafeteria_id, food_item_id). Deduplicating...")
        df = df.drop_duplicates(subset=key_cols, keep="first")
        
    # 4. Row-level validation and consistency enforcement
    cleaned_rows = []
    for idx, row in df.iterrows():
        row_errs = []
        
        # Date format check
        try:
            datetime.strptime(str(row["date"]), "%Y-%m-%d")
        except Exception:
            row_errs.append(f"Row {idx+1}: Invalid date format '{row.get('date')}'. Must be YYYY-MM-DD.")
            
        # Actual demand numeric
        try:
            demand = float(row["actual_demand"])
            if demand < 0:
                row_errs.append(f"Row {idx+1}: Negative actual_demand ({demand})")
        except Exception:
            row_errs.append(f"Row {idx+1}: Non-numeric actual_demand '{row.get('actual_demand')}'")
            demand = 0.0
            
        # Preparation and consumption consistency
        planned_prep = float(row.get("planned_preparation_qty", demand * 1.1))
        actual_prep = float(row.get("actual_prepared_qty", planned_prep))
        actual_cons = float(row.get("actual_consumption", min(actual_prep, demand)))
        leftover = float(row.get("leftover_qty", max(0.0, actual_prep - actual_cons)))
        waste = float(row.get("wasted_qty", leftover * 0.3))
        
        if actual_cons > actual_prep + 1e-4:
            row_errs.append(f"Row {idx+1}: Physical inconsistency - consumption ({actual_cons}) exceeds prepared ({actual_prep}).")
            
        if leftover < -1e-4:
            row_errs.append(f"Row {idx+1}: Negative leftover quantity ({leftover}).")
            
        if waste > leftover + 1e-4:
            row_errs.append(f"Row {idx+1}: Waste ({waste}) exceeds leftovers ({leftover}).")
            
        if row_errs:
            errors.extend(row_errs[:2])  # Include first couple
            rejected_count += 1
        else:
            cleaned_row = dict(row)
            cleaned_row["planned_preparation_qty"] = planned_prep
            cleaned_row["actual_prepared_qty"] = actual_prep
            cleaned_row["actual_consumption"] = actual_cons
            cleaned_row["leftover_qty"] = leftover
            cleaned_row["wasted_qty"] = waste
            cleaned_row["source"] = source
            cleaned_row["is_synthetic"] = 0 if source == "local_csv_upload" else 1
            cleaned_rows.append(cleaned_row)
            
    valid_count = len(cleaned_rows)
    
    # 5. Save cleaned/transformed dataset
    processed_file_path = None
    if valid_count > 0:
        cleaned_df = pd.DataFrame(cleaned_rows)
        processed_dir = settings.PROCESSED_DATA_DIR
        processed_dir.mkdir(parents=True, exist_ok=True)
        processed_file_path = processed_dir / f"processed_{exec_id}.csv"
        cleaned_df.to_csv(processed_file_path, index=False)
        
        # 6. Database ingestion
        for item in cleaned_rows:
            food_item_id = str(item["food_item_id"])
            food_name = str(item.get("food_name", food_item_id))
            category = str(item.get("food_category", "General"))
            unit = str(item.get("unit", "kg"))
            cost = float(item.get("unit_cost", 2.50))
            
            # Ensure FoodItem exists
            food_exists = db.query(FoodItem).filter(FoodItem.id == food_item_id).first()
            if not food_exists:
                new_food = FoodItem(
                    id=food_item_id,
                    name=food_name,
                    category=category,
                    unit=unit,
                    unit_cost=cost,
                )
                db.add(new_food)
                db.commit()
                
            # Insert into DemandHistory
            dh = DemandHistory(
                record_id=f"IMP-{uuid.uuid4().hex[:8]}",
                date=str(item["date"]),
                cafeteria_id=str(item["cafeteria_id"]),
                food_item_id=food_item_id,
                food_name=food_name,
                food_category=category,
                day_of_week=str(item.get("day_of_week", "Wednesday")),
                is_weekend=bool(item.get("is_weekend", 0)),
                is_holiday=bool(item.get("is_holiday", 0)),
                is_special_event=bool(item.get("is_special_event", 0)),
                weather_condition=str(item.get("weather_condition", "Sunny")),
                temperature_c=float(item.get("temperature_c", 22.0)),
                expected_customer_count=int(item.get("expected_customer_count", 800)),
                actual_demand=float(item["actual_demand"]),
                planned_preparation_qty=float(item["planned_preparation_qty"]),
                actual_prepared_qty=float(item["actual_prepared_qty"]),
                actual_consumption=float(item["actual_consumption"]),
                leftover_qty=float(item["leftover_qty"]),
                wasted_qty=float(item["wasted_qty"]),
                unit=unit,
                unit_cost=cost,
                total_waste_cost=round(float(item["wasted_qty"]) * cost, 2),
                is_synthetic=bool(item["is_synthetic"]),
                source=source,
            )
            db.add(dh)
            
            # If waste was recorded, log into waste_records
            if float(item["wasted_qty"]) > 0:
                wr = WasteRecord(
                    cafeteria_id=str(item["cafeteria_id"]),
                    food_item_id=food_item_id,
                    food_name=food_name,
                    record_date=str(item["date"]),
                    wasted_qty=float(item["wasted_qty"]),
                    unit=unit,
                    unit_cost=cost,
                    financial_cost=round(float(item["wasted_qty"]) * cost, 2),
                    waste_reason="overpreparation",
                    is_preventable=True,
                    is_synthetic=bool(item["is_synthetic"]),
                )
                db.add(wr)
                
        db.commit()
        
    duration_ms = int((time.time() - start_time) * 1000)
    final_status = "completed" if valid_count > 0 else "failed"
    err_summary = "; ".join(errors[:5]) if errors else None
    
    record_execution(
        db, exec_id, filename, len(file_bytes), source, final_status,
        total_records, valid_count, rejected_count, duration_ms,
        err_summary, str(processed_file_path) if processed_file_path else None
    )
    
    return {
        "execution_id": exec_id,
        "filename": filename,
        "status": final_status,
        "total_records": total_records,
        "valid_records": valid_count,
        "rejected_records": rejected_count,
        "duration_ms": duration_ms,
        "errors": errors[:10],
        "processed_file": str(processed_file_path) if processed_file_path else None,
    }

def record_execution(
    db: Session,
    exec_id: str,
    filename: str,
    file_size: int,
    source: str,
    status: str,
    total: int,
    valid: int,
    rejected: int,
    duration_ms: int,
    err_summary: Optional[str],
    processed_path: Optional[str],
):
    """Saves pipeline execution record to database."""
    try:
        pe = PipelineExecution(
            execution_id=exec_id,
            filename=filename,
            file_size_bytes=file_size,
            source=source,
            status=status,
            total_records=total,
            valid_records=valid,
            rejected_records=rejected,
            duration_ms=duration_ms,
            error_summary=err_summary,
            processed_dataset_path=processed_path,
        )
        db.add(pe)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Warning: Failed to save pipeline execution: {e}")
