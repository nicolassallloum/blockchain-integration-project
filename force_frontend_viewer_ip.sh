#!/bin/bash
set -e

FILE="blockchain-test-ui/src/app/core/services/project-view-api.service.ts"

echo "Backup file..."
cp "$FILE" "$FILE.bak_force_viewer_ip_$(date +%Y%m%d_%H%M%S)"

cat > "$FILE" <<'EOF2'
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  /**
   * IMPORTANT:
   * Browser cannot automatically read the private LAN IP for privacy reasons.
   * Therefore we force the PC IP here.
   */
  private readonly defaultViewerIp = '10.1.8.71';

  trackView(payload: {
    pageUrl: string;
    pageTitle?: string;
    sessionId?: string;
    sourceSystem?: string;
    referrer?: string;
    viewerIp?: string;
  }): Observable<any> {
    const viewerIp =
      payload.viewerIp ||
      localStorage.getItem('blockchain_viewer_ip') ||
      sessionStorage.getItem('blockchain_viewer_ip') ||
      this.defaultViewerIp;

    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .set('x-viewer-ip', viewerIp);

    return this.http.post(
      `${this.config.baseUrl}/project-views/track`,
      {
        pageUrl: payload.pageUrl,
        pageTitle: payload.pageTitle || document.title || 'Blockchain Test UI',
        sessionId: payload.sessionId || this.getOrCreateSessionId(),
        sourceSystem: payload.sourceSystem || 'BLOCKCHAIN_TEST_UI',
        referrer: payload.referrer || document.referrer || '',
        viewerIp
      },
      { headers }
    ).pipe(
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

echo "Build frontend..."
cd blockchain-test-ui
npm run build

echo "DONE. Frontend now forces viewerIp = 10.1.8.71"
