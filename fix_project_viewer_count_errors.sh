#!/bin/bash
set -e

echo "=================================================="
echo "FIX PROJECT VIEWER COUNT ERRORS"
echo "=================================================="

BACKEND_DIR="blockchain-api"
FRONTEND_DIR="blockchain-test-ui"

echo ""
echo "1) Backup current files..."
cp "$BACKEND_DIR/src/controllers/project-view.controller.js" "$BACKEND_DIR/src/controllers/project-view.controller.js.bak_fix_$(date +%Y%m%d_%H%M%S)"
cp "$FRONTEND_DIR/src/app/features/dashboard/dashboard.component.ts" "$FRONTEND_DIR/src/app/features/dashboard/dashboard.component.ts.bak_fix_$(date +%Y%m%d_%H%M%S)"

echo ""
echo "2) Fix backend referrer column issue..."

python3 <<'PY'
from pathlib import Path

path = Path("blockchain-api/src/controllers/project-view.controller.js")
text = path.read_text()

needle = """
    CREATE INDEX IF NOT EXISTS idx_project_view_logs_today
      ON blockchain.project_view_logs((viewed_at::date));
"""

replacement = """
    ALTER TABLE blockchain.project_view_logs
      ADD COLUMN IF NOT EXISTS referrer TEXT;

    CREATE INDEX IF NOT EXISTS idx_project_view_logs_today
      ON blockchain.project_view_logs((viewed_at::date));
"""

if "ADD COLUMN IF NOT EXISTS referrer TEXT" not in text:
    text = text.replace(needle, replacement)

path.write_text(text)
PY

echo ""
echo "3) Fix Angular dashboard missing methods..."

python3 <<'PY'
from pathlib import Path

path = Path("blockchain-test-ui/src/app/features/dashboard/dashboard.component.ts")
text = path.read_text()

# Ensure inject import exists.
text = text.replace(
    "import { ChangeDetectorRef, Component, OnInit } from '@angular/core';",
    "import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';"
)

# Ensure ProjectViewApiService import exists.
if "project-view-api.service" not in text:
    text = text.replace(
        "import { WalletApiService } from '../../core/services/wallet-api.service';",
        "import { WalletApiService } from '../../core/services/wallet-api.service';\nimport { ProjectViewApiService } from '../../core/services/project-view-api.service';"
    )

# Ensure projectViewApi property exists inside class.
class_pos = text.find("export class DashboardComponent")
if class_pos == -1:
    raise SystemExit("DashboardComponent class not found")

brace_pos = text.find("{", class_pos)
if brace_pos == -1:
    raise SystemExit("DashboardComponent opening brace not found")

if "private projectViewApi = inject(ProjectViewApiService);" not in text:
    insert_after = brace_pos + 1
    text = text[:insert_after] + "\n  private projectViewApi = inject(ProjectViewApiService);\n" + text[insert_after:]

# Find real class closing brace by brace matching.
class_pos = text.find("export class DashboardComponent")
brace_pos = text.find("{", class_pos)

depth = 0
class_end = -1
for i in range(brace_pos, len(text)):
    ch = text[i]
    if ch == "{":
        depth += 1
    elif ch == "}":
        depth -= 1
        if depth == 0:
            class_end = i
            break

if class_end == -1:
    raise SystemExit("DashboardComponent closing brace not found")

methods = """

  loadProjectViewStats(): void {
    this.projectViewApi.getStats().subscribe({
      next: (response: any) => {
        const data = response?.data || {};

        this.projectViewStats = {
          totalViews: Number(data.totalViews || 0),
          todayViews: Number(data.todayViews || 0),
          uniqueVisitors: Number(data.uniqueVisitors || 0),
          lastViewedAt: data.lastViewedAt || null,
          mostViewedPages: Array.isArray(data.mostViewedPages) ? data.mostViewedPages : []
        };
      },
      error: () => {
        this.projectViewStats = {
          totalViews: 0,
          todayViews: 0,
          uniqueVisitors: 0,
          lastViewedAt: null,
          mostViewedPages: []
        };
      }
    });
  }

  formatDateTime(value: string | null): string {
    if (!value) {
      return '-';
    }

    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }
"""

if "loadProjectViewStats(): void" not in text:
    text = text[:class_end] + methods + "\n" + text[class_end:]

path.write_text(text)
PY

echo ""
echo "4) Check backend JS syntax..."
node -c "$BACKEND_DIR/src/controllers/project-view.controller.js"
node -c "$BACKEND_DIR/src/routes/project-view.routes.js"
node -c "$BACKEND_DIR/src/server.js"

echo ""
echo "5) Build Angular..."
cd "$FRONTEND_DIR"
npm run build

echo ""
echo "=================================================="
echo "FIX DONE SUCCESSFULLY"
echo "=================================================="
