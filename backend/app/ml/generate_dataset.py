import argparse
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple
import numpy as np
import pandas as pd

# Fixed seed for reproducibility
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)

CAFETERIAS = [
    {"id": "CAF-CENTRAL", "name": "Campus Central Dining Hall", "capacity": 600, "base_customers": 1100},
    {"id": "CAF-NORTH", "name": "North Quad Commons", "capacity": 400, "base_customers": 750},
    {"id": "CAF-SOUTH", "name": "South Tower Bistro", "capacity": 350, "base_customers": 650},
    {"id": "CAF-EAST", "name": "East Engineering Eatery", "capacity": 300, "base_customers": 550},
]

FOOD_ITEMS = [
    # Grains
    {"id": "ITEM-JASMINE-RICE", "name": "Steamed Jasmine Rice", "category": "Grains", "unit": "kg", "cost": 1.80, "base_rate": 0.12},
    {"id": "ITEM-PENNE-PASTA", "name": "Whole Wheat Penne", "category": "Grains", "unit": "kg", "cost": 2.20, "base_rate": 0.10},
    {"id": "ITEM-QUINOA-BOWL", "name": "Seasoned Quinoa Pilaf", "category": "Grains", "unit": "kg", "cost": 3.50, "base_rate": 0.06},
    # Proteins
    {"id": "ITEM-GRILLED-CHICKEN", "name": "Herb Grilled Chicken Breast", "category": "Proteins", "unit": "kg", "cost": 6.50, "base_rate": 0.14},
    {"id": "ITEM-TOFU-STIRFRY", "name": "Marinated Tofu Stirfry", "category": "Proteins", "unit": "kg", "cost": 3.80, "base_rate": 0.08},
    {"id": "ITEM-ROAST-BEEF", "name": "Slow-Roasted Beef Strips", "category": "Proteins", "unit": "kg", "cost": 8.00, "base_rate": 0.11},
    {"id": "ITEM-LENTIL-CURRY", "name": "Spiced Yellow Dal Curry", "category": "Proteins", "unit": "liters", "cost": 2.90, "base_rate": 0.09},
    # Soups
    {"id": "ITEM-TOMATO-BASIL", "name": "Creamy Tomato Basil Soup", "category": "Soups", "unit": "liters", "cost": 2.40, "base_rate": 0.08},
    {"id": "ITEM-VEG-MINESTRONE", "name": "Tuscan Vegetable Minestrone", "category": "Soups", "unit": "liters", "cost": 2.10, "base_rate": 0.07},
    # Salads
    {"id": "ITEM-CAESAR-SALAD", "name": "Classic Caesar Salad", "category": "Salads", "unit": "kg", "cost": 3.20, "base_rate": 0.07},
    {"id": "ITEM-GREEK-SALAD", "name": "Mediterranean Greek Salad", "category": "Salads", "unit": "kg", "cost": 3.60, "base_rate": 0.06},
    # Vegetables
    {"id": "ITEM-ROASTED-BROCCOLI", "name": "Garlic Roasted Broccoli", "category": "Vegetables", "unit": "kg", "cost": 2.60, "base_rate": 0.09},
    {"id": "ITEM-GLAZED-CARROTS", "name": "Honey Glazed Baby Carrots", "category": "Vegetables", "unit": "kg", "cost": 2.00, "base_rate": 0.08},
    # Bakery
    {"id": "ITEM-DINNER-ROLLS", "name": "Artisan Dinner Rolls", "category": "Bakery", "unit": "portions", "cost": 0.60, "base_rate": 0.45},
    {"id": "ITEM-FOCACCIA", "name": "Rosemary Garlic Focaccia", "category": "Bakery", "unit": "portions", "cost": 0.85, "base_rate": 0.35},
]

WEATHER_CONDITIONS = ["Sunny", "Rainy", "Cloudy", "Cold"]

def get_day_multipliers(day_name: str, is_weekend: bool, is_holiday: bool, is_event: bool) -> Tuple[float, float]:
    """Returns (customer_multiplier, demand_multiplier)."""
    # Base day of week attendance
    day_weights = {
        "Monday": 0.95,
        "Tuesday": 1.05,
        "Wednesday": 1.10,
        "Thursday": 1.02,
        "Friday": 0.85,
        "Saturday": 0.45,
        "Sunday": 0.50,
    }
    cust_mult = day_weights.get(day_name, 1.0)
    
    if is_weekend:
        cust_mult *= 0.85
    if is_holiday:
        cust_mult *= 0.35
    if is_event:
        cust_mult *= 1.25
        
    demand_mult = 1.0
    if is_event:
        demand_mult = 1.15
    return cust_mult, demand_mult

