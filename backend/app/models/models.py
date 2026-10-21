from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Index
)
from sqlalchemy.orm import relationship
from backend.app.database.session import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="manager")  # admin, manager, coordinator, auditor
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Cafeteria(Base):
    __tablename__ = "cafeterias"
    
    id = Column(String(50), primary_key=True, index=True)  # e.g., 'CAF-CENTRAL', 'CAF-NORTH'
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    seating_capacity = Column(Integer, default=300)
    avg_daily_traffic = Column(Integer, default=1200)
    contact_email = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    demand_records = relationship("DemandHistory", back_populates="cafeteria")
    inventory_items = relationship("InventoryItem", back_populates="cafeteria")

class FoodItem(Base):
    __tablename__ = "food_items"
    
    id = Column(String(50), primary_key=True, index=True)  # e.g., 'ITEM-RICE-BOWL'
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)  # Grains, Proteins, Soups, Salads, Bakery, Dairy, Desserts
    unit = Column(String(50), nullable=False)  # kg, portions, liters, trays
    default_shelf_life_hours = Column(Integer, default=24)
    unit_cost = Column(Float, default=2.50)  # In USD / currency
    storage_type = Column(String(50), default="hot_holding")  # hot_holding, refrigerated, dry, frozen
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    demand_records = relationship("DemandHistory", back_populates="food_item")
    inventory_items = relationship("InventoryItem", back_populates="food_item")

class DemandHistory(Base):
    __tablename__ = "demand_history"
    
    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(String(100), unique=True, index=True, nullable=True)
    date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    cafeteria_id = Column(String(50), ForeignKey("cafeterias.id"), nullable=False, index=True)
    food_item_id = Column(String(50), ForeignKey("food_items.id"), nullable=False, index=True)
    food_name = Column(String(255), nullable=True)
    food_category = Column(String(100), nullable=True)
    
    day_of_week = Column(String(20), nullable=False)  # Monday, Tuesday...
    is_weekend = Column(Boolean, default=False)
    is_holiday = Column(Boolean, default=False)
    is_special_event = Column(Boolean, default=False)
    weather_condition = Column(String(50), default="Sunny")  # Sunny, Rainy, Cloudy, Cold
    temperature_c = Column(Float, default=22.0)
    
    expected_customer_count = Column(Integer, nullable=False)
    historical_customer_count = Column(Integer, nullable=True)
    recent_avg_demand = Column(Float, default=0.0)
    historical_food_demand = Column(Float, default=0.0)
    
    actual_demand = Column(Float, nullable=False)
    planned_preparation_qty = Column(Float, nullable=False)
    actual_prepared_qty = Column(Float, nullable=False)
    actual_consumption = Column(Float, nullable=False)
    leftover_qty = Column(Float, default=0.0)
    wasted_qty = Column(Float, default=0.0)
    unit = Column(String(50), nullable=False)
    unit_cost = Column(Float, default=2.50)
    total_waste_cost = Column(Float, default=0.0)
    
    is_synthetic = Column(Boolean, default=True, index=True)
    source = Column(String(50), default="synthetic")  # synthetic, csv_import, user_manual
    created_at = Column(DateTime, default=datetime.utcnow)

    cafeteria = relationship("Cafeteria", back_populates="demand_records")
    food_item = relationship("FoodItem", back_populates="demand_records")

    __table_args__ = (
        Index("idx_demand_date_caf", "date", "cafeteria_id"),
        Index("idx_demand_item_date", "food_item_id", "date"),
    )

class InventoryItem(Base):
    __tablename__ = "inventory_items"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(100), unique=True, index=True, nullable=False)
    cafeteria_id = Column(String(50), ForeignKey("cafeterias.id"), nullable=False, index=True)
    food_item_id = Column(String(50), ForeignKey("food_items.id"), nullable=False, index=True)
    
    quantity = Column(Float, nullable=False)  # Current usable quantity
    unit = Column(String(50), nullable=False)
    prepared_qty = Column(Float, default=0.0)
    consumed_qty = Column(Float, default=0.0)
    leftover_qty = Column(Float, default=0.0)
    waste_qty = Column(Float, default=0.0)
    surplus_qty = Column(Float, default=0.0)  # Identified as surplus available for redistribution
    allocated_qty = Column(Float, default=0.0)  # Reserved for redistribution to prevent double allocation
    
    prep_date = Column(String(20), nullable=False)  # YYYY-MM-DD
    expiry_date = Column(String(30), nullable=False)  # ISO DateTime or YYYY-MM-DD HH:MM
    storage_type = Column(String(50), default="refrigerated")
    status = Column(String(50), default="usable", index=True)  # usable, surplus, allocated, redistributed, waste
    
    is_synthetic = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cafeteria = relationship("Cafeteria", back_populates="inventory_items")
    food_item = relationship("FoodItem", back_populates="inventory_items")

