import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Tuple, Any
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer

from backend.app.core.config import settings

# Definition of feature sets for ML training
NUMERICAL_FEATURES = [
    "expected_customer_count",
    "recent_avg_demand",
    "historical_food_demand",
    "temperature_c",
    "is_weekend",
    "is_holiday",
    "is_special_event",
]

CATEGORICAL_FEATURES = [
    "cafeteria_id",
    "food_item_id",
    "food_category",
    "day_of_week",
    "weather_condition",
]

TARGET_COLUMN = "actual_demand"

def build_preprocessor() -> ColumnTransformer:
    """Builds scikit-learn ColumnTransformer for categorical and numerical features."""
    num_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    
    cat_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", num_pipeline, NUMERICAL_FEATURES),
            ("cat", cat_pipeline, CATEGORICAL_FEATURES),
        ],
        remainder="drop"
    )
    return preprocessor

def chronological_split(df: pd.DataFrame, train_ratio: float = 0.8) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Performs strict chronological train/test split based on date.
    Prevents temporal data leakage.
    """
    df_sorted = df.sort_values(by=["date"]).reset_index(drop=True)
    unique_dates = df_sorted["date"].unique()
    split_idx = int(len(unique_dates) * train_ratio)
    split_date = unique_dates[split_idx]
    
    train_df = df_sorted[df_sorted["date"] < split_date].copy()
    test_df = df_sorted[df_sorted["date"] >= split_date].copy()
    
    print(f"Chronological split: Train dates up to {train_df['date'].max()} ({len(train_df)} rows), "
          f"Test dates from {test_df['date'].min()} to {test_df['date'].max()} ({len(test_df)} rows)")
    return train_df, test_df

def evaluate_predictions(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Computes genuine regression metrics: MAE, RMSE, R²."""
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))
    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "r2": round(r2, 4),
    }

def train_demand_model(
    data_path: Path = None,
    version_tag: str = "v1.0",
    model_type: str = "RandomForest"
) -> Dict[str, Any]:
    """
    Trains baseline and candidate ML models on chronological split,
    evaluates on held-out test data, and saves the best model artifact.
    """
    if data_path is None:
        data_path = settings.GENERATED_DATA_DIR / "synthetic_food_demand_dataset.csv"
        
    if not data_path.exists():
        from backend.app.ml.generate_dataset import generate_and_save_dataset
        print("Dataset not found. Automatically generating synthetic dataset first...")
        generate_and_save_dataset(num_records=5000)
        
    df = pd.read_csv(data_path)
    print(f"Loaded {len(df)} records from {data_path} for model training.")
    
    # Chronological Split
    train_df, test_df = chronological_split(df, train_ratio=0.80)
    
    X_train = train_df[NUMERICAL_FEATURES + CATEGORICAL_FEATURES]
    y_train = train_df[TARGET_COLUMN].values
    
    X_test = test_df[NUMERICAL_FEATURES + CATEGORICAL_FEATURES]
    y_test = test_df[TARGET_COLUMN].values
    
    # 1. Baseline Model (Ridge Regression)
    baseline_pipe = Pipeline([
        ("preprocessor", build_preprocessor()),
        ("model", Ridge(alpha=1.0))
    ])
    baseline_pipe.fit(X_train, y_train)
    baseline_preds = baseline_pipe.predict(X_test)
    baseline_metrics = evaluate_predictions(y_test, baseline_preds)
    print(f"Baseline Ridge Metrics: MAE={baseline_metrics['mae']}, RMSE={baseline_metrics['rmse']}, R2={baseline_metrics['r2']}")
    
    # 2. Candidate Model (Random Forest Regressor)
    rf_pipe = Pipeline([
        ("preprocessor", build_preprocessor()),
        ("model", RandomForestRegressor(
            n_estimators=100,
            max_depth=12,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        ))
    ])
    rf_pipe.fit(X_train, y_train)
    rf_preds = rf_pipe.predict(X_test)
    rf_metrics = evaluate_predictions(y_test, rf_preds)
    print(f"Random Forest Metrics: MAE={rf_metrics['mae']}, RMSE={rf_metrics['rmse']}, R2={rf_metrics['r2']}")
    
    # Choose model
    if model_type == "RandomForest" or rf_metrics["mae"] <= baseline_metrics["mae"]:
        chosen_pipeline = rf_pipe
        chosen_metrics = rf_metrics
        algorithm_name = "RandomForestRegressor(n_estimators=100, max_depth=12)"
    else:
        chosen_pipeline = baseline_pipe
        chosen_metrics = baseline_metrics
        algorithm_name = "Ridge(alpha=1.0)"
        
    # Save Model Artifact
    settings.MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_filename = f"demand_model_{version_tag}.joblib"
    artifact_path = settings.MODELS_DIR / model_filename
    joblib.dump(chosen_pipeline, artifact_path)
    
    metadata = {
        "version_tag": version_tag,
        "algorithm": algorithm_name,
        "trained_at": datetime.utcnow().isoformat(),
        "train_samples_count": len(train_df),
        "test_samples_count": len(test_df),
        "mae": chosen_metrics["mae"],
        "rmse": chosen_metrics["rmse"],
        "r2": chosen_metrics["r2"],
        "baseline_mae": baseline_metrics["mae"],
        "baseline_rmse": baseline_metrics["rmse"],
        "baseline_r2": baseline_metrics["r2"],
        "numerical_features": NUMERICAL_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "target_column": TARGET_COLUMN,
        "artifact_file": model_filename,
        "split_strategy": "Chronological (80% train / 20% test)",
        "evaluation_notes": f"Evaluated on {len(test_df)} held-out future records. Genuine test MAE is {chosen_metrics['mae']} units.",
        "is_active": True,
    }
    
    metadata_path = settings.MODELS_DIR / "model_metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
        
    print(f"Model successfully saved to {artifact_path}")
    print(f"Model metadata written to {metadata_path}")
    return metadata

if __name__ == "__main__":
    train_demand_model(version_tag="v1.0")
