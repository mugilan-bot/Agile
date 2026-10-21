from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# Cafeteria Schemas
class CafeteriaBase(BaseModel):
    id: str
    name: str
    location: str
    seating_capacity: int = 300
    avg_daily_traffic: int = 1200
    contact_email: Optional[str] = None
    is_active: bool = True

class CafeteriaCreate(CafeteriaBase):
    pass

class CafeteriaResponse(CafeteriaBase):
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# Food Item Schemas
class FoodItemBase(BaseModel):
    id: str
    name: str
    category: str
    unit: str
    default_shelf_life_hours: int = 24
    unit_cost: float = 2.50
    storage_type: str = "hot_holding"
    is_active: bool = True

class FoodItemCreate(FoodItemBase):
    pass

class FoodItemResponse(FoodItemBase):
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# Inventory Schemas
class InventoryItemBase(BaseModel):
    cafeteria_id: str
    food_item_id: str
    batch_number: Optional[str] = None
    quantity: float = Field(..., ge=0, description="Current usable quantity")
    unit: str
    prepared_qty: float = Field(default=0.0, ge=0)
    consumed_qty: float = Field(default=0.0, ge=0)
    leftover_qty: float = Field(default=0.0, ge=0)
    waste_qty: float = Field(default=0.0, ge=0)
    prep_date: str
    expiry_date: str
    storage_type: str = "refrigerated"
    status: str = "usable"
    notes: Optional[str] = None

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemUpdate(BaseModel):
    quantity: Optional[float] = None
    consumed_qty: Optional[float] = None
    leftover_qty: Optional[float] = None
    waste_qty: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class InventoryItemResponse(InventoryItemBase):
    id: int
    food_name: Optional[str] = None
    surplus_qty: float = 0.0
    allocated_qty: float = 0.0
    is_synthetic: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# Prediction Schemas
class PredictionRequest(BaseModel):
    cafeteria_id: str
    food_item_id: str
    target_date: str  # YYYY-MM-DD
    expected_customer_count: int = Field(..., ge=1, le=10000)
    day_of_week: Optional[str] = None
    is_holiday: bool = False
    is_special_event: bool = False
    weather_condition: str = "Sunny"
    temperature_c: float = 22.0
    safety_buffer_pct: Optional[float] = Field(default=0.10, ge=0.0, le=0.50)

class PredictionFactor(BaseModel):
    factor: str
    impact: str
    description: str

class PredictionResponse(BaseModel):
    cafeteria_id: str
    food_item_id: str
    food_name: str
    target_date: str
    expected_customer_count: int
    predicted_demand: float
    recommended_prep: float
    safety_buffer_pct: float
    buffer_added_qty: float
    existing_usable_inventory: float
    net_preparation_needed: float
    surplus_risk_level: str
    unit: str
    model_version: str
    model_mae: float
    model_rmse: float
    model_r2: float
    factors: List[PredictionFactor]
    is_synthetic: bool = True
    explanation: str

# Waste Schemas
class WasteRecordCreate(BaseModel):
    cafeteria_id: str
    food_item_id: str
    record_date: str
    wasted_qty: float = Field(..., gt=0)
    unit: str
    waste_reason: str = "overpreparation"
    unit_cost: Optional[float] = 2.50
    is_preventable: bool = True
    notes: Optional[str] = None

class WasteRecordResponse(BaseModel):
    id: int
    cafeteria_id: str
    food_item_id: str
    food_name: Optional[str] = None
    record_date: str
    wasted_qty: float
    unit: str
    waste_reason: str
    unit_cost: float
    financial_cost: float
    is_preventable: bool
    notes: Optional[str] = None
    is_synthetic: bool = True
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# Recipient Schemas
class RecipientBase(BaseModel):
    id: str
    name: str
    org_type: str = "food_bank"
    contact_person: str
    contact_email: str
    contact_phone: Optional[str] = None
    address: str
    accepted_categories: str = "Grains,Proteins,Bakery,Soups"
    storage_capacity_kg: float = 250.0
    current_stored_kg: float = 0.0
    allows_pickup: bool = True
    operates_weekends: bool = True
    min_shelf_life_hours: int = 6
    distance_km: float = 4.5
    active_status: bool = True
    eligibility_notes: Optional[str] = None

class RecipientCreate(RecipientBase):
    pass

class RecipientResponse(RecipientBase):
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# Redistribution Matching & Allocation Schemas
class MatchCandidate(BaseModel):
    recipient_id: str
    recipient_name: str
    org_type: str
    distance_km: float
    available_capacity_kg: float
    compatibility_score: float
    pickup_available: bool
    is_recommended: bool
    reasons: List[str]

class SurplusMatchResponse(BaseModel):
    inventory_item_id: int
    batch_number: str
    food_item_id: str
    food_name: str
    category: str
    available_surplus_qty: float
    unit: str
    safe_use_remaining_hours: float
    storage_type: str
    candidates: List[MatchCandidate]

class RedistributionAllocateRequest(BaseModel):
    inventory_item_id: int
    recipient_id: str
    quantity: float = Field(..., gt=0)
    scheduled_pickup: Optional[str] = None
    notes: Optional[str] = None

class RedistributionTransactionResponse(BaseModel):
    id: int
    transaction_code: str
    cafeteria_id: str
    recipient_id: str
    recipient_name: Optional[str] = None
    food_name: str
    quantity: float
    unit: str
    matched_date: str
    scheduled_pickup: Optional[str] = None
    status: str
    match_score: float
    match_reason: Optional[str] = None
    donor_notes: Optional[str] = None
    is_synthetic: bool = True
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# Pipeline Schemas
class PipelineExecutionResponse(BaseModel):
    id: int
    execution_id: str
    filename: str
    file_size_bytes: int
    source: str
    status: str
    total_records: int
    valid_records: int
    rejected_records: int
    duration_ms: int
    error_summary: Optional[str] = None
    executed_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# Model Metrics Schemas
class ModelVersionResponse(BaseModel):
    version_tag: str
    algorithm: str
    train_samples_count: int
    test_samples_count: int
    mae: float
    rmse: float
    r2: float
    is_active: bool
    trained_at: datetime
    evaluation_notes: Optional[str] = None
    class Config:
        from_attributes = True

class RetrainRequest(BaseModel):
    target_algorithm: Optional[str] = "RandomForestRegressor"
    min_improvement_pct: Optional[float] = 1.0  # Must be >= 1% better to promote
    force_promote: Optional[bool] = False

class RetrainResponse(BaseModel):
    status: str  # promoted, rejected, insufficient_data
    candidate_version: str
    active_version: str
    candidate_mae: float
    candidate_rmse: float
    active_mae: float
    active_rmse: float
    samples_used: int
    message: str

# Dashboard Summary Schema
class DashboardSummaryResponse(BaseModel):
    forecast_demand_today: float
    planned_preparation_today: float
    actual_consumption_today: float
    estimated_leftovers_today: float
    waste_percentage: float
    waste_cost_total: float
    surplus_available_qty: float
    redistributed_food_qty: float
    active_cafeterias_count: int
    active_recipients_count: int
    total_inventory_items: int
    high_risk_items: List[Dict[str, Any]]
    predicted_vs_actual_trend: List[Dict[str, Any]]
    waste_by_category: List[Dict[str, Any]]
    daily_waste_trend: List[Dict[str, Any]]
    recent_pipeline_runs: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]]
    is_synthetic: bool = True

class AppSettingItem(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class AppSettingUpdate(BaseModel):
    settings: Dict[str, str]
