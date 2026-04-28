#!/bin/bash

# ============================================================
# STEP 5 — Docker & Container Runtime Setup
# Blockchain Integration Project
# Author: Nix
# Purpose:
#   This script verifies Docker & Docker Compose,
#   creates required blockchain Docker networks,
#   creates recommended Docker folder structure,
#   and adds helper scripts for restart/check operations.
# ============================================================

set -e

PROJECT_ROOT="$HOME/u01/blockchain-integration"
DOCKER_DIR="$PROJECT_ROOT/docker"

echo "============================================================"
echo " STEP 5 — Docker & Container Runtime Setup"
echo " Blockchain Integration Project"
echo "============================================================"
echo ""

# ------------------------------------------------------------
# 1. Check Docker Service
# ------------------------------------------------------------

echo "1. Checking Docker service..."

if systemctl is-active --quiet docker; then
    echo "Docker service is already running."
else
    echo "Docker service is not running. Starting Docker..."
    sudo systemctl start docker
fi

echo "Enabling Docker to start on boot..."
sudo systemctl enable docker

echo ""

# ------------------------------------------------------------
# 2. Verify Docker Version
# ------------------------------------------------------------

echo "2. Verifying Docker installation..."

if command -v docker >/dev/null 2>&1; then
    docker version
else
    echo "ERROR: Docker is not installed."
    echo "Please install Docker first, then rerun this script."
    exit 1
fi

echo ""

# ------------------------------------------------------------
# 3. Verify Docker Compose
# ------------------------------------------------------------

echo "3. Verifying Docker Compose plugin..."

if docker compose version >/dev/null 2>&1; then
    docker compose version
else
    echo "ERROR: Docker Compose plugin is not available."
    echo "Expected command: docker compose version"
    echo "Please install Docker Compose plugin first."
    exit 1
fi

echo ""

# ------------------------------------------------------------
# 4. Verify Docker User Permission
# ------------------------------------------------------------

echo "4. Checking Docker user permission..."

if docker ps >/dev/null 2>&1; then
    echo "Docker permission is OK for user: $USER"
else
    echo "Docker permission issue detected."
    echo "Adding user '$USER' to docker group..."
    sudo usermod -aG docker "$USER"

    echo ""
    echo "IMPORTANT:"
    echo "User added to docker group."
    echo "Run this command manually after the script:"
    echo ""
    echo "newgrp docker"
    echo ""
    echo "Then rerun:"
    echo ""
    echo "$DOCKER_DIR/scripts/step-5-docker-runtime-setup.sh"
    echo ""
    exit 1
fi

echo ""

# ------------------------------------------------------------
# 5. Run Docker Test Container
# ------------------------------------------------------------

echo "5. Running Docker hello-world test..."

docker run --rm hello-world

echo ""

# ------------------------------------------------------------
# 6. Create Docker Project Folder Structure
# ------------------------------------------------------------

echo "6. Creating Docker folder structure..."

mkdir -p "$DOCKER_DIR/compose"
mkdir -p "$DOCKER_DIR/networks"
mkdir -p "$DOCKER_DIR/volumes/postgres"
mkdir -p "$DOCKER_DIR/volumes/couchdb"
mkdir -p "$DOCKER_DIR/volumes/fabric-peer"
mkdir -p "$DOCKER_DIR/volumes/fabric-orderer"
mkdir -p "$DOCKER_DIR/env"
mkdir -p "$DOCKER_DIR/scripts"

mkdir -p "$PROJECT_ROOT/fabric"
mkdir -p "$PROJECT_ROOT/blockchain-api"
mkdir -p "$PROJECT_ROOT/postgres/init"
mkdir -p "$PROJECT_ROOT/postgres/backups"
mkdir -p "$PROJECT_ROOT/couchdb/indexes"
mkdir -p "$PROJECT_ROOT/couchdb/config"

echo "Folder structure created under:"
echo "$PROJECT_ROOT"

echo ""

# ------------------------------------------------------------
# 7. Create Docker Networks
# ------------------------------------------------------------

echo "7. Creating Docker networks..."

docker network create blockchain-net 2>/dev/null || true
docker network create fabric-net 2>/dev/null || true
docker network create monitoring-net 2>/dev/null || true

echo "Docker networks created or already exist."

echo ""

# ------------------------------------------------------------
# 8. Verify Docker Networks
# ------------------------------------------------------------

echo "8. Verifying Docker networks..."

docker network ls

echo ""

# ------------------------------------------------------------
# 9. Create Network Creation Script
# ------------------------------------------------------------

echo "9. Creating create-networks.sh..."

cat > "$DOCKER_DIR/networks/create-networks.sh" <<'EOF'
#!/bin/bash

set -e

echo "Creating Docker networks for Blockchain Integration Project..."

docker network create blockchain-net 2>/dev/null || true
docker network create fabric-net 2>/dev/null || true
docker network create monitoring-net 2>/dev/null || true

echo "Docker networks created successfully."

docker network ls
EOF

chmod +x "$DOCKER_DIR/networks/create-networks.sh"

echo "Created:"
echo "$DOCKER_DIR/networks/create-networks.sh"

echo ""

# ------------------------------------------------------------
# 10. Create Docker Check Script
# ------------------------------------------------------------

echo "10. Creating docker-check.sh..."

cat > "$DOCKER_DIR/scripts/docker-check.sh" <<'EOF'
#!/bin/bash

