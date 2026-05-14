#!/bin/bash
set -e

echo "=================================================="
echo "APPLY PROJECT VIEWER COUNT FEATURE"
echo "=================================================="

BACKEND_DIR="blockchain-api"
FRONTEND_DIR="blockchain-test-ui"

echo ""
echo "1) Backup files..."
cp "$BACKEND_DIR/src/server.js" "$BACKEND_DIR/src/server.js.bak_project_viewers_$(date +%Y%m%d_%H%M%S)"
cp "$FRONTEND_DIR/src/app/app.config.ts" "$FRONTEND_DIR/src/app/app.config.ts.bak_project_viewers_$(date +%Y%m%d_%H%M%S)"
cp "$FRONTEND_DIR/src/app/features/dashboard/dashboard.component.ts" "$FRONTEND_DIR/src/app/features/dashboard/dashboard.component.ts.bak_project_viewers_$(date +%Y%m%d_%H%M%S)"

echo ""
echo "2) Create backend controller..."

cat > "$BACKEND_DIR/src/controllers/project-view.controller.js" <<'EOC'
'use strict';

const db = require('../config/database');

let tableReady = false;

async function ensureProjectViewTable() {
  if (tableReady) {
    return;
  }

  await db.query(`
    CREATE SCHEMA IF NOT EXISTS blockchain;

    CREATE TABLE IF NOT EXISTS blockchain.project_view_logs (
      view_id BIGSERIAL PRIMARY KEY,
      page_url TEXT NOT NULL,
      page_title TEXT,
      source_system VARCHAR(100) DEFAULT 'BLOCKCHAIN_TEST_UI',
      viewer_ip VARCHAR(100),
      user_agent TEXT,
      session_id VARCHAR(200),
      referrer TEXT,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_project_view_logs_viewed_at
      ON blockchain.project_view_logs(viewed_at);

    CREATE INDEX IF NOT EXISTS idx_project_view_logs_session_id
      ON blockchain.project_view_logs(session_id);

    CREATE INDEX IF NOT EXISTS idx_project_view_logs_page_url
      ON blockchain.project_view_logs(page_url);

    CREATE INDEX IF NOT EXISTS idx_project_view_logs_today
      ON blockchain.project_view_logs((viewed_at::date));
  `);

  tableReady = true;
}

function getClientIp(req) {
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
}

exports.trackProjectView = async (req, res, next) => {
  try {
    await ensureProjectViewTable();

    const pageUrl = String(req.body?.pageUrl || req.body?.page_url || req.originalUrl || '').trim();
    const pageTitle = String(req.body?.pageTitle || req.body?.page_title || '').trim();
    const sourceSystem = String(req.body?.sourceSystem || req.body?.source_system || 'BLOCKCHAIN_TEST_UI').trim();
    const sessionId = String(req.body?.sessionId || req.body?.session_id || req.headers['x-session-id'] || '').trim();
    const referrer = String(req.body?.referrer || req.headers.referer || req.headers.referrer || '').trim();

    if (!pageUrl) {
      return res.status(400).json({
        success: false,
        message: 'pageUrl is required',
        errorCode: 'PAGE_URL_REQUIRED',
        data: null,
        timestamp: new Date().toISOString(),
        requestId: req.requestId || null,
        correlationId: req.correlationId || req.requestId || null
      });
    }

    const result = await db.query(
      `
      INSERT INTO blockchain.project_view_logs (
        page_url,
        page_title,
        source_system,
        viewer_ip,
        user_agent,
        session_id,
        referrer
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        view_id,
        page_url,
        page_title,
        source_system,
        viewer_ip,
        session_id,
        viewed_at
      `,
      [
        pageUrl,
        pageTitle || null,
        sourceSystem || 'BLOCKCHAIN_TEST_UI',
        getClientIp(req),
        req.headers['user-agent'] || null,
        sessionId || null,
        referrer || null
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Project view tracked successfully',
      data: result.rows[0],
      timestamp: new Date().toISOString(),
      requestId: req.requestId || null,
      correlationId: req.correlationId || req.requestId || null
    });
  } catch (error) {
    return next(error);
  }
};

