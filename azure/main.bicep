@description('Location for all resources.')
param location string = resourceGroup().location

@description('Unique suffix for resource names.')
param appSuffix string = uniqueString(resourceGroup().id)

@description('Environment tag.')
param environment string = 'production'

// 1. Azure Static Web App (Free Tier for Students)
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: 'stapp-foodflow-${appSuffix}'
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    allowConfigFileUpdates: true
  }
}

// 2. Azure App Service Plan (Free / Basic B1 Tier for Students)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'plan-foodflow-${appSuffix}'
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// 3. Azure App Service (FastAPI Backend)
resource apiWebApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'app-foodflow-api-${appSuffix}'
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      appCommandLine: 'uvicorn backend.app.main:app --host 0.0.0.0 --port 8000'
      appSettings: [
        {
          name: 'ENVIRONMENT'
          value: environment
        }
        {
          name: 'IS_LOCAL_MODE'
          value: 'false'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
      ]
    }
    httpsOnly: true
  }
}

// 4. Azure Storage Account (Blob Storage for Datasets)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'stfoodflow${appSuffix}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

// Blob Containers for Raw and Processed Ingestion
resource rawContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccount.name}/default/raw-uploads'
}

resource processedContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccount.name}/default/processed-data'
}

// 5. Azure Application Insights (Free 5GB/month tier)
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-foodflow-${appSuffix}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
output staticWebAppName string = staticWebApp.name
output apiWebAppDefaultHostname string = apiWebApp.properties.defaultHostName
output apiWebAppName string = apiWebApp.name
output storageAccountName string = storageAccount.name
