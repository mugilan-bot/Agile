# FoodFlow: AWS Deployment Guide & Architecture

This guide explains how to deploy **FoodFlow** to **Amazon Web Services (AWS)** using standard, cost-free or low-cost services eligible under the **AWS Free Tier** (750 hours/month free).

---

## Deployment Options Comparison

| Option | Services Used | Setup Time | Monthly Cost | Best For |
| :--- | :--- | :--- | :--- | :--- |
| **Option 1 (Recommended)** | **AWS EC2 (Ubuntu) + Docker Compose** | **5 minutes** | **$0.00** (Free Tier) | Complete full-stack on 1 instance, zero config |
| **Option 2 (Serverless)** | **AWS Amplify (Frontend) + App Runner (API)** | **15 minutes** | **$0.00 – $5.00** | Microservice separation, auto-scaling |

---

# Method 1 (Recommended): Deploy on AWS EC2 Free Tier (Single-Command)

With this method, both the **FastAPI Backend** and the **React Frontend** run inside containerized Docker services on a free `t2.micro` or `t3.micro` instance.

### Step 1: Open the AWS Console
1. Log in to the [AWS Management Console](https://console.aws.amazon.com/).
2. In the top search bar, type **EC2** and click on the EC2 service.
3. Ensure your region is set to a close region (e.g., `us-east-1`, `ap-south-1`).

### Step 2: Launch a New EC2 Instance
1. Click the orange **"Launch Instance"** button.
2. **Name and tags**: Enter `FoodFlow-Server`.
3. **Application and OS Images (Amazon Machine Image)**:
   - Select **Ubuntu** (Ubuntu Server 24.04 LTS or 22.04 LTS, 64-bit x86).
4. **Instance Type**:
   - Select **`t2.micro`** (or **`t3.micro`** depending on region) — marked with **"Free tier eligible"**.
5. **Key pair (login)**:
   - Choose an existing key pair or click **"Create new key pair"** (RSA, `.pem`) to download it if you wish to SSH into the instance.

### Step 3: Configure Network Settings (Security Group)
Under **Network settings**, check the following boxes:
- [x] **Allow SSH traffic from** -> `Anywhere (0.0.0.0/0)` or `My IP`
- [x] **Allow HTTP traffic from the internet** (Port 80)
- [x] **Allow HTTPS traffic from the internet** (Port 443)

*(Optional: Click **Edit** next to Network settings, click **Add security group rule**, and add Custom TCP rule for Port `8000` to access the Swagger documentation directly).*

### Step 4: Paste Automated User Data Script
1. Scroll down to the bottom and expand **"Advanced details"**.
2. Scroll to the very bottom to the **"User data - optional"** text area.
3. Copy and paste the entire contents of [`aws/deploy_ec2.sh`](file:///Users/mugilan/Desktop/AGILE%20PROJECT/aws/deploy_ec2.sh):

```bash
#!/bin/bash
set -e

# 1. Update and install Docker
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

sudo systemctl enable docker
sudo systemctl start docker

# 2. Clone repository from GitHub
cd /home/ubuntu
git clone https://github.com/mugilan-bot/agile-project-.git
cd agile-project-

# 3. Setup environment and start containers
cp .env.example .env
sudo docker compose up -d --build
```

### Step 5: Launch & Access the Application
1. Click **"Launch Instance"** on the right sidebar.
2. In the EC2 Instances list, wait 2–3 minutes for the instance status to change to **Running** and the initialization script to finish.
3. Click on your instance and copy the **Public IPv4 address** (e.g., `54.210.12.89`).
4. Open your browser and navigate to:
   - **Frontend Dashboard**: `http://<YOUR-EC2-PUBLIC-IP>`
   - **Backend OpenAPI Docs**: `http://<YOUR-EC2-PUBLIC-IP>:8000/docs`

---

# Method 2: Connect AWS via SSH (Manual Control)

If you prefer to SSH into your EC2 instance and run the steps manually:

1. Connect to your instance:
   ```bash
   ssh -i your-key.pem ubuntu@<YOUR-EC2-PUBLIC-IP>
   ```

2. Run the deployment script directly:
   ```bash
   git clone https://github.com/mugilan-bot/agile-project-.git
   cd agile-project-
   chmod +x aws/deploy_ec2.sh
   ./aws/deploy_ec2.sh
   ```

3. Check container status:
   ```bash
   sudo docker compose ps
   ```

4. View live logs:
   ```bash
   sudo docker compose logs -f
   ```

---

# Method 3: Serverless Deployment (AWS Amplify + AWS App Runner)

If you prefer completely serverless managed hosting:

### A. Frontend on AWS Amplify
1. Open the **AWS Amplify Console**.
2. Click **"Host web app"** and choose **GitHub**.
3. Authorize GitHub and select repository `mugilan-bot/agile-project-` with branch `main`.
4. Set App root to `frontend`.
5. Amplify will auto-detect Vite:
   - Build command: `npm run build`
   - Output directory: `dist`
6. Click **Save and Deploy**. You will receive a permanent HTTPS URL (e.g. `https://main.d123456.amplifyapp.com`).

### B. Backend on AWS App Runner
1. Open **AWS App Runner** in the AWS Console.
2. Click **"Create service"**.
3. Source: **Source code repository** -> connect to GitHub `mugilan-bot/agile-project-`.
4. Configuration:
   - Runtime: **Python 3** (or Container from `backend/Dockerfile`).
   - Build command: `pip install -r backend/requirements.txt`
   - Start command: `uvicorn backend.app.main:app --host 0.0.0.0 --port 8000`
   - Port: `8000`
5. Click **Deploy**. App Runner provides an automatic load-balanced HTTPS API URL.
