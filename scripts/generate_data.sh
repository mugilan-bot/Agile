#!/bin/bash
set -e
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE_DIR"

source .venv/bin/activate
RECORDS=${1:-5000}
echo "Generating $RECORDS synthetic food demand records..."
PYTHONPATH=. python -m backend.app.ml.generate_dataset --records "$RECORDS"
