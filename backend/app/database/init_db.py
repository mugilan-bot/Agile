import json
from datetime import datetime, timedelta
from pathlib import Path
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.session import engine, SessionLocal, Base
from backend.app.models.models import (
    User, Cafeteria, FoodItem, DemandHistory, InventoryItem,
    RecipientOrganization, ModelVersionRecord, AppSetting,
    PipelineExecution, RedistributionTransaction, WasteRecord
)
from backend.app.ml.generate_dataset import (
    CAFETERIAS, FOOD_ITEMS, generate_and_save_dataset
)

DEFAULT_RECIPIENTS = [
    {
        "id": "RECIP-HOPE-SHELTER",
        "name": "Hope City Mission Shelter",
        "org_type": "shelter",
        "contact_person": "Sarah Jenkins",
        "contact_email": "sarah.jenkins@hopeshelter.org",
        "contact_phone": "+1 (555) 234-5678",
        "address": "452 Elm Street, Downtown",
        "accepted_categories": "Grains,Proteins,Bakery,Soups,Salads,Vegetables",
        "storage_capacity_kg": 350.0,
        "current_stored_kg": 110.0,
        "allows_pickup": True,
        "operates_weekends": True,
        "min_shelf_life_hours": 6,
        "distance_km": 3.2,
        "eligibility_notes": "Licensed kitchen shelter serving 180 evening meals daily. Can accept warm or chilled foods.",
    },
    {
        "id": "RECIP-CAMPUS-PANTRY",
        "name": "Campus Student Food Pantry",
        "org_type": "student_pantry",
        "contact_person": "Marcus Vance",
        "contact_email": "pantry@university.edu",
        "contact_phone": "+1 (555) 345-6789",
        "address": "Student Union Building, Room 104",
        "accepted_categories": "Bakery,Grains,Proteins,Vegetables",
        "storage_capacity_kg": 200.0,
        "current_stored_kg": 65.0,
        "allows_pickup": True,
        "operates_weekends": False,
        "min_shelf_life_hours": 12,
        "distance_km": 0.8,
        "eligibility_notes": "Immediate on-campus distribution to enrolled students facing food insecurity.",
    },
    {
        "id": "RECIP-METRO-BANK",
        "name": "Metro Regional Food Bank",
        "org_type": "food_bank",
        "contact_person": "David Wu",
        "contact_email": "david.wu@metrofoodbank.org",
        "contact_phone": "+1 (555) 456-7890",
        "address": "1200 Industrial Parkway, Warehouse 4",
        "accepted_categories": "Grains,Proteins,Bakery,Soups,Vegetables",
        "storage_capacity_kg": 850.0,
        "current_stored_kg": 320.0,
        "allows_pickup": True,
        "operates_weekends": True,
        "min_shelf_life_hours": 10,
        "distance_km": 7.5,
        "eligibility_notes": "Large regional refrigerated warehouse with daily collection truck fleet.",
    },
    {
        "id": "RECIP-ST-MARK-SOUP",
        "name": "St. Mark's Community Kitchen",
        "org_type": "soup_kitchen",
        "contact_person": "Father Thomas",
        "contact_email": "thomas@stmarkskitchen.org",
        "contact_phone": "+1 (555) 567-8901",
        "address": "88 Church St, Northside",
        "accepted_categories": "Soups,Grains,Proteins,Bakery",
        "storage_capacity_kg": 180.0,
        "current_stored_kg": 75.0,
        "allows_pickup": False,
        "operates_weekends": True,
        "min_shelf_life_hours": 4,
        "distance_km": 4.1,
        "eligibility_notes": "Requires donor drop-off. Prepares hot lunchtime community meals at 12:30 PM.",
    },
    {
        "id": "RECIP-EASTSIDE-YOUTH",
        "name": "Eastside Youth Center",
        "org_type": "ngo",
        "contact_person": "Elena Gomez",
        "contact_email": "elena@eastsideyouth.org",
        "contact_phone": "+1 (555) 678-9012",
        "address": "320 Oak Avenue",
        "accepted_categories": "Bakery,Proteins,Salads,Vegetables",
        "storage_capacity_kg": 120.0,
        "current_stored_kg": 40.0,
        "allows_pickup": True,
        "operates_weekends": False,
        "min_shelf_life_hours": 8,
        "distance_km": 5.4,
        "eligibility_notes": "After-school tutoring and teen evening meal support program.",
    },
]