exports.getProjectViewStats = async (req, res, next) => {
  try {
    await ensureProjectViewTable();

    const statsResult = await db.query(`
      SELECT
        COUNT(*)::BIGINT AS total_views,
        COUNT(*) FILTER (
          WHERE viewed_at >= CURRENT_DATE
            AND viewed_at < CURRENT_DATE + INTERVAL '1 day'
        )::BIGINT AS today_views,
        COUNT(
          DISTINCT COALESCE(
            NULLIF(session_id, ''),
            COALESCE(viewer_ip, '') || '|' || COALESCE(user_agent, '')
          )
        )::BIGINT AS unique_visitors,
        MAX(viewed_at) AS last_viewed_at
      FROM blockchain.project_view_logs
    `);

    const pagesResult = await db.query(`
      SELECT
        page_url,
        COALESCE(MAX(page_title), '') AS page_title,
        COUNT(*)::BIGINT AS view_count,
        MAX(viewed_at) AS last_viewed_at
      FROM blockchain.project_view_logs
      GROUP BY page_url
      ORDER BY COUNT(*) DESC, MAX(viewed_at) DESC
      LIMIT 10
    `);

    const row = statsResult.rows[0] || {};

    return res.status(200).json({
      success: true,
      message: 'Project view stats loaded successfully',
      data: {
        totalViews: Number(row.total_views || 0),
        todayViews: Number(row.today_views || 0),
        uniqueVisitors: Number(row.unique_visitors || 0),
        lastViewedAt: row.last_viewed_at || null,
        mostViewedPages: pagesResult.rows.map((page) => ({
          pageUrl: page.page_url,
          pageTitle: page.page_title,
          viewCount: Number(page.view_count || 0),
          lastViewedAt: page.last_viewed_at
        }))
      },
      source: 'blockchain.project_view_logs',
      timestamp: new Date().toISOString(),
      requestId: req.requestId || null,
      correlationId: req.correlationId || req.requestId || null
    });
  } catch (error) {
    return next(error);
  }
};
EOC

echo ""
echo "3) Create backend route..."

cat > "$BACKEND_DIR/src/routes/project-view.routes.js" <<'EOR'
'use strict';

const express = require('express');
const router = express.Router();

const projectViewController = require('../controllers/project-view.controller');

router.post('/track', projectViewController.trackProjectView);
router.get('/stats', projectViewController.getProjectViewStats);

module.exports = router;
EOR

echo ""
echo "4) Patch backend server.js..."

python3 <<'PY'
from pathlib import Path

path = Path("blockchain-api/src/server.js")
text = path.read_text()

if "project-view.routes" not in text:
    text = text.replace(
        "const organizationRoutes = safeRoute('./routes/organization.routes', 'organization.routes');",
        "const organizationRoutes = safeRoute('./routes/organization.routes', 'organization.routes');\nconst projectViewRoutes = safeRoute('./routes/project-view.routes', 'project-view.routes');"
    )

if "app.use('/api/v1/project-views', projectViewRoutes);" not in text:
    text = text.replace(
        """if (organizationRoutes) {
  app.use('/api/v1/organizations', organizationRoutes);
}""",
        """if (organizationRoutes) {
  app.use('/api/v1/organizations', organizationRoutes);
}

if (projectViewRoutes) {
  app.use('/api/v1/project-views', projectViewRoutes);
}"""
    )

if "projectViews: '/api/v1/project-views/stats'" not in text:
    text = text.replace(
        "organizations: '/api/v1/organizations'",
        "organizations: '/api/v1/organizations',\n      projectViews: '/api/v1/project-views/stats'"
    )

path.write_text(text)
PY

echo ""
echo "5) Create frontend Project View API service..."

mkdir -p "$FRONTEND_DIR/src/app/core/services"

cat > "$FRONTEND_DIR/src/app/core/services/project-view-api.service.ts" <<'EOF2'
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

import { ApiConfigService } from './api-config.service';