class PredictionRecord(Base):
    __tablename__ = "prediction_records"
    
    id = Column(Integer, primary_key=True, index=True)
    cafeteria_id = Column(String(50), nullable=False, index=True)
    food_item_id = Column(String(50), nullable=False, index=True)
    food_name = Column(String(255), nullable=True)
    target_date = Column(String(20), nullable=False, index=True)
    expected_customer_count = Column(Integer, nullable=False)
    
    predicted_demand = Column(Float, nullable=False)
    recommended_prep = Column(Float, nullable=False)
    safety_buffer_pct = Column(Float, default=0.10)
    existing_usable_inventory = Column(Float, default=0.0)
    surplus_risk_level = Column(String(20), default="low")  # low, medium, high
    unit = Column(String(50), default="kg")
    
    model_version = Column(String(50), default="v1.0")
    model_mae = Column(Float, nullable=True)
    model_rmse = Column(Float, nullable=True)
    factors_json = Column(Text, nullable=True)
    is_synthetic = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class WasteRecord(Base):
    __tablename__ = "waste_records"
    
    id = Column(Integer, primary_key=True, index=True)
    cafeteria_id = Column(String(50), nullable=False, index=True)
    food_item_id = Column(String(50), nullable=False, index=True)
    food_name = Column(String(255), nullable=True)
    record_date = Column(String(20), nullable=False, index=True)
    wasted_qty = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    waste_reason = Column(String(100), default="overpreparation")  # overpreparation, expired, handling, plate_waste
    unit_cost = Column(Float, default=2.50)
    financial_cost = Column(Float, default=0.0)
    is_preventable = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    is_synthetic = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class RecipientOrganization(Base):
    __tablename__ = "recipient_organizations"
    
    id = Column(String(50), primary_key=True, index=True)  # e.g., 'RECIP-HOPE-SHELTER'
    name = Column(String(255), nullable=False)
    org_type = Column(String(100), default="food_bank")  # food_bank, shelter, soup_kitchen, ngo, student_pantry
    contact_person = Column(String(255), nullable=False)
    contact_email = Column(String(255), nullable=False)
    contact_phone = Column(String(50), nullable=True)
    address = Column(String(255), nullable=False)
    accepted_categories = Column(String(255), default="Grains,Proteins,Bakery,Soups")  # Comma separated
    storage_capacity_kg = Column(Float, default=250.0)
    current_stored_kg = Column(Float, default=0.0)
    allows_pickup = Column(Boolean, default=True)
    operates_weekends = Column(Boolean, default=True)
    min_shelf_life_hours = Column(Integer, default=6)
    distance_km = Column(Float, default=4.5)
    active_status = Column(Boolean, default=True)
    eligibility_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class RedistributionTransaction(Base):
    __tablename__ = "redistribution_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_code = Column(String(100), unique=True, index=True, nullable=False)
    cafeteria_id = Column(String(50), nullable=False, index=True)
    recipient_id = Column(String(50), ForeignKey("recipient_organizations.id"), nullable=False, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=True)
    food_item_id = Column(String(50), nullable=False)
    food_name = Column(String(255), nullable=False)
    
    quantity = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    matched_date = Column(String(20), nullable=False)
    scheduled_pickup = Column(String(30), nullable=True)
    status = Column(String(50), default="matched", index=True)  # matched, scheduled, collected, completed, cancelled
    
    match_score = Column(Float, default=95.0)
    match_reason = Column(Text, nullable=True)
    donor_notes = Column(Text, nullable=True)
    recipient_notes = Column(Text, nullable=True)
    is_synthetic = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    recipient = relationship("RecipientOrganization")
    inventory_item = relationship("InventoryItem")

class PipelineExecution(Base):
    __tablename__ = "pipeline_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(String(100), unique=True, index=True, nullable=False)
    filename = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    source = Column(String(100), default="local_csv_upload")  # local_csv_upload, synthetic_generator, azure_blob
    status = Column(String(50), default="completed", index=True)  # started, validating, transforming, completed, failed
    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    rejected_records = Column(Integer, default=0)
    duration_ms = Column(Integer, default=0)
    error_summary = Column(Text, nullable=True)
    processed_dataset_path = Column(String(255), nullable=True)
    executed_at = Column(DateTime, default=datetime.utcnow)

class ModelVersionRecord(Base):
    __tablename__ = "model_version_records"
    
    id = Column(Integer, primary_key=True, index=True)
    version_tag = Column(String(50), unique=True, index=True, nullable=False)
    algorithm = Column(String(100), nullable=False)
    train_samples_count = Column(Integer, nullable=False)
    test_samples_count = Column(Integer, nullable=False)
    mae = Column(Float, nullable=False)
    rmse = Column(Float, nullable=False)
    r2 = Column(Float, nullable=False)
    is_active = Column(Boolean, default=False, index=True)
    trained_at = Column(DateTime, default=datetime.utcnow)
    artifact_path = Column(String(255), nullable=False)
    feature_names_json = Column(Text, nullable=True)
    hyperparameters_json = Column(Text, nullable=True)
    evaluation_notes = Column(Text, nullable=True)

class AppSetting(Base):
    __tablename__ = "app_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String(255), default="system")
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(100), nullable=True)
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
