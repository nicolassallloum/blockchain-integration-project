import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-blockchain-proof-monitoring-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './blockchain-proof-monitoring-dashboard.html',
  styles: [`
    .monitoring-page {
      padding: 24px;
      min-height: 100vh;
      color: #e5eefc;
      background:
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.24), transparent 30%),
        radial-gradient(circle at top right, rgba(14, 165, 233, 0.18), transparent 28%),
        #07111f;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .title-block h1 {
      margin: 0 0 6px;
      font-size: 28px;
      font-weight: 700;
    }

    .title-block p {
      margin: 0;
      color: #9fb3d1;
      font-size: 14px;
    }

    .actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .refresh-button {
      border: 1px solid rgba(125, 211, 252, 0.45);
      background: rgba(14, 165, 233, 0.14);
      color: #e0f2fe;
      padding: 10px 16px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
    }

    .refresh-button:hover {
      background: rgba(14, 165, 233, 0.25);
    }

    .auto-refresh {
      color: #b6c7df;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-bar {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }

    .status-pill {
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.78);
      border: 1px solid rgba(148, 163, 184, 0.25);
      color: #cbd5e1;
      font-size: 13px;
    }

    .status-pill.good {
      border-color: rgba(34, 197, 94, 0.45);
      color: #bbf7d0;
    }

    .status-pill.warning {
      border-color: rgba(251, 191, 36, 0.45);
      color: #fde68a;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }

    .card {
      background: rgba(15, 23, 42, 0.78);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
    }

    .card .label {
      color: #9fb3d1;
      font-size: 13px;
      margin-bottom: 8px;
    }

    .card .value {
      font-size: 28px;
      font-weight: 800;
      color: #f8fafc;
    }

    .card .hint {
      margin-top: 8px;
      color: #94a3b8;
      font-size: 12px;
    }

    .grid-two {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .panel {
      background: rgba(15, 23, 42, 0.78);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 16px;
      padding: 16px;
      overflow-x: auto;
    }

    .panel h2 {
      margin: 0 0 12px;
      font-size: 18px;
      color: #f8fafc;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 620px;
    }

    th, td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      font-size: 13px;
      vertical-align: top;
    }

    th {
      color: #93c5fd;
      font-weight: 700;
      background: rgba(30, 41, 59, 0.55);
    }

    td {
      color: #dbeafe;
    }

    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      word-break: break-all;
    }

    .empty-state,
    .error-state,
    .loading-state {
      border-radius: 14px;
      padding: 18px;
      background: rgba(15, 23, 42, 0.78);
      border: 1px solid rgba(148, 163, 184, 0.18);
      color: #cbd5e1;
    }

    .error-state {
      border-color: rgba(248, 113, 113, 0.45);
      color: #fecaca;
      margin-bottom: 16px;
    }

    .success-text {
      color: #86efac;
      font-weight: 700;
    }

    .danger-text {
      color: #fca5a5;
      font-weight: 700;
    }

    .muted {
      color: #94a3b8;
    }

    @media (max-width: 768px) {
      .monitoring-page {
        padding: 16px;
      }

      .page-header {
        flex-direction: column;
      }

      .grid-two {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class BlockchainProofMonitoringDashboard implements OnInit, OnDestroy {
  data: any = null;
  loading = false;
  error = '';
  autoRefresh = true;
  lastLoadedAt: string | null = null;

  private refreshTimer: any = null;

  ngOnInit(): void {
    this.loadDashboard(true);

    this.refreshTimer = setInterval(() => {
      if (this.autoRefresh) {
        this.loadDashboard(false);
      }
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  get apiBaseUrl(): string {
    if (typeof window === 'undefined') {
      return 'http://localhost:3001/api/v1/blockchain-proof/api';
    }

    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';

    return `${protocol}//${hostname}:3001/api/v1/blockchain-proof/api`;
  }

  get health(): any {
    return this.data?.health || {};
  }

  get summary(): any {
    return this.data?.summary || {};
  }

  get history(): any {
    return this.summary?.history || {};
  }

  get runs(): any {
    return this.summary?.runs || {};
  }

  get verification(): any {
    return this.summary?.verification || {};
  }

  get recordTypeBreakdown(): any[] {
    return this.summary?.recordTypeBreakdown || [];
  }

  get syncStatusBreakdown(): any[] {
    return this.summary?.syncStatusBreakdown || [];
  }

  get verificationStatusBreakdown(): any[] {
    return this.summary?.verificationStatusBreakdown || [];
  }

  get retrySummary(): any {
    return this.summary?.retrySummary || {};
  }

  get latestRuns(): any[] {
    return this.data?.latestRuns?.rows || [];
  }

  get latestHistory(): any[] {
    return this.data?.latestHistory?.rows || [];
  }

  get latestVerificationLogs(): any[] {
    return this.data?.latestVerificationLogs?.rows || [];
  }

  number(value: any): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
  }

  async loadDashboard(showLoading = true): Promise<void> {
    if (showLoading) {
      this.loading = true;
    }

    this.error = '';

    try {
      const response = await fetch(`${this.apiBaseUrl}/dashboard/full?limit=5`, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || `Dashboard API failed with HTTP ${response.status}`);
      }

      this.data = payload.data;
      this.lastLoadedAt = new Date().toISOString();
    } catch (error: any) {
      this.error = error?.message || 'Unable to load blockchain proof monitoring dashboard.';
    } finally {
      this.loading = false;
    }
  }
}
