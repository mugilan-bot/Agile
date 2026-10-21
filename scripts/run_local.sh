#!/bin/bash
# ==============================================================================
# FoodFlow: Complete Local Startup Script
# ==============================================================================

set -e

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE_DIR"

echo "================================================================="
echo " Starting FoodFlow: AI Food Demand Prediction & Redistribution "
echo "================================================================="

# 1. Activate virtual environment
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "Virtual environment not found. Please create one with Python 3.11."
    exit 1
fi

# 2. Check and initialize database & synthetic baseline
echo "1. Checking database and initial dataset..."
PYTHONPATH=. python -m backend.app.database.init_db

# 3. Check ML model
if [ ! -f "backend/app/ml/saved_models/model_metadata.json" ]; then
    echo "2. Training initial machine learning model..."
    PYTHONPATH=. python -m backend.app.ml.train_model
fi

# 4. Start Backend API
echo "3. Starting FastAPI Backend on http://127.0.0.1:8000 ..."
PYTHONPATH=. uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# 5. Start Frontend Dev Server
echo "4. Starting Vite Frontend on http://localhost:5173 ..."
cd frontend
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo ""
echo "================================================================="
echo " FoodFlow is running locally!"
echo " Frontend URL: http://localhost:5173"
echo " Backend API: http://127.0.0.1:8000"
echo " Swagger API Docs: http://127.0.0.1:8000/docs"
echo " Press Ctrl+C to terminate both servers."
echo "================================================================="

wait
