#!/bin/bash
set -e
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE_DIR"

source .venv/bin/activate
echo "Running FoodFlow automated backend test suite..."
PYTHONPATH=. pytest backend/tests/test_foodflow.py -v
