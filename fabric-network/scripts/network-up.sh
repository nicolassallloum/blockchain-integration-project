#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Starting Fabric network..."

docker compose -f docker/docker-compose-fabric.yaml up -d

echo "Fabric containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "Network started successfully."