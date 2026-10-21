# FoodFlow: Microsoft Azure Cloud Architecture & Cost Analysis

## 1. Overview
FoodFlow is architected with a dual-execution model:
1. **Local Development Mode**: Completely functional without external cloud dependencies, utilizing SQLite, local Python file storage, and in-memory process caches.
2. **Azure Cloud Production Mode**: Cloud-native topology optimized for the **Microsoft Azure for Students** subscription ($100 USD student credit, free tiers).

---

## 2. Azure Service Mapping & Student Cost Breakdown

| Component | Azure Service | Recommended Tier | Estimated Monthly Cost | Student Plan Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend SPA** | Azure Static Web Apps | **Free** Tier | **$0.00** | Included permanently free (100GB bandwidth, SSL, CDN) |
| **Backend REST API** | Azure App Service (Linux) | **B1 Basic** or **F1 Free** | **$0.00 – $13.00** | Covered by $100 student credit; F1 is 100% free |
| **Raw & Processed Data** | Azure Blob Storage | **Standard LRS** (Hot) | **<$0.50** | First 5 GB free per month |
| **Event Routing** | Azure Event Grid | System Topic (BlobCreated) | **$0.00** | First 100,000 operations free per month |
| **Relational Database** | Azure SQL Database | Serverless / Basic (2 GB) | **$0.00 – $5.00** | Covered by student credit |
| **Observability** | Azure Application Insights | Ingestion (5 GB/month) | **$0.00** | First 5 GB free per month |
| **CI/CD Automation** | GitHub Actions | Standard Runner | **$0.00** | 2,000 free minutes/month included with GitHub Student Pack |

---

## 3. Event-Driven Cloud Pipeline Architecture

```
[Cafeteria Manager / CSV Upload]
           │
           ▼
[Azure Blob Storage: raw-uploads/ ]
           │
           ▼ (BlobCreated Event)
[Azure Event Grid System Topic]
           │
           ▼ (Push Subscription)
[Azure Function / FastAPI Ingestion Endpoint]
           │
           ├─ 1. Schema & Range Validation
           ├─ 2. Physical Consistency Audit (consumption <= prep, waste <= leftovers)
           ├─ 3. Deduplication Engine
           │
           ▼
[Azure Blob Storage: processed-data/ ]
           │
           ▼
[Azure SQL Database / Model Inference Service]
           │
           ▼
[React Executive Dashboard on Azure Static Web Apps]
```

---

## 4. Security & Least Privilege

- **Managed Identities**: Azure App Service connects to Blob Storage and Azure SQL using System-Assigned Managed Identity, eliminating passwords and connection string secrets from source control.
- **Role-Based Access Control (RBAC)**:
  - App Service granted `Storage Blob Data Contributor` on `foodflow` storage account.
  - GitHub Actions uses OpenID Connect (OIDC) federated credentials without storing permanent Azure client secrets.
- **Network Security**: HTTPS enforced on all endpoints with TLS 1.3.
