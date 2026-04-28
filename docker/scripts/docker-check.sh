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