export interface ProjectViewStats {
  totalViews: number;
  todayViews: number;
  uniqueVisitors: number;
  lastViewedAt: string | null;
  mostViewedPages: Array<{
    pageUrl: string;
    pageTitle: string;
    viewCount: number;
    lastViewedAt: string | null;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectViewApiService {
  private http = inject(HttpClient);
  private config = inject(ApiConfigService);

  trackView(payload: {
    pageUrl: string;
    pageTitle?: string;
    sessionId?: string;
    sourceSystem?: string;
    referrer?: string;
  }): Observable<any> {
    return this.http.post(`${this.config.baseUrl}/project-views/track`, {
      pageUrl: payload.pageUrl,
      pageTitle: payload.pageTitle || document.title || 'Blockchain Test UI',
      sessionId: payload.sessionId || this.getOrCreateSessionId(),
      sourceSystem: payload.sourceSystem || 'BLOCKCHAIN_TEST_UI',
      referrer: payload.referrer || document.referrer || ''
    }).pipe(
      catchError((error) => {
        console.warn('[PROJECT_VIEW_TRACK_FAILED]', error);
        return of(null);
      })
    );
  }

  getStats(): Observable<any> {
    return this.http.get(`${this.config.baseUrl}/project-views/stats`).pipe(
      catchError((error) => {
        console.warn('[PROJECT_VIEW_STATS_FAILED]', error);
        return of({
          success: false,
          data: {
            totalViews: 0,
            todayViews: 0,
            uniqueVisitors: 0,
            lastViewedAt: null,
            mostViewedPages: []
          }
        });
      })
    );
  }

  getOrCreateSessionId(): string {
    const key = 'blockchain_project_view_session_id';
    const existing = localStorage.getItem(key);

    if (existing) {
      return existing;
    }

    const generated =
      'BC_VIEW_' +
      Date.now().toString(36).toUpperCase() +
      '_' +
      Math.random().toString(16).slice(2).toUpperCase();

    localStorage.setItem(key, generated);
    return generated;
  }
}
EOF2

echo ""
echo "6) Create frontend route tracker service..."

cat > "$FRONTEND_DIR/src/app/core/services/project-view-tracker.service.ts" <<'EOF3'
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { ProjectViewApiService } from './project-view-api.service';

@Injectable({
  providedIn: 'root'
})
export class ProjectViewTrackerService {
  private router = inject(Router);
  private projectViewApi = inject(ProjectViewApiService);

  private started = false;
  private lastTrackedUrl = '';

  startTracking(): void {
    if (this.started) {
      return;
    }

    this.started = true;

    setTimeout(() => {
      this.trackCurrentPage();
    }, 300);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects || event.url;

        if (url === this.lastTrackedUrl) {
          return;
        }

        this.trackPage(url);
      });
  }

  private trackCurrentPage(): void {
    const url = window.location.pathname + window.location.search + window.location.hash;
    this.trackPage(url || '/');
  }

  private trackPage(url: string): void {
    this.lastTrackedUrl = url;

    this.projectViewApi.trackView({
      pageUrl: url,
      pageTitle: this.getPageTitle(url),
      sessionId: this.projectViewApi.getOrCreateSessionId(),
      sourceSystem: 'BLOCKCHAIN_TEST_UI',
      referrer: document.referrer || ''
    }).subscribe();
  }

  private getPageTitle(url: string): string {
    const cleanUrl = String(url || '').split('?')[0];

    const titleMap: Record<string, string> = {
      '/digital-kyc/dashboard': 'Digital KYC Dashboard',
      '/digital-kyc/wallet-create': 'Wallet Create',
      '/digital-kyc/organization-wallet-create': 'Organization Wallet Create',
      '/digital-kyc/wallet-login': 'Wallet Login',
      '/digital-kyc/wallet-query': 'Wallet Query',
      '/digital-kyc/wallet-information': 'Wallet Information',
      '/digital-kyc/fabric-test': 'Fabric Test',
      '/digital-kyc/balance-query': 'Balance Query',
      '/digital-kyc/wallet-transfer': 'Wallet Transfer',
      '/digital-kyc/organization-transfer': 'Organization Transfer',
      '/digital-kyc/transaction-history': 'Transaction History',
      '/data-generation-engine': 'Data Generation Engine'
    };

    return titleMap[cleanUrl] || 'Blockchain Test UI';
  }
}
EOF3

echo ""
echo "7) Update app.config.ts for global tracking..."

cat > "$FRONTEND_DIR/src/app/app.config.ts" <<'EOF4'
import { ApplicationConfig, ENVIRONMENT_INITIALIZER, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { ProjectViewTrackerService } from './core/services/project-view-tracker.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        inject(ProjectViewTrackerService).startTracking();
      }
    }
  ]
};
EOF4