def init_db(db: Session = None):
    """Initializes tables and seeds core reference entities and synthetic history."""
    close_db = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_db = True
        
    try:
        # 1. Seed Cafeterias
        for c in CAFETERIAS:
            caf = db.query(Cafeteria).filter(Cafeteria.id == c["id"]).first()
            if not caf:
                new_c = Cafeteria(
                    id=c["id"],
                    name=c["name"],
                    location="Campus Campus Main Grounds",
                    seating_capacity=c["capacity"],
                    avg_daily_traffic=c["base_customers"],
                    contact_email=f"{c['id'].lower()}@dining.university.edu",
                    is_active=True,
                )
                db.add(new_c)
                
        # 2. Seed Food Items
        for item in FOOD_ITEMS:
            fi = db.query(FoodItem).filter(FoodItem.id == item["id"]).first()
            if not fi:
                new_fi = FoodItem(
                    id=item["id"],
                    name=item["name"],
                    category=item["category"],
                    unit=item["unit"],
                    unit_cost=item["cost"],
                    default_shelf_life_hours=18 if item["category"] in ["Salads", "Soups"] else 36,
                    storage_type="refrigerated" if item["category"] in ["Proteins", "Salads"] else ("hot_holding" if item["category"] in ["Soups", "Grains"] else "dry"),
                    is_active=True,
                )
                db.add(new_fi)
                
        # 3. Seed Recipients
        for r in DEFAULT_RECIPIENTS:
            recip = db.query(RecipientOrganization).filter(RecipientOrganization.id == r["id"]).first()
            if not recip:
                new_r = RecipientOrganization(**r)
                db.add(new_r)
                
        # 4. Seed Settings
        default_settings = [
            ("default_prep_buffer", "0.10", "Default safety buffer added to demand forecast"),
            ("waste_alert_threshold_pct", "8.0", "Waste percentage above which alerts trigger"),
            ("app_mode", "Local Development", "Operational mode (Local Development vs Azure Cloud)"),
            ("auto_retrain_enabled", "true", "Whether model checks for retraining feasibility"),
        ]
        for key, val, desc in default_settings:
            sett = db.query(AppSetting).filter(AppSetting.key == key).first()
            if not sett:
                db.add(AppSetting(key=key, value=val, description=desc))
                
        # 5. Seed Users
        admin_user = db.query(User).filter(User.email == "admin@foodflow.org").first()
        if not admin_user:
            db.add(User(email="admin@foodflow.org", full_name="FoodFlow Administrator", role="admin"))
            db.add(User(email="manager@centraldining.edu", full_name="Chef Maria Alvarez", role="manager"))
            db.add(User(email="redistribution@foodflow.org", full_name="Alex Rivera", role="coordinator"))
            
        db.commit()
        
        # 6. Check Demand History & Seed from Synthetic Dataset if empty
        history_count = db.query(DemandHistory).count()
        if history_count == 0:
            csv_path = settings.GENERATED_DATA_DIR / "synthetic_food_demand_dataset.csv"
            if not csv_path.exists():
                print("Synthetic dataset not found. Generating now...")
                generate_and_save_dataset(num_records=5000)
                
            print("Seeding DemandHistory from synthetic dataset...")
            df = pd.read_csv(csv_path)
            
            # Insert in chunks for high performance
            chunk_size = 500
            for i in range(0, len(df), chunk_size):
                chunk = df.iloc[i : i + chunk_size]
                records = []
                waste_records = []
                for _, row in chunk.iterrows():
                    dh = DemandHistory(
                        record_id=str(row["record_id"]),
                        date=str(row["date"]),
                        cafeteria_id=str(row["cafeteria_id"]),
                        food_item_id=str(row["food_item_id"]),
                        food_name=str(row["food_name"]),
                        food_category=str(row["food_category"]),
                        day_of_week=str(row["day_of_week"]),
                        is_weekend=bool(row["is_weekend"]),
                        is_holiday=bool(row["is_holiday"]),
                        is_special_event=bool(row["is_special_event"]),
                        weather_condition=str(row["weather_condition"]),
                        temperature_c=float(row["temperature_c"]),
                        expected_customer_count=int(row["expected_customer_count"]),
                        historical_customer_count=int(row.get("historical_customer_count", row["expected_customer_count"])),
                        recent_avg_demand=float(row["recent_avg_demand"]),
                        historical_food_demand=float(row.get("historical_food_demand", row["recent_avg_demand"])),
                        actual_demand=float(row["actual_demand"]),
                        planned_preparation_qty=float(row["planned_preparation_qty"]),
                        actual_prepared_qty=float(row["actual_prepared_qty"]),
                        actual_consumption=float(row["actual_consumption"]),
                        leftover_qty=float(row["leftover_qty"]),
                        wasted_qty=float(row["wasted_qty"]),
                        unit=str(row["unit"]),
                        unit_cost=float(row["unit_cost"]),
                        total_waste_cost=float(row["total_waste_cost"]),
                        is_synthetic=True,
                        source="synthetic",
                    )
                    records.append(dh)
                    
                    if float(row["wasted_qty"]) > 0:
                        wr = WasteRecord(
                            cafeteria_id=str(row["cafeteria_id"]),
                            food_item_id=str(row["food_item_id"]),
                            food_name=str(row["food_name"]),
                            record_date=str(row["date"]),
                            wasted_qty=float(row["wasted_qty"]),
                            unit=str(row["unit"]),
                            unit_cost=float(row["unit_cost"]),
                            financial_cost=float(row["total_waste_cost"]),
                            waste_reason="overpreparation",
                            is_preventable=True,
                            is_synthetic=True,
                        )
                        waste_records.append(wr)
                        
                db.bulk_save_objects(records)
                if waste_records:
                    db.bulk_save_objects(waste_records)
                db.commit()
            print(f"Successfully seeded {len(df)} demand history records.")
            
        # 7. Seed Active Inventory & Available Surplus Batches
        inv_count = db.query(InventoryItem).count()
        if inv_count == 0:
            print("Seeding active inventory batches...")
            now = datetime.utcnow()
            today_str = now.strftime("%Y-%m-%d")
            
            sample_batches = [
                {
                    "batch_number": "BATCH-2026-001",
                    "cafeteria_id": "CAF-CENTRAL",
                    "food_item_id": "ITEM-JASMINE-RICE",
                    "quantity": 35.0,
                    "unit": "kg",
                    "prepared_qty": 140.0,
                    "consumed_qty": 105.0,
                    "leftover_qty": 35.0,
                    "surplus_qty": 25.0,
                    "allocated_qty": 0.0,
                    "prep_date": today_str,
                    "expiry_date": (now + timedelta(hours=14)).isoformat(),
                    "storage_type": "hot_holding",
                    "status": "surplus",
                    "notes": "Lunch surplus held at safe temperature. Excellent condition for redistribution.",
                },
                {
                    "batch_number": "BATCH-2026-002",
                    "cafeteria_id": "CAF-CENTRAL",
                    "food_item_id": "ITEM-GRILLED-CHICKEN",
                    "quantity": 18.0,
                    "unit": "kg",
                    "prepared_qty": 150.0,
                    "consumed_qty": 132.0,
                    "leftover_qty": 18.0,
                    "surplus_qty": 18.0,
                    "allocated_qty": 0.0,
                    "prep_date": today_str,
                    "expiry_date": (now + timedelta(hours=18)).isoformat(),
                    "storage_type": "refrigerated",
                    "status": "surplus",
                    "notes": "Chilled herb chicken strips rapidly cooled in blast chiller.",
                },
                {
                    "batch_number": "BATCH-2026-003",
                    "cafeteria_id": "CAF-NORTH",
                    "food_item_id": "ITEM-TOMATO-BASIL",
                    "quantity": 22.0,
                    "unit": "liters",
                    "prepared_qty": 70.0,
                    "consumed_qty": 48.0,
                    "leftover_qty": 22.0,
                    "surplus_qty": 22.0,
                    "allocated_qty": 0.0,
                    "prep_date": today_str,
                    "expiry_date": (now + timedelta(hours=10)).isoformat(),
                    "storage_type": "hot_holding",
                    "status": "surplus",
                    "notes": "Creamy tomato soup packaged in sanitary insulated cambros.",
                },
                {
                    "batch_number": "BATCH-2026-004",
                    "cafeteria_id": "CAF-NORTH",
                    "food_item_id": "ITEM-DINNER-ROLLS",
                    "quantity": 65.0,
                    "unit": "portions",
                    "prepared_qty": 200.0,
                    "consumed_qty": 135.0,
                    "leftover_qty": 65.0,
                    "surplus_qty": 65.0,
                    "allocated_qty": 0.0,
                    "prep_date": today_str,
                    "expiry_date": (now + timedelta(hours=36)).isoformat(),
                    "storage_type": "dry",
                    "status": "surplus",
                    "notes": "Freshly baked dinner rolls boxed in dry bakery packaging.",
                },
                {
                    "batch_number": "BATCH-2026-005",
                    "cafeteria_id": "CAF-SOUTH",
                    "food_item_id": "ITEM-PENNE-PASTA",
                    "quantity": 28.0,
                    "unit": "kg",
                    "prepared_qty": 90.0,
                    "consumed_qty": 62.0,
                    "leftover_qty": 28.0,
                    "surplus_qty": 20.0,
                    "allocated_qty": 0.0,
                    "prep_date": today_str,
                    "expiry_date": (now + timedelta(hours=16)).isoformat(),
                    "storage_type": "refrigerated",
                    "status": "surplus",
                    "notes": "Whole wheat pasta ready for immediate meal assembly.",
                },
                {
                    "batch_number": "BATCH-2026-006",
                    "cafeteria_id": "CAF-EAST",
                    "food_item_id": "ITEM-ROASTED-BROCCOLI",
                    "quantity": 14.0,
                    "unit": "kg",
                    "prepared_qty": 55.0,
                    "consumed_qty": 41.0,
                    "leftover_qty": 14.0,
                    "surplus_qty": 14.0,
                    "allocated_qty": 0.0,
                    "prep_date": today_str,
                    "expiry_date": (now + timedelta(hours=12)).isoformat(),
                    "storage_type": "refrigerated",
                    "status": "surplus",
                    "notes": "Steamed garlic broccoli seasoned and refrigerated.",
                },
            ]
            for b in sample_batches:
                db.add(InventoryItem(**b, is_synthetic=True))
            db.commit()
            
        # 8. Seed Initial Model Version Record
        mv_count = db.query(ModelVersionRecord).count()
        if mv_count == 0:
            metadata_path = settings.MODELS_DIR / "model_metadata.json"
            if metadata_path.exists():
                with open(metadata_path, "r") as f:
                    meta = json.load(f)
                mv = ModelVersionRecord(
                    version_tag=meta.get("version_tag", "v1.0"),
                    algorithm=meta.get("algorithm", "RandomForestRegressor(n_estimators=100, max_depth=12)"),
                    train_samples_count=meta.get("train_samples_count", 4020),
                    test_samples_count=meta.get("test_samples_count", 980),
                    mae=meta.get("mae", 7.028),
                    rmse=meta.get("rmse", 11.588),
                    r2=meta.get("r2", 0.9787),
                    is_active=True,
                    artifact_path=str(settings.MODELS_DIR / meta.get("artifact_file", "demand_model_v1.0.joblib")),
                    evaluation_notes="Initial baseline and Random Forest model trained on chronological split.",
                )
                db.add(mv)
                db.commit()
                
        # 9. Seed Initial Pipeline Execution Log
        pipe_count = db.query(PipelineExecution).count()
        if pipe_count == 0:
            pe = PipelineExecution(
                execution_id="PIPE-INIT-SYNTHETIC-001",
                filename="synthetic_food_demand_dataset.csv",
                file_size_bytes=485000,
                source="synthetic_generator",
                status="completed",
                total_records=5000,
                valid_records=5000,
                rejected_records=0,
                duration_ms=450,
                error_summary=None,
                processed_dataset_path=str(settings.GENERATED_DATA_DIR / "synthetic_food_demand_dataset.csv"),
            )
            db.add(pe)
            db.commit()
            
        # 10. Seed Sample Completed Redistribution Transaction
        tx_count = db.query(RedistributionTransaction).count()
        if tx_count == 0:
            tx = RedistributionTransaction(
                transaction_code="TX-20261020-0001-HOPE",
                cafeteria_id="CAF-CENTRAL",
                recipient_id="RECIP-HOPE-SHELTER",
                food_item_id="ITEM-JASMINE-RICE",
                food_name="Steamed Jasmine Rice",
                quantity=20.0,
                unit="kg",
                matched_date=(datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d"),
                scheduled_pickup=(datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d 15:30"),
                status="completed",
                match_score=96.0,
                match_reason="Capacity, category compatibility, and rapid pickup matched successfully.",
                donor_notes="Delivered to Hope Shelter vehicle.",
                recipient_notes="Received in hot insulated containers, served for dinner service.",
                is_synthetic=True,
                completed_at=datetime.utcnow() - timedelta(days=1),
            )
            db.add(tx)
            db.commit()
            
        print("Database initialization complete.")
    finally:
        if close_db:
            db.close()

if __name__ == "__main__":
    init_db()
