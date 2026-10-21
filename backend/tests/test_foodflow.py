import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.session import SessionLocal
from backend.app.services.decision_engine import calculate_preparation_recommendation
from backend.app.pipeline.local_pipeline import process_uploaded_csv, generate_csv_template

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["app_name"] == "FoodFlow"
    assert data["database"] == "connected"

def test_dashboard_summary():
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert "forecast_demand_today" in data
    assert "waste_percentage" in data
    assert "predicted_vs_actual_trend" in data
    assert len(data["predicted_vs_actual_trend"]) > 0
    assert data["is_synthetic"] is True

def test_cafeterias_and_food_items():
    caf_resp = client.get("/api/cafeterias")
    assert caf_resp.status_code == 200
    cafs = caf_resp.json()
    assert len(cafs) >= 4
    
    food_resp = client.get("/api/food-items")
    assert food_resp.status_code == 200
    items = food_resp.json()
    assert len(items) >= 10

def test_prediction_endpoint():
    payload = {
        "cafeteria_id": "CAF-CENTRAL",
        "food_item_id": "ITEM-JASMINE-RICE",
        "target_date": "2026-10-25",
        "expected_customer_count": 1100,
        "weather_condition": "Sunny",
        "temperature_c": 24.5,
        "is_holiday": False,
        "is_special_event": False,
        "safety_buffer_pct": 0.10,
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_demand"] > 0
    assert data["recommended_prep"] >= 0
    assert data["safety_buffer_pct"] == 0.10
    assert "model_version" in data
    assert data["model_mae"] > 0
    assert len(data["factors"]) > 0

def test_decision_engine_formula():
    # Formula: max(0, rounded-up demand with buffer minus usable inventory)
    pred_demand = 100.0
    buffer = 0.10  # 10%
    # 100 * 1.10 = 110.0
    inv = 30.0
    # 110.0 - 30.0 = 80.0
    res = calculate_preparation_recommendation(
        predicted_demand=pred_demand,
        existing_usable_inventory=inv,
        safety_buffer_pct=buffer,
    )
    assert res["recommended_prep"] == 80.0
    assert res["buffer_added_qty"] == 10.0
    assert res["surplus_risk_level"] in ["low", "medium", "high"]

def test_decision_engine_excess_inventory():
    # If inventory (150) exceeds buffered demand (110), recommendation must be 0
    res = calculate_preparation_recommendation(
        predicted_demand=100.0,
        existing_usable_inventory=150.0,
        safety_buffer_pct=0.10,
    )
    assert res["recommended_prep"] == 0.0

def test_inventory_crud_and_validation():
    # Create inventory item
    payload = {
        "cafeteria_id": "CAF-CENTRAL",
        "food_item_id": "ITEM-JASMINE-RICE",
        "quantity": 40.0,
        "unit": "kg",
        "prepared_qty": 100.0,
        "consumed_qty": 60.0,
        "leftover_qty": 40.0,
        "waste_qty": 0.0,
        "prep_date": "2026-10-22",
        "expiry_date": "2026-10-23T18:00:00",
        "storage_type": "hot_holding",
        "status": "surplus",
    }
    create_resp = client.post("/api/inventory", json=payload)
    assert create_resp.status_code == 200
    item = create_resp.json()
    item_id = item["id"]
    
    # Update inventory item with invalid consumed > prepared
    invalid_update = {"consumed_qty": 150.0}
    bad_resp = client.put(f"/api/inventory/{item_id}", json=invalid_update)
    assert bad_resp.status_code == 400
    
    # Valid update
    valid_update = {"notes": "Inspected and ready"}
    good_resp = client.put(f"/api/inventory/{item_id}", json=valid_update)
    assert good_resp.status_code == 200
    assert good_resp.json()["notes"] == "Inspected and ready"
    
    # Delete
    del_resp = client.delete(f"/api/inventory/{item_id}")
    assert del_resp.status_code == 200

def test_redistribution_matching_and_overallocation_prevention():
    # Get surplus batches
    surplus_resp = client.get("/api/redistribution/surplus")
    assert surplus_resp.status_code == 200
    batches = surplus_resp.json()
    assert len(batches) > 0
    batch = batches[0]
    inv_id = batch["inventory_item_id"]
    avail_qty = batch["available_surplus_qty"]
    
    # Test match calculation
    match_resp = client.get(f"/api/redistribution/match/{inv_id}")
    assert match_resp.status_code == 200
    match_data = match_resp.json()
    assert len(match_data["candidates"]) > 0
    candidate = match_data["candidates"][0]
    recip_id = candidate["recipient_id"]
    
    # Attempt over-allocation (requesting more than available)
    bad_alloc = {
        "inventory_item_id": inv_id,
        "recipient_id": recip_id,
        "quantity": avail_qty + 500.0,
    }
    bad_alloc_resp = client.post("/api/redistribution/allocate", json=bad_alloc)
    assert bad_alloc_resp.status_code == 400
    assert "Over-allocation error" in bad_alloc_resp.json()["detail"]
    
    # Valid allocation
    valid_qty = min(5.0, avail_qty)
    good_alloc = {
        "inventory_item_id": inv_id,
        "recipient_id": recip_id,
        "quantity": valid_qty,
        "scheduled_pickup": "2026-10-22 17:00",
        "notes": "Test allocation",
    }
    good_alloc_resp = client.post("/api/redistribution/allocate", json=good_alloc)
    assert good_alloc_resp.status_code == 200
    tx = good_alloc_resp.json()
    assert tx["status"] == "scheduled"
    assert tx["quantity"] == valid_qty

def test_pipeline_csv_processing():
    template = generate_csv_template()
    db = SessionLocal()
    try:
        res = process_uploaded_csv(
            file_bytes=template.encode("utf-8"),
            filename="test_upload.csv",
            db=db,
            source="test_pipeline"
        )
        assert res["status"] == "completed"
        assert res["valid_records"] > 0
        assert res["rejected_records"] == 0
    finally:
        db.close()

def test_ml_metrics_endpoint():
    resp = client.get("/api/ml/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "active_model" in data
    assert data["active_model"]["mae"] > 0
    assert data["active_model"]["r2"] > 0