echo ""
echo "8) Patch dashboard.component.ts to show viewer cards..."

python3 <<'PY'
from pathlib import Path
import re

path = Path("blockchain-test-ui/src/app/features/dashboard/dashboard.component.ts")
text = path.read_text()

if "ProjectViewApiService" not in text:
    text = text.replace(
        "import { WalletApiService } from '../../core/services/wallet-api.service';",
        "import { WalletApiService } from '../../core/services/wallet-api.service';\nimport { ProjectViewApiService } from '../../core/services/project-view-api.service';"
    )

viewer_html = """
      <div class="stats-grid viewer-stats-grid">
        <div class="stat-card viewer-card">
          <span>Total Project Views</span>
          <strong>{{ projectViewStats.totalViews }}</strong>
          <p>All blockchain UI page opens</p>
        </div>

        <div class="stat-card viewer-card">
          <span>Unique Visitors</span>
          <strong>{{ projectViewStats.uniqueVisitors }}</strong>
          <p>Based on browser session</p>
        </div>

        <div class="stat-card viewer-card">
          <span>Today Views</span>
          <strong>{{ projectViewStats.todayViews }}</strong>
          <p>Views recorded today</p>
        </div>

        <div class="stat-card viewer-card">
          <span>Last Viewed At</span>
          <strong class="small-value">{{ formatDateTime(projectViewStats.lastViewedAt) }}</strong>
          <p>Latest project access time</p>
        </div>
      </div>
"""

if "Total Project Views" not in text:
    text = text.replace(
        "      <div class=\"search-card\">",
        viewer_html + "\n      <div class=\"search-card\">",
        1
    )

if "projectViewStats =" not in text:
    text = re.sub(
        r"(export class DashboardComponent implements OnInit \{\s*)",
        r"""\1
  projectViewStats = {
    totalViews: 0,
    todayViews: 0,
    uniqueVisitors: 0,
    lastViewedAt: null as string | null,
    mostViewedPages: [] as any[]
  };

  private projectViewApi = new ProjectViewApiService((this as any).http, (this as any).config);
""",
        text,
        count=1
    )

# Safer injection patch for components that already use constructor injection is hard without full class.
# Therefore use Angular inject() import if needed.
if "inject" not in text.split("from '@angular/core'")[0]:
    text = text.replace(
        "import { ChangeDetectorRef, Component, OnInit } from '@angular/core';",
        "import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';"
    )

# Replace unsafe constructor-created service with inject().
text = text.replace(
    "  private projectViewApi = new ProjectViewApiService((this as any).http, (this as any).config);\n",
    "  private projectViewApi = inject(ProjectViewApiService);\n"
)

if "loadProjectViewStats()" not in text:
    text = re.sub(
        r"(ngOnInit\(\): void \{\s*)",
        r"\1\n    this.loadProjectViewStats();\n",
        text,
        count=1
    )

if "loadProjectViewStats(): void" not in text:
    insert_methods = """

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

        try {
          this.cdr.detectChanges();
        } catch {
          // no action needed
        }
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
    text = text.replace("\n}\n", insert_methods + "\n}\n", 1)

# Refresh should also reload stats.
if "this.loadProjectViewStats();" not in re.sub(r"ngOnInit\(\): void \{.*?\}", "", text, flags=re.S):
    text = re.sub(
        r"(refresh\(\): void \{\s*)",
        r"\1\n    this.loadProjectViewStats();\n",
        text,
        count=1
    )

if ".small-value" not in text:
    text = text.replace(
        "      .stat-card strong.source {",
        """      .stat-card strong.small-value {
        font-size: 16px;
        letter-spacing: 0;
        word-break: break-word;
      }

      .viewer-stats-grid {
        margin-top: -6px;
      }

      .viewer-card {
        border-left: 5px solid #004aad;
      }

      .stat-card strong.source {"""
    )

path.write_text(text)
PY

echo ""
echo "9) Syntax checks..."

node -c "$BACKEND_DIR/src/controllers/project-view.controller.js"
node -c "$BACKEND_DIR/src/routes/project-view.routes.js"
node -c "$BACKEND_DIR/src/server.js"

echo ""
echo "=================================================="
echo "DONE."
echo "Now restart backend and frontend."
echo "=================================================="
