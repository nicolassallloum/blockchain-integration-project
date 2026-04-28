#!/bin/bash

set -e

echo "Creating Docker networks for Blockchain Integration Project..."

docker network create blockchain-net 2>/dev/null || true
docker network create fabric-net 2>/dev/null || true
docker network create monitoring-net 2>/dev/null || true

echo "Docker networks created successfully."

docker network ls
