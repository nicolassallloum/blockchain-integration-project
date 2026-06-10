import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface RiskFraudSummary {
  totalAlerts: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  resolvedAlerts: number;
}

export interface RiskFraudFilters {
  riskLevel?: string;
  status?: string;
  residentName?: string;
  transactionId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface RiskFraudAlert {
  alertId: string;
  residentName: string;
  transactionId: string;
  riskScore: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  reason: string;
  status: string;
  createdDate: string;
  sourceType?: string;
  details?: any;
}

export interface RiskFraudScreeningResponse {
  success: boolean;
  message: string;
  summary: RiskFraudSummary;
  data: RiskFraudAlert[];
  filters?: RiskFraudFilters;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentRiskFraudScreeningApiService {
  private readonly apiUrl = '/api/v1/government-blockchain/risk-fraud-screening';

  constructor(private readonly http: HttpClient) {}

  getRiskFraudScreening(filters: RiskFraudFilters = {}): Observable<RiskFraudScreeningResponse> {
    let params = new HttpParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value).trim());
      }
    });

    return this.http.get<RiskFraudScreeningResponse>(this.apiUrl, { params });
  }
}
