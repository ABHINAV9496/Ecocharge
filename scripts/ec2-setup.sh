#!/bin/bash
set -e

echo "=== Step 1: Complete swap setup ==="
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

echo "=== Step 2: Install Docker Compose plugin ==="
sudo apt-get update -qq
sudo apt-get install -y -qq docker-compose-plugin

echo "=== Step 3: Enable Docker on boot ==="
sudo systemctl enable docker
sudo systemctl start docker

echo "=== Step 4: Verify ==="
docker --version
docker compose version

echo "=== Step 5: Install Certbot ==="
sudo apt-get install -y -qq certbot python3-certbot-nginx

echo "=== Setup complete ==="
