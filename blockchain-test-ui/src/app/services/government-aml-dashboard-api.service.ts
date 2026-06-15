import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AmlDashboardApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

export interface AmlDashboardSummary {
  totalAmlAlerts: number;
  openAlerts: number;
  highRiskAlerts: number;
  closedAlerts: number;
  alertsToday: number;
}

export interface AmlDashboardChartPoint {
  label: string;
  value: number;
  ruleCode?: string;
}

export interface AmlDashboardCharts {
  alertsByRiskLevel: AmlDashboardChartPoint[];
  alertsByStatus: AmlDashboardChartPoint[];
  alertsByDate: AmlDashboardChartPoint[];
  topAmlRulesTriggered: AmlDashboardChartPoint[];
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentAmlDashboardApiService {
  private readonly baseUrl = 'http://172.31.13.90:3001/api/v1/government-blockchain/aml-dashboard';

  constructor(private readonly http: HttpClient) {}

  getSummary(): Observable<AmlDashboardApiResponse<AmlDashboardSummary>> {
    return this.http.get<AmlDashboardApiResponse<AmlDashboardSummary>>(
      `${this.baseUrl}/summary`
    );
  }

  getCharts(): Observable<AmlDashboardApiResponse<AmlDashboardCharts>> {
    return this.http.get<AmlDashboardApiResponse<AmlDashboardCharts>>(
      `${this.baseUrl}/charts`
    );
  }
}
