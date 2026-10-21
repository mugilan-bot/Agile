#!/bin/bash
set -e
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE_DIR"

source .venv/bin/activate
VERSION=${1:-"v1.0"}
echo "Training demand prediction models with version tag: $VERSION ..."
PYTHONPATH=. python -m backend.app.ml.train_model
