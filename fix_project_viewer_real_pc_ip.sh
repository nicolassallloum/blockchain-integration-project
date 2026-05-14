#!/bin/bash
set -e

BACKEND_FILE="blockchain-api/src/controllers/project-view.controller.js"

echo "Backup backend controller..."
cp "$BACKEND_FILE" "$BACKEND_FILE.bak_real_pc_ip_$(date +%Y%m%d_%H%M%S)"

echo "Patch getClientIp function..."

python3 <<'PY'
from pathlib import Path

path = Path("blockchain-api/src/controllers/project-view.controller.js")
text = path.read_text()

old = """function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim();
  }

  return (
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
}"""

new = """function isValidIp(value) {
  if (!value) {
    return false;
  }

  const ip = String(value).trim();

  return (
    /^(\\\\d{1,3}\\\\.){3}\\\\d{1,3}$/.test(ip) ||
    /^[a-fA-F0-9:]+$/.test(ip)
  );
}

function getClientIp(req) {
  /*
   * Priority:
   * 1. viewerIp from Angular UI body
   * 2. x-viewer-ip custom header
   * 3. x-forwarded-for proxy header
   * 4. x-real-ip proxy header
   * 5. Node socket remote address
   */

  const bodyViewerIp =
    req.body?.viewerIp ||
    req.body?.viewer_ip ||
    null;

  if (isValidIp(bodyViewerIp)) {
    return String(bodyViewerIp).trim();
  }

  const headerViewerIp = req.headers['x-viewer-ip'];

  if (isValidIp(headerViewerIp)) {
    return String(headerViewerIp).trim();
  }

  const forwardedFor = req.headers['x-forwarded-for'];

  if (forwardedFor) {
    const firstIp = String(forwardedFor).split(',')[0].trim();

    if (isValidIp(firstIp)) {
      return firstIp;
    }
  }

  const realIp = req.headers['x-real-ip'];

  if (isValidIp(realIp)) {
    return String(realIp).trim();
  }

  const socketIp =
    req.socket?.remoteAddress ||
    req.ip ||
    null;

  if (!socketIp) {
    return null;
  }

  return String(socketIp)
    .replace('::ffff:', '')
    .trim();
}"""

if old not in text:
    raise SystemExit("Old getClientIp function not found. Please send project-view.controller.js.")

text = text.replace(old, new)

path.write_text(text)
PY

node -c "$BACKEND_FILE"

echo "DONE backend IP patch."
