#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Stopping Fabric network..."

docker compose -f docker/docker-compose-fabric.yaml down

echo "Network stopped."