echo "============================================================"
echo " Docker Verification"
echo "============================================================"

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
echo "All containers:"
docker ps -a

echo ""
echo "Docker images:"
docker images

echo ""
echo "Docker disk usage:"
docker system df

echo ""
echo "Docker verification completed."
EOF

chmod +x "$DOCKER_DIR/scripts/docker-check.sh"

echo "Created:"
echo "$DOCKER_DIR/scripts/docker-check.sh"

echo ""

# ------------------------------------------------------------
# 11. Create Restart Script for Work Server Timeout
# ------------------------------------------------------------

echo "11. Creating restart-containers.sh..."

cat > "$DOCKER_DIR/scripts/restart-containers.sh" <<'EOF'
#!/bin/bash

set -e

PROJECT_ROOT="$HOME/u01/blockchain-integration"
FABRIC_TEST_NETWORK="$PROJECT_ROOT/fabric/fabric-samples/test-network"

echo "============================================================"
echo " Restart Blockchain Integration Docker Runtime"
echo "============================================================"

echo ""
echo "Starting Docker service..."
sudo systemctl start docker
sudo systemctl enable docker

echo ""
echo "Checking Docker status..."
systemctl is-active docker

echo ""
echo "Recreating required Docker networks..."
docker network create blockchain-net 2>/dev/null || true
docker network create fabric-net 2>/dev/null || true
docker network create monitoring-net 2>/dev/null || true

echo ""
echo "Docker networks:"
docker network ls

echo ""
echo "Running containers:"
docker ps

echo ""
echo "Checking Fabric test-network folder..."

if [ -d "$FABRIC_TEST_NETWORK" ]; then
    echo "Fabric test-network found:"
    echo "$FABRIC_TEST_NETWORK"
    cd "$FABRIC_TEST_NETWORK"

    echo ""
    echo "Current Fabric containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo "Fabric test-network folder not found yet."
    echo "Expected path:"
    echo "$FABRIC_TEST_NETWORK"
fi

echo ""
echo "Restart script completed."
EOF

chmod +x "$DOCKER_DIR/scripts/restart-containers.sh"

echo "Created:"
echo "$DOCKER_DIR/scripts/restart-containers.sh"

echo ""

# ------------------------------------------------------------
# 12. Create Docker Clean Script
# ------------------------------------------------------------

echo "12. Creating docker-clean.sh..."

cat > "$DOCKER_DIR/scripts/docker-clean.sh" <<'EOF'
#!/bin/bash

echo "============================================================"
echo " Docker Cleanup Helper"
echo "============================================================"
echo ""
echo "WARNING:"
echo "This script removes unused Docker containers, images, and networks."
echo "It does NOT remove volumes by default to protect PostgreSQL, CouchDB, and Fabric ledger data."
echo ""

read -p "Continue cleanup? yes/no: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Cleaning unused Docker resources..."
docker system prune -a

echo ""
echo "Docker cleanup completed."
echo ""
echo "Current Docker disk usage:"
docker system df
EOF

chmod +x "$DOCKER_DIR/scripts/docker-clean.sh"

echo "Created:"
echo "$DOCKER_DIR/scripts/docker-clean.sh"

echo ""

# ------------------------------------------------------------
# 13. Create View Logs Script
# ------------------------------------------------------------

echo "13. Creating view-logs.sh..."

cat > "$DOCKER_DIR/scripts/view-logs.sh" <<'EOF'
#!/bin/bash

echo "============================================================"
echo " Docker Container Logs Viewer"
echo "============================================================"

if [ -z "$1" ]; then
    echo "Usage:"
    echo "./view-logs.sh <container_name>"
    echo ""
    echo "Available containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}"
    exit 1
fi

CONTAINER_NAME="$1"

echo "Showing logs for container:"
echo "$CONTAINER_NAME"
echo ""

docker logs -f "$CONTAINER_NAME"
EOF

chmod +x "$DOCKER_DIR/scripts/view-logs.sh"

echo "Created:"
echo "$DOCKER_DIR/scripts/view-logs.sh"

echo ""

# ------------------------------------------------------------
# 14. Create README for Step 5
# ------------------------------------------------------------

echo "14. Creating Docker README..."

cat > "$DOCKER_DIR/README.md" <<'EOF'
# STEP 5 — Docker & Container Runtime Setup

## Blockchain Integration Project

This folder contains Docker runtime scripts, Docker Compose files, environment files, volumes, and network helpers for the Blockchain Integration Project.

## Folder Structure

```text
docker/
├── compose/
│   ├── docker-compose.fabric.yml
│   ├── docker-compose.couchdb.yml
│   ├── docker-compose.postgres.yml
│   ├── docker-compose.monitoring.yml
│   └── docker-compose.dev.yml
│
├── networks/
│   └── create-networks.sh
│
├── volumes/
│   ├── postgres/
│   ├── couchdb/
│   ├── fabric-peer/
│   └── fabric-orderer/
│
├── env/
│   ├── postgres.env
│   ├── couchdb.env
│   ├── fabric.env
│   └── blockchain-api.env
│
├── scripts/
│   ├── step-5-docker-runtime-setup.sh
│   ├── docker-check.sh
│   ├── docker-clean.sh
│   ├── restart-containers.sh
│   └── view-logs.sh
│
└── README.md