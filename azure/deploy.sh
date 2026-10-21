#!/bin/bash
# ==============================================================================
# FoodFlow: Azure for Students Deployment Script
# ==============================================================================
# This script provisions low-cost / free-tier Azure services for the FoodFlow
# platform using your Microsoft Azure for Students credit ($100 USD/year).
# ==============================================================================

set -e

# Configuration
RESOURCE_GROUP="rg-foodflow-student"
LOCATION="eastus"
APP_NAME="foodflow-$(openssl rand -hex 3)"

echo "=== FoodFlow Azure for Students Provisioning ==="
echo "Target Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"

# 1. Login to Azure
echo "1. Checking Azure login..."
az account show > /dev/null 2>&1 || az login

# 2. Set Active Subscription
echo "2. Setting active subscription..."
az account set --subscription "$(az account list --query '[0].id' -o tsv)"

# 3. Create Resource Group
echo "3. Creating resource group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

# 4. Deploy Infrastructure as Code via Bicep
echo "4. Deploying Bicep template (Free SWA, B1 App Service, Blob Storage)..."
az deployment group create \
  --name foodflow-dep \
  --resource-group "$RESOURCE_GROUP" \
  --template-file azure/main.bicep \
  --parameters location="$LOCATION"

# 5. Fetch Provisioned Output URLs
SWA_HOST=$(az deployment group show --resource-group "$RESOURCE_GROUP" --name foodflow-dep --query properties.outputs.staticWebAppDefaultHostname.value -o tsv)
API_HOST=$(az deployment group show --resource-group "$RESOURCE_GROUP" --name foodflow-dep --query properties.outputs.apiWebAppDefaultHostname.value -o tsv)
API_NAME=$(az deployment group show --resource-group "$RESOURCE_GROUP" --name foodflow-dep --query properties.outputs.apiWebAppName.value -o tsv)

# 6. Deploy Backend Code to App Service
echo "5. Deploying backend code to App Service: $API_NAME..."
zip -r /tmp/backend_deploy.zip backend requirements.txt data/foodflow.db 2>/dev/null || true
if [ -f /tmp/backend_deploy.zip ]; then
  az webapp deploy --resource-group "$RESOURCE_GROUP" --name "$API_NAME" --src-path /tmp/backend_deploy.zip --type zip || echo "Zip deploy failed, connect via GitHub in Azure Portal"
fi

echo "================================================================="
echo "FoodFlow Successfully Deployed to Azure!"
echo "Frontend URL: https://$SWA_HOST"
echo "API Backend URL: https://$API_HOST"
echo "Swagger API Docs: https://$API_HOST/docs"
echo "================================================================="
