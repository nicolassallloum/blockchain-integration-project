🔹 STEP 5 — Docker & Container Runtime Setup
Blockchain Integration Project — Ubuntu Ready Guide

Docker is required for running Hyperledger Fabric components such as peers, orderers, CouchDB, CA containers, chaincode containers, and local blockchain network services.

Official Docker installation on Ubuntu uses Docker’s apt repository and installs Docker Engine, Docker CLI, containerd, Buildx, and the Docker Compose plugin. Docker currently supports Ubuntu 22.04, 24.04, 25.10, and 26.04 64-bit versions.

1. Check Ubuntu Version
lsb_release -a
uname -m

Expected architecture:

x86_64
2. Remove Old / Conflicting Docker Packages
sudo apt remove -y docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc || true

Docker recommends removing conflicting unofficial packages before installing Docker Engine from the official repository.

3. Update Ubuntu Packages
sudo apt update
sudo apt upgrade -y

Install required dependencies:

sudo apt install -y ca-certificates curl gnupg lsb-release
4. Add Docker Official GPG Key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
5. Add Docker Official Repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

Update package index:

sudo apt update
6. Install Docker Engine + Docker Compose
sudo apt install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

The official Docker Compose installation method on Linux is now the Docker Compose plugin, verified with docker compose version.

7. Start and Enable Docker Service
sudo systemctl start docker
sudo systemctl enable docker

Check Docker status:

sudo systemctl status docker

Expected result:

Active: active (running)
8. Add Current User to Docker Group

This allows running Docker without sudo.

sudo usermod -aG docker $USER

Apply group change immediately:

newgrp docker

Verify:

groups

You should see:

docker
9. Verify Docker Installation
docker version
docker info

Run test container:

docker run hello-world

Expected output:

Hello from Docker!
This message shows that your installation appears to be working correctly.
10. Verify Docker Compose
docker compose version

Expected example:

Docker Compose version v5.x.x

Important: use the modern command:

docker compose

Not the old command:

docker-compose
11. Verify Docker Network

List Docker networks:

docker network ls

Expected default networks:

bridge
host
none

Inspect bridge network:

docker network inspect bridge

Create a test blockchain network:

docker network create blockchain-net

Verify:

docker network ls | grep blockchain-net

Remove test network:

docker network rm blockchain-net
12. Container Runtime Verification

Check containerd:

systemctl status containerd

Expected:

Active: active (running)

Check Docker runtime:

docker info | grep -i runtime
13. Test Nginx Container
docker run -d \
  --name test-nginx \
  -p 8080:80 \
  nginx:latest

Verify container:

docker ps

Test from server:

curl http://localhost:8080

Stop and remove test container:

docker stop test-nginx
docker rm test-nginx
14. Recommended Docker Folder Structure

Inside your project:

mkdir -p ~/u01/blockchain-integration/docker
cd ~/u01/blockchain-integration/docker

Recommended structure:

blockchain-integration/
├── docker/
│   ├── compose/
│   │   ├── docker-compose.fabric.yml
│   │   ├── docker-compose.couchdb.yml
│   │   ├── docker-compose.postgres.yml
│   │   ├── docker-compose.monitoring.yml
│   │   └── docker-compose.dev.yml
│   │
│   ├── networks/
│   │   └── create-networks.sh
│   │
│   ├── volumes/
│   │   ├── postgres/
│   │   ├── couchdb/
│   │   ├── fabric-peer/
│   │   └── fabric-orderer/
│   │
│   ├── env/
│   │   ├── postgres.env
│   │   ├── couchdb.env
│   │   ├── fabric.env
│   │   └── blockchain-api.env
│   │
│   ├── scripts/
│   │   ├── docker-check.sh
│   │   ├── docker-clean.sh
│   │   ├── restart-containers.sh
│   │   └── view-logs.sh
│   │
│   └── README.md
│
├── fabric/
│   ├── fabric-samples/
│   └── chaincode/
│
├── blockchain-api/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── postgres/
│   ├── init/
│   └── backups/
│
└── couchdb/
    ├── indexes/
    └── config/
15. Create Blockchain Docker Network Script

Create file:

nano ~/u01/blockchain-integration/docker/networks/create-networks.sh

Add:

#!/bin/bash

set -e

echo "Creating Docker networks for Blockchain Integration Project..."

docker network create blockchain-net 2>/dev/null || true
docker network create fabric-net 2>/dev/null || true
docker network create monitoring-net 2>/dev/null || true

echo "Docker networks created successfully."

docker network ls

Make executable:

chmod +x ~/u01/blockchain-integration/docker/networks/create-networks.sh

