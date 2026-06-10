import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface AmlAlertsQueueSummary {
  totalOpen: number;
  openAlerts: number;
  pendingReview: number;
  highRisk: number;
}

export interface AmlAlertDetails {
  walletAddress?: string;
  customerId?: string;
  counterpartyWalletAddress?: string;
  counterpartyCustomerId?: string;
  requestId?: string;
  riskAction?: string;
  severity?: string;
  transactionAmount?: number;
  currencyCode?: string;
  transactionType?: string;
  organizationCode?: string;
  organizationName?: string;
  alertDetails?: unknown;
}

export interface AmlAlertQueueItem {
  alertId: string;
  residentName: string;
  transactionId: string;
  riskLevel: string;
  riskScore: number;
  ruleName: string;
  ruleCode: string;
  status: string;
  rawStatus?: string;
  reason?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  createdDate: string;
  details?: AmlAlertDetails;
}

export interface AmlAlertsQueueResponse {
  success: boolean;
  message: string;
  summary: AmlAlertsQueueSummary;
  data: AmlAlertQueueItem[];
  timestamp: string;
}

export interface AmlAlertActionResponse {
  success: boolean;
  message: string;
  data?: {
    alert_id: string;
    alert_status: string;
    reviewed_by: string;
    reviewed_at: string;
    review_notes: string;
  };
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentAmlAlertsQueueApiService {
  private readonly baseUrl = '/api/v1/government-blockchain/aml-alerts-queue';

  constructor(private readonly http: HttpClient) {}

  getAlertsQueue(): Observable<AmlAlertsQueueResponse> {
    return this.http.get<AmlAlertsQueueResponse>(this.baseUrl);
  }

  markAsReviewed(alertId: string, notes: string, officer = 'Compliance Officer'): Observable<AmlAlertActionResponse> {
    return this.http.post<AmlAlertActionResponse>(
      `${this.baseUrl}/${encodeURIComponent(alertId)}/review`,
      {
        officer,
        notes
      }
    );
  }

  closeAlert(alertId: string, notes: string, officer = 'Compliance Officer'): Observable<AmlAlertActionResponse> {
    return this.http.post<AmlAlertActionResponse>(
      `${this.baseUrl}/${encodeURIComponent(alertId)}/close`,
      {
        officer,
        notes
      }
    );
  }
}