def generate_synthetic_records(num_records: int = 5000, start_date: str = "2025-09-01") -> pd.DataFrame:
    """
    Generates realistic, physically consistent synthetic cafeteria food demand records.
    Enforces all consistency rules:
    - actual_consumption <= actual_prepared_qty
    - leftover_qty = actual_prepared_qty - actual_consumption >= 0
    - wasted_qty <= leftover_qty
    - fixed seed reproducibility
    """
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    records = []
    
    # Track historical demand by (cafeteria_id, food_item_id) for realistic lag creation
    history_tracker: Dict[Tuple[str, str], List[float]] = {}
    
    current_dt = start_dt
    record_idx = 1
    
    # We step through dates chronologically so lag features are strictly historical (no lookahead leakage!)
    while record_idx <= num_records:
        date_str = current_dt.strftime("%Y-%m-%d")
        day_of_week = current_dt.strftime("%A")
        is_weekend = day_of_week in ["Saturday", "Sunday"]
        
        # Realistic occasional holidays (approx 5% days) & events (approx 8% days)
        day_seed = (current_dt.year * 1000) + (current_dt.month * 50) + current_dt.day
        rng_day = np.random.RandomState(day_seed)
        
        is_holiday = bool(rng_day.rand() < 0.04)
        is_special_event = bool(rng_day.rand() < 0.08 and not is_holiday)
        
        weather = rng_day.choice(WEATHER_CONDITIONS, p=[0.50, 0.20, 0.20, 0.10])
        temp_c = {
            "Sunny": rng_day.uniform(22.0, 30.0),
            "Rainy": rng_day.uniform(14.0, 19.0),
            "Cloudy": rng_day.uniform(18.0, 24.0),
            "Cold": rng_day.uniform(5.0, 12.0),
        }[weather]
        
        for caf in CAFETERIAS:
            caf_id = caf["id"]
            cust_mult, event_demand_mult = get_day_multipliers(day_of_week, is_weekend, is_holiday, is_special_event)
            
            # Weather effects on attendance
            if weather == "Rainy":
                cust_mult *= 0.92
            elif weather == "Cold":
                cust_mult *= 0.95
                
            expected_customers = int(caf["base_customers"] * cust_mult * rng_day.uniform(0.92, 1.08))
            expected_customers = max(50, expected_customers)
            actual_customers = int(expected_customers * rng_day.uniform(0.94, 1.06))
            
            for item in FOOD_ITEMS:
                item_id = item["id"]
                category = item["category"]
                unit = item["unit"]
                cost = item["cost"]
                base_rate = item["base_rate"]
                
                # Weather-specific category multipliers
                weather_cat_mult = 1.0
                if weather in ["Rainy", "Cold"] and category in ["Soups", "Grains"]:
                    weather_cat_mult = 1.22
                elif weather in ["Sunny"] and category in ["Salads"]:
                    weather_cat_mult = 1.20
                elif weather in ["Cold"] and category in ["Salads"]:
                    weather_cat_mult = 0.80
                
                # Demand calculation: expected customers * base item consumption rate * multipliers + noise
                item_demand_mean = actual_customers * base_rate * event_demand_mult * weather_cat_mult
                # Random realistic variation (Poisson-like / log-normal noise)
                demand_noise = rng_day.normal(0, max(1.5, item_demand_mean * 0.07))
                actual_demand = round(max(2.0, item_demand_mean + demand_noise), 1)
                
                # Historical lag calculation (previous 7-day average for this item and cafeteria)
                key = (caf_id, item_id)
                hist_series = history_tracker.get(key, [])
                if len(hist_series) == 0:
                    recent_avg_demand = actual_demand
                    hist_demand = actual_demand
                else:
                    recent_avg_demand = round(float(np.mean(hist_series[-7:])), 1)
                    hist_demand = round(float(np.mean(hist_series[-30:])), 1)
                
                hist_series.append(actual_demand)
                history_tracker[key] = hist_series
                
                # Preparation planning: Manager forecast + buffer (typically 8% - 15%)
                buffer_pct = rng_day.uniform(0.08, 0.14)
                planned_prep = round(recent_avg_demand * (1.0 + buffer_pct), 1)
                
                # Kitchen actual preparation execution (slightly varies around planned prep)
                actual_prep = round(planned_prep * rng_day.uniform(0.97, 1.04), 1)
                actual_prep = max(actual_prep, 3.0)
                
                # Rigorous physical consistency:
                # 1. Consumption cannot exceed prepared amount or demand
                actual_consumption = round(min(actual_prep, actual_demand), 1)
                # 2. Leftovers = prepared - consumption
                leftover_qty = round(max(0.0, actual_prep - actual_consumption), 1)
                # 3. Waste = fraction of leftovers that spoiled/cannot be salvaged (20% - 60% of leftover)
                if leftover_qty > 0:
                    waste_fraction = rng_day.uniform(0.20, 0.55)
                    # For salads/soups higher waste fraction; for grains/dry bakery lower
                    if category in ["Salads", "Soups"]:
                        waste_fraction = min(0.85, waste_fraction * 1.3)
                    elif category in ["Bakery", "Grains"]:
                        waste_fraction = waste_fraction * 0.8
                    wasted_qty = round(leftover_qty * waste_fraction, 1)
                else:
                    wasted_qty = 0.0
                
                total_waste_cost = round(wasted_qty * cost, 2)
                
                records.append({
                    "record_id": f"SYN-{record_idx:06d}",
                    "date": date_str,
                    "cafeteria_id": caf_id,
                    "food_item_id": item_id,
                    "food_name": item["name"],
                    "food_category": category,
                    "day_of_week": day_of_week,
                    "is_weekend": int(is_weekend),
                    "is_holiday": int(is_holiday),
                    "is_special_event": int(is_special_event),
                    "weather_condition": weather,
                    "temperature_c": round(temp_c, 1),
                    "expected_customer_count": expected_customers,
                    "historical_customer_count": int(expected_customers * rng_day.uniform(0.95, 1.05)),
                    "recent_avg_demand": recent_avg_demand,
                    "historical_food_demand": hist_demand,
                    "planned_preparation_qty": planned_prep,
                    "actual_prepared_qty": actual_prep,
                    "actual_demand": actual_demand,
                    "actual_consumption": actual_consumption,
                    "leftover_qty": leftover_qty,
                    "wasted_qty": wasted_qty,
                    "unit": unit,
                    "unit_cost": cost,
                    "total_waste_cost": total_waste_cost,
                    "is_synthetic": 1,
                    "source": "synthetic",
                })
                
                record_idx += 1
                if record_idx > num_records:
                    break
            if record_idx > num_records:
                break
        
        current_dt += timedelta(days=1)
        
    df = pd.DataFrame(records)
    
    # Enforce and assert data consistency
    assert (df["actual_consumption"] <= df["actual_prepared_qty"] + 1e-5).all(), "Consistency Violation: consumption > prepared"
    assert (df["leftover_qty"] >= -1e-5).all(), "Consistency Violation: negative leftovers"
    assert (df["wasted_qty"] <= df["leftover_qty"] + 1e-5).all(), "Consistency Violation: waste > leftovers"
    
    return df