Run:

~/u01/blockchain-integration/docker/networks/create-networks.sh
16. Create Docker Verification Script

Create:

nano ~/u01/blockchain-integration/docker/scripts/docker-check.sh

Add:

#!/bin/bash

echo "=============================="
echo " Docker Verification"
echo "=============================="

echo ""
echo "Docker version:"
docker version

echo ""
echo "Docker Compose version:"
docker compose version

echo ""
echo "Docker service status:"
systemctl is-active docker

echo ""
echo "Containerd service status:"
systemctl is-active containerd

echo ""
echo "Docker networks:"
docker network ls

echo ""
echo "Running containers:"
docker ps

echo ""
echo "Docker disk usage:"
docker system df

echo ""
echo "Docker verification completed."

Make executable:

chmod +x ~/u01/blockchain-integration/docker/scripts/docker-check.sh

Run:

~/u01/blockchain-integration/docker/scripts/docker-check.sh
17. Create Restart Script for Work Server Timeout

Since your work server shuts down or times out, add this script.

Create:

nano ~/u01/blockchain-integration/docker/scripts/restart-containers.sh

Add:

#!/bin/bash

set -e

echo "Restarting Blockchain Integration Docker containers..."

cd ~/u01/blockchain-integration

echo "Starting Docker service..."
sudo systemctl start docker

echo "Starting Hyperledger Fabric test network if available..."

if [ -d "$HOME/u01/blockchain-integration/fabric/fabric-samples/test-network" ]; then
  cd "$HOME/u01/blockchain-integration/fabric/fabric-samples/test-network"
  docker ps
else
  echo "Fabric test-network folder not found."
fi

echo "Restart completed."

Make executable:

chmod +x ~/u01/blockchain-integration/docker/scripts/restart-containers.sh

Run after server restart:

~/u01/blockchain-integration/docker/scripts/restart-containers.sh
18. Common Docker Issues and Fixes
Issue 1 — Permission denied while running Docker

Error:

permission denied while trying to connect to the Docker daemon socket

Fix:

sudo usermod -aG docker $USER
newgrp docker

Then test:

docker ps
Issue 2 — Docker service not running

Error:

Cannot connect to the Docker daemon

Fix:

sudo systemctl start docker
sudo systemctl enable docker
sudo systemctl status docker
Issue 3 — Old docker-compose command not found

Error:

docker-compose: command not found

Fix:

Use:

docker compose version

Instead of:

docker-compose version

Modern Docker Compose is installed as a Docker CLI plugin.

Issue 4 — Port already in use

Error:

bind: address already in use

Find the process:

sudo lsof -i :8080

Or:

sudo netstat -tulpn | grep 8080

Stop conflicting container:

docker ps
docker stop <container_id>
Issue 5 — Docker disk space full

Check usage:

docker system df

Clean unused containers/images/networks:

docker system prune -a

Clean unused volumes carefully:

docker volume prune

Warning: do not prune volumes if they contain PostgreSQL, CouchDB, or Fabric ledger data.

Issue 6 — Container keeps restarting

Check logs:

docker logs <container_name>

Follow logs:

docker logs -f <container_name>

Inspect container:

docker inspect <container_name>
Issue 7 — Docker network conflict

List networks:

docker network ls

Inspect network:

docker network inspect <network_name>

Remove unused network:

docker network rm <network_name>
19. Docker Commands Required for Hyperledger Fabric

From Fabric test network folder:

cd ~/u01/blockchain-integration/fabric/fabric-samples/test-network

Check Fabric containers:

docker ps

Check all containers:

docker ps -a

Check Fabric images:

docker images | grep hyperledger

Check CouchDB containers:

docker ps | grep couchdb

View peer logs:

docker logs peer0.org1.example.com

View orderer logs:

docker logs orderer.example.com

View CouchDB logs:

docker logs couchdb0
20. Final Verification Checklist

Run these commands:

docker version
docker compose version
docker info
docker run hello-world
docker network ls
docker ps
systemctl status docker
systemctl status containerd

Expected result:

Docker installed successfully
Docker Compose installed successfully
Docker service is running
Container runtime is active
Docker networks are available
Test container runs successfully
System ready for Hyperledger Fabric containers
✅ Step 5 Completion Status

After this step, your environment is ready for:

Angular / Spring Boot Integration API
Blockchain API Middleware
Hyperledger Fabric containers
CouchDB containers
PostgreSQL containers
Fabric CA containers
Monitoring containers
Docker Compose orchestration

Step 5 is complete when:

docker run hello-world

works successfully and:

docker compose version