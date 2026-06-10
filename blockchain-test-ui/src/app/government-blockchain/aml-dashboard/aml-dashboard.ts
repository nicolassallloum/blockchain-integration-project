import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';

import {
  AmlDashboardChartPoint,
  AmlDashboardCharts,
  AmlDashboardSummary,
  GovernmentAmlDashboardApiService
} from '../../services/government-aml-dashboard-api.service';

interface SummaryCard {
  title: string;
  value: number;
  description: string;
  className: string;
}

@Component({
  selector: 'app-aml-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aml-dashboard.html',
  styleUrl: './aml-dashboard.scss',
})
export class AmlDashboard implements OnInit {
  loading = false;
  errorMessage = '';
  lastUpdated = '';

  summary: AmlDashboardSummary = {
    totalAmlAlerts: 0,
    openAlerts: 0,
    highRiskAlerts: 0,
    closedAlerts: 0,
    alertsToday: 0
  };

  charts: AmlDashboardCharts = {
    alertsByRiskLevel: [],
    alertsByStatus: [],
    alertsByDate: [],
    topAmlRulesTriggered: []
  };

  constructor(private readonly amlDashboardApi: GovernmentAmlDashboardApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      summaryResponse: this.amlDashboardApi.getSummary(),
      chartsResponse: this.amlDashboardApi.getCharts()
    }).subscribe({
      next: ({ summaryResponse, chartsResponse }) => {
        if (!summaryResponse?.success || !chartsResponse?.success) {
          this.errorMessage = 'AML dashboard API returned an unsuccessful response.';
          return;
        }

        this.summary = {
          totalAmlAlerts: Number(summaryResponse.data?.totalAmlAlerts || 0),
          openAlerts: Number(summaryResponse.data?.openAlerts || 0),
          highRiskAlerts: Number(summaryResponse.data?.highRiskAlerts || 0),
          closedAlerts: Number(summaryResponse.data?.closedAlerts || 0),
          alertsToday: Number(summaryResponse.data?.alertsToday || 0)
        };

        this.charts = {
          alertsByRiskLevel: this.normalizeChart(chartsResponse.data?.alertsByRiskLevel),
          alertsByStatus: this.normalizeChart(chartsResponse.data?.alertsByStatus),
          alertsByDate: this.normalizeChart(chartsResponse.data?.alertsByDate),
          topAmlRulesTriggered: this.normalizeChart(chartsResponse.data?.topAmlRulesTriggered)
        };

        this.lastUpdated = new Date().toLocaleString();
      },
      error: (error) => {
        console.error('AML dashboard load failed:', error);
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to load AML dashboard data from PostgreSQL.';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  get cards(): SummaryCard[] {
    return [
      {
        title: 'Total AML Alerts',
        value: this.summary.totalAmlAlerts,
        description: 'Detected by AML rules engine',
        className: 'info-card'
      },
      {
        title: 'Open Alerts',
        value: this.summary.openAlerts,
        description: 'Pending compliance review',
        className: 'warning-card'
      },
      {
        title: 'High Risk Alerts',
        value: this.summary.highRiskAlerts,
        description: 'High or critical severity',
        className: 'danger-card'
      },
      {
        title: 'Closed Alerts',
        value: this.summary.closedAlerts,
        description: 'Resolved AML alerts',
        className: 'success-card'
      },
      {
        title: 'Alerts Today',
        value: this.summary.alertsToday,
        description: 'Created today',
        className: 'today-card'
      }
    ];
  }

  getMaxValue(rows: AmlDashboardChartPoint[]): number {
    const values = (rows || []).map((row) => Number(row.value || 0));
    return Math.max(...values, 1);
  }

  getBarWidth(value: number, rows: AmlDashboardChartPoint[]): string {
    const max = this.getMaxValue(rows);
    const width = Math.round((Number(value || 0) / max) * 100);
    return `${Math.max(width, 4)}%`;
  }

  getRiskClass(label: string): string {
    const normalized = String(label || '').toUpperCase();

    if (['HIGH', 'CRITICAL'].includes(normalized)) {
      return 'high';
    }

    if (normalized === 'MEDIUM') {
      return 'medium';
    }

    if (normalized === 'LOW') {
      return 'low';
    }

    return 'neutral';
  }

  getStatusBadgeClass(label: string): string {
    const normalized = String(label || '').toUpperCase();

    if (['CLOSED', 'RESOLVED', 'APPROVED'].includes(normalized)) {
      return 'success';
    }

    if (['OPEN', 'NEW', 'IN_REVIEW', 'ESCALATED'].includes(normalized)) {
      return 'warning';
    }

    if (['BLOCKED', 'REJECTED', 'FAILED'].includes(normalized)) {
      return 'danger';
    }

    return 'info';
  }

  trackByLabel(index: number, item: AmlDashboardChartPoint): string {
    return `${item.label}-${index}`;
  }

  private normalizeChart(rows?: AmlDashboardChartPoint[]): AmlDashboardChartPoint[] {
    return Array.isArray(rows)
      ? rows.map((row) => ({
          label: String(row.label || 'UNKNOWN'),
          value: Number(row.value || 0),
          ruleCode: row.ruleCode ? String(row.ruleCode) : undefined
        }))
      : [];
  }
}
