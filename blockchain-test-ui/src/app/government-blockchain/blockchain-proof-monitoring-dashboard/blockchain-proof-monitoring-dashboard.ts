import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-blockchain-proof-monitoring-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './blockchain-proof-monitoring-dashboard.html',
  styleUrls: ['./blockchain-proof-monitoring-dashboard.css']
})
export class BlockchainProofMonitoringDashboard implements OnInit, OnDestroy {
  data: any = null;
  auditData: any = null;
  loading = false;
  error = '';
  autoRefresh = true;
  lastLoadedAt: string | null = null;

  dashboardFilters = {
    limit: 5,
    moduleName: 'ALL',
    status: 'ALL',
    dateFrom: '',
    dateTo: ''
  };

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

  get audit(): any {
    return this.auditData || {};
  }

  get auditMetrics(): any {
    return this.audit?.metrics || {};
  }

  get auditRecordsByModule(): any[] {
    return this.audit?.recordsByModule || [];
  }

  get auditRecordsByStatus(): any[] {
    return this.audit?.recordsByStatus || [];
  }

  get latestBlockchainTransactions(): any[] {
    return this.audit?.latestBlockchainTransactions || [];
  }

  get verificationTrend(): any[] {
    return this.audit?.verificationTrend || [];
  }

  number(value: any): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
  }

  private buildDashboardQueryString(): string {
    const params = new URLSearchParams();

    params.set('limit', String(this.dashboardFilters.limit || 5));

    if (this.dashboardFilters.moduleName && this.dashboardFilters.moduleName !== 'ALL') {
      params.set('moduleName', this.dashboardFilters.moduleName);
    }

    if (this.dashboardFilters.status && this.dashboardFilters.status !== 'ALL') {
      params.set('status', this.dashboardFilters.status);
    }

    if (this.dashboardFilters.dateFrom) {
      params.set('dateFrom', this.dashboardFilters.dateFrom);
    }

    if (this.dashboardFilters.dateTo) {
      params.set('dateTo', this.dashboardFilters.dateTo);
    }

    return params.toString();
  }

  clearFilters(): void {
    this.dashboardFilters = {
      limit: 5,
      moduleName: 'ALL',
      status: 'ALL',
      dateFrom: '',
      dateTo: ''
    };

    this.loadDashboard(true);
  }

  refreshWithFilters(): void {
    this.loadDashboard(true);
  }

  async loadDashboard(showLoading = true): Promise<void> {
    if (showLoading) {
      this.loading = true;
    }

    this.error = '';

    try {
      const queryString = this.buildDashboardQueryString();

      const response = await fetch(`${this.apiBaseUrl}/dashboard/full?limit=${this.dashboardFilters.limit || 5}`, {
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

      await this.loadAuditMetrics(false, queryString);

      this.lastLoadedAt = new Date().toISOString();
    } catch (error: any) {
      this.error = error?.message || 'Unable to load blockchain proof monitoring dashboard.';
    } finally {
      this.loading = false;
    }
  }

  async loadAuditMetrics(showLoading = true, queryString = this.buildDashboardQueryString()): Promise<void> {
    if (showLoading) {
      this.loading = true;
    }

    this.error = '';

    try {
      const response = await fetch(`${this.apiBaseUrl}/dashboard/audit-metrics?${queryString}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || `Audit dashboard API failed with HTTP ${response.status}`);
      }

      this.auditData = payload.data;
      this.lastLoadedAt = new Date().toISOString();
    } catch (error: any) {
      this.error = error?.message || 'Unable to load audit dashboard metrics.';
    } finally {
      if (showLoading) {
        this.loading = false;
      }
    }
  }
}
