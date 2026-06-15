import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GovernmentReportsApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: string;
  timestamp?: string;
}

export interface GovernmentReportSummary {
  availableReports: number;
  generatedToday: number;
  scheduledReports: number;
  failedReports: number;
}

export interface GovernmentReportTemplate {
  reportTemplateId: string;
  reportCode: string;
  reportName: string;
  reportCategory: string;
  description: string;
  outputFormats: string[];
  isActive: boolean;
  createdAt: string;
}

export interface GovernmentGeneratedReport {
  generatedReportId: string;
  reportNo: string;
  reportCode: string;
  reportName: string;
  generatedBy: string;
  format: string;
  status: string;
  filePath?: string | null;
  filters?: Record<string, unknown>;
  rowCount: number;
  errorMessage?: string | null;
  generatedAt: string;
}

export interface GovernmentReportsDashboard {
  summary: GovernmentReportSummary;
  reportCards: GovernmentReportTemplate[];
  recentReports: GovernmentGeneratedReport[];
}

export interface GovernmentReportChartPoint {
  label: string;
  value: number;
  amount?: string | number;
}

export interface GovernmentReportDetails {
  reportCode: string;
  title: string;
  summary: Record<string, string | number | null>;
  charts: Record<string, GovernmentReportChartPoint[]>;
  rows: Record<string, unknown>[];
}

export interface GenerateGovernmentReportRequest {
  reportCode: string;
  format: string;
  generatedBy?: string;
  filters?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentReportsApiService {
  private readonly baseUrl = 'http://172.31.13.90:3001/api/v1/government-blockchain/reports';

  constructor(private readonly http: HttpClient) {}

  getDashboard(): Observable<GovernmentReportsApiResponse<GovernmentReportsDashboard>> {
    return this.http.get<GovernmentReportsApiResponse<GovernmentReportsDashboard>>(
      this.baseUrl
    );
  }

  getTemplates(): Observable<GovernmentReportsApiResponse<GovernmentReportTemplate[]>> {
    return this.http.get<GovernmentReportsApiResponse<GovernmentReportTemplate[]>>(
      `${this.baseUrl}/templates`
    );
  }

  getRecentReports(limit = 10): Observable<GovernmentReportsApiResponse<GovernmentGeneratedReport[]>> {
    return this.http.get<GovernmentReportsApiResponse<GovernmentGeneratedReport[]>>(
      `${this.baseUrl}/recent?limit=${encodeURIComponent(String(limit))}`
    );
  }

  getReportDetails(reportCode: string): Observable<GovernmentReportsApiResponse<GovernmentReportDetails>> {
    return this.http.get<GovernmentReportsApiResponse<GovernmentReportDetails>>(
      `${this.baseUrl}/${encodeURIComponent(reportCode)}`
    );
  }

  generateReport(
    payload: GenerateGovernmentReportRequest
  ): Observable<GovernmentReportsApiResponse<GovernmentGeneratedReport>> {
    return this.http.post<GovernmentReportsApiResponse<GovernmentGeneratedReport>>(
      `${this.baseUrl}/generate`,
      payload
    );
  }
}
