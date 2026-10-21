export interface Cafeteria {
  id: string;
  name: string;
  location: string;
  seating_capacity: number;
  avg_daily_traffic: number;
  contact_email?: string;
  is_active: boolean;
}

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  default_shelf_life_hours: number;
  unit_cost: number;
  storage_type: string;
  is_active: boolean;
}

export interface InventoryItem {
  id: number;
  batch_number: string;
  cafeteria_id: string;
  food_item_id: string;
  food_name?: string;
  quantity: number;
  unit: string;
  prepared_qty: number;
  consumed_qty: number;
  leftover_qty: number;
  waste_qty: number;
  surplus_qty: number;
  allocated_qty: number;
  prep_date: string;
  expiry_date: string;
  storage_type: string;
  status: 'usable' | 'surplus' | 'allocated' | 'redistributed' | 'waste';
  notes?: string;
  is_synthetic: boolean;
  updated_at?: string;
}

export interface PredictionFactor {
  factor: string;
  impact: string;
  description: string;
}

export interface PredictionRequest {
  cafeteria_id: string;
  food_item_id: string;
  target_date: string;
  expected_customer_count: number;
  day_of_week?: string;
  is_holiday: boolean;
  is_special_event: boolean;
  weather_condition: string;
  temperature_c: number;
  safety_buffer_pct?: number;
}

export interface PredictionResponse {
  cafeteria_id: string;
  food_item_id: string;
  food_name: string;
  target_date: string;
  expected_customer_count: number;
  predicted_demand: number;
  recommended_prep: number;
  safety_buffer_pct: number;
  buffer_added_qty: number;
  existing_usable_inventory: number;
  net_preparation_needed: number;
  surplus_risk_level: 'low' | 'medium' | 'high';
  unit: string;
  model_version: string;
  model_mae: number;
  model_rmse: number;
  model_r2: number;
  factors: PredictionFactor[];
  is_synthetic: boolean;
  explanation: string;
}

export interface PredictionHistoryItem {
  id: number;
  cafeteria_id: string;
  food_item_id: string;
  food_name?: string;
  target_date: string;
  expected_customer_count: number;
  predicted_demand: number;
  recommended_prep: number;
  safety_buffer_pct: number;
  existing_usable_inventory: number;
  surplus_risk_level: string;
  unit: string;
  model_version: string;
  model_mae: number;
  factors?: PredictionFactor[];
  created_at: string;
}

export interface WasteAnalytics {
  total_waste_qty: number;
  total_waste_cost: number;
  preventable_waste_pct: number;
  waste_by_reason: Array<{ reason: string; wasted_qty: number }>;
  waste_by_item: Array<{ food_name: string; wasted_qty: number; financial_cost: number; unit: string }>;
  timeline: Array<{ date: string; wasted_qty: number; cost: number }>;
  is_synthetic: boolean;
}

export interface RecipientOrganization {
  id: string;
  name: string;
  org_type: string;
  contact_person: string;
  contact_email: string;
  contact_phone?: string;
  address: string;
  accepted_categories: string;
  storage_capacity_kg: number;
  current_stored_kg: number;
  allows_pickup: boolean;
  operates_weekends: boolean;
  min_shelf_life_hours: number;
  distance_km: number;
  active_status: boolean;
  eligibility_notes?: string;
}

export interface SurplusBatch {
  inventory_item_id: number;
  batch_number: string;
  cafeteria_id: string;
  food_item_id: string;
  food_name: string;
  category: string;
  available_surplus_qty: number;
  unit: string;
  prep_date: string;
  expiry_date: string;
  safe_use_remaining_hours: number;
  storage_type: string;
  status: string;
}

export interface MatchCandidate {
  recipient_id: string;
  recipient_name: string;
  org_type: string;
  distance_km: number;
  available_capacity_kg: number;
  compatibility_score: number;
  pickup_available: boolean;
  is_recommended: boolean;
  reasons: string[];
}

export interface SurplusMatchResponse {
  inventory_item_id: number;
  batch_number: string;
  food_item_id: string;
  food_name: string;
  category: string;
  available_surplus_qty: number;
  unit: string;
  safe_use_remaining_hours: number;
  storage_type: string;
  candidates: MatchCandidate[];
}

export interface RedistributionTransaction {
  id: number;
  transaction_code: string;
  cafeteria_id: string;
  recipient_id: string;
  recipient_name?: string;
  food_name: string;
  quantity: number;
  unit: string;
  matched_date: string;
  scheduled_pickup?: string;
  status: 'matched' | 'scheduled' | 'collected' | 'completed' | 'cancelled';
  match_score: number;
  match_reason?: string;
  donor_notes?: string;
  is_synthetic: boolean;
  created_at?: string;
}

export interface PipelineExecution {
  id: number;
  execution_id: string;
  filename: string;
  file_size_bytes: number;
  source: string;
  status: 'started' | 'validating' | 'transforming' | 'completed' | 'failed';
  total_records: number;
  valid_records: number;
  rejected_records: number;
  duration_ms: number;
  error_summary?: string;
  executed_at?: string;
}

export interface ModelMetrics {
  active_model: {
    version_tag: string;
    algorithm: string;
    trained_at: string;
    train_samples_count: number;
    test_samples_count: number;
    mae: number;
    rmse: number;
    r2: number;
    split_strategy: string;
    evaluation_notes: string;
  };
  version_history: Array<{
    version_tag: string;
    algorithm: string;
    train_samples: number;
    test_samples: number;
    mae: number;
    rmse: number;
    r2: number;
    is_active: boolean;
    trained_at: string;
    notes?: string;
  }>;
}

export interface DashboardSummary {
  forecast_demand_today: number;
  planned_preparation_today: number;
  actual_consumption_today: number;
  estimated_leftovers_today: number;
  waste_percentage: number;
  waste_cost_total: number;
  surplus_available_qty: number;
  redistributed_food_qty: number;
  active_cafeterias_count: number;
  active_recipients_count: number;
  total_inventory_items: number;
  high_risk_items: Array<{
    food_item_id: string;
    food_name: string;
    category: string;
    prepared_qty: number;
    wasted_qty: number;
    waste_pct: number;
    unit: string;
    unit_cost: number;
    financial_cost: number;
    risk_level: string;
  }>;
  predicted_vs_actual_trend: Array<{
    date: string;
    forecast_demand: number;
    planned_prep: number;
    actual_consumption: number;
    waste: number;
  }>;
  waste_by_category: Array<{
    category: string;
    wasted_qty: number;
    financial_cost: number;
  }>;
  daily_waste_trend: Array<{
    date: string;
    waste: number;
  }>;
  recent_pipeline_runs: Array<{
    execution_id: string;
    filename: string;
    status: string;
    total_records: number;
    valid_records: number;
    executed_at: string;
  }>;
  alerts: Array<{
    id: number;
    severity: 'info' | 'warning' | 'success' | 'danger';
    title: string;
    message: string;
  }>;
  is_synthetic: boolean;
}
