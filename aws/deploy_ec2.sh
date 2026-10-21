#!/bin/bash
# ==============================================================================
# FoodFlow: Automated AWS EC2 Deployment Script (Ubuntu 22.04 / 24.04 LTS)
# ==============================================================================
# This script can be pasted directly into AWS EC2 "User Data" upon launch,
# or executed over SSH on a fresh Ubuntu EC2 instance.
# ==============================================================================

set -e

echo "=== 1. Updating System Packages ==="
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

echo "=== 2. Installing Docker & Docker Compose ==="
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin

sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER || true

echo "=== 3. Cloning FoodFlow Repository ==="
cd /home/ubuntu
if [ -d "agile-project-" ]; then
    cd agile-project-
    git pull origin main
else
    git clone https://github.com/mugilan-bot/agile-project-.git
    cd agile-project-
fi

echo "=== 4. Setting Environment Variables ==="
if [ ! -f ".env" ]; then
    cp .env.example .env
fi

echo "=== 5. Building & Launching FoodFlow Stack via Docker Compose ==="
sudo docker compose down 2>/dev/null || true
sudo docker compose up -d --build

echo "=== 6. Configuring Firewall ==="
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 5173/tcp || true
sudo ufw allow 8000/tcp || true

PUBLIC_IP=$(curl -s http://checkip.amazonaws.com || curl -s ifconfig.me || echo "your-ec2-public-ip")

echo "================================================================="
echo " FoodFlow Successfully Deployed on AWS EC2!"
echo " Web Application URL: http://${PUBLIC_IP}"
echo " API Docs (Swagger): http://${PUBLIC_IP}:8000/docs"
echo "================================================================="