def generate_and_save_dataset(
    num_records: int = 5000, 
    output_path: Path = None, 
    sample_path: Path = None
) -> Tuple[pd.DataFrame, Dict]:
    """Generates synthetic dataset and writes CSVs to generated and sample folders."""
    from backend.app.core.config import settings
    
    if output_path is None:
        output_path = settings.GENERATED_DATA_DIR / "synthetic_food_demand_dataset.csv"
    if sample_path is None:
        sample_path = settings.SAMPLE_DATA_DIR / "sample_cafeteria_data.csv"
        
    print(f"Generating {num_records} synthetic records (seed={RANDOM_SEED})...")
    df = generate_synthetic_records(num_records=num_records)
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sample_path.parent.mkdir(parents=True, exist_ok=True)
    
    df.to_csv(output_path, index=False)
    # Also save a sample subset (e.g. 500 rows) as a reference demonstration template
    df.head(500).to_csv(sample_path, index=False)
    
    summary = {
        "total_records": len(df),
        "date_range": [df["date"].min(), df["date"].max()],
        "cafeterias": df["cafeteria_id"].unique().tolist(),
        "categories": df["food_category"].unique().tolist(),
        "food_items_count": df["food_item_id"].nunique(),
        "mean_actual_demand": round(float(df["actual_demand"].mean()), 2),
        "mean_prepared": round(float(df["actual_prepared_qty"].mean()), 2),
        "mean_consumption": round(float(df["actual_consumption"].mean()), 2),
        "mean_leftovers": round(float(df["leftover_qty"].mean()), 2),
        "mean_wasted": round(float(df["wasted_qty"].mean()), 2),
        "total_waste_cost": round(float(df["total_waste_cost"].sum()), 2),
        "generated_at": datetime.utcnow().isoformat(),
        "output_file": str(output_path),
    }
    
    print(f"Saved {len(df)} records to {output_path}")
    print(f"Dataset date span: {summary['date_range'][0]} to {summary['date_range'][1]}")
    return df, summary

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic FoodFlow demand dataset.")
    parser.add_argument("--records", type=int, default=5000, help="Number of records to generate")
    args = parser.parse_args()
    generate_and_save_dataset(num_records=args.records)
