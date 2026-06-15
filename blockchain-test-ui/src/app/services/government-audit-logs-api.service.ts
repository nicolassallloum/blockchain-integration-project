import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface GovernmentAuditLogsApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: GovernmentAuditLogsPagination;
  filters?: GovernmentAuditLogsFilters;
  timestamp?: string;
  error?: string;
}

export interface GovernmentAuditLogsSummary {
  totalLogs: number;
  userActions: number;
  apiEvents: number;
  securityAlerts: number;
}

export interface GovernmentAuditLog {
  logId: string;
  userName: string;
  action: string;
  moduleName: string;
  ipAddress: string;
  severity: string;
  eventDate: string;

  auditLogId?: string | null;
  auditId?: string | null;
  correlationId?: string | null;
  requestId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionCategory?: string | null;
  actorType?: string | null;
  sourceSystem?: string | null;
  eventType?: string | null;
  eventStatus?: string | null;
  actionStatus?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestSource?: string | null;
  eventCategory?: string | null;
  eventDescription?: string | null;
  createdAt?: string | null;
}

export interface GovernmentAuditLogsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GovernmentAuditLogsFilters {
  search?: string;
  logType?: string;
  severity?: string;
  page?: number;
  limit?: number;
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentAuditLogsApiService {
  private readonly apiUrl = 'http://172.31.13.90:3001/api/v1/government-blockchain/audit-logs';

  constructor(private readonly http: HttpClient) {}

  getSummary(): Observable<GovernmentAuditLogsApiResponse<GovernmentAuditLogsSummary>> {
    return this.http.get<GovernmentAuditLogsApiResponse<GovernmentAuditLogsSummary>>(
      `${this.apiUrl}/summary`
    );
  }

  getLogs(filters: GovernmentAuditLogsFilters = {}): Observable<GovernmentAuditLogsApiResponse<GovernmentAuditLog[]>> {
    let params = new HttpParams();

    const setParam = (key: keyof GovernmentAuditLogsFilters, value: unknown) => {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== '' &&
        String(value).trim().toUpperCase() !== 'ALL'
      ) {
        params = params.set(String(key), String(value).trim());
      }
    };

    setParam('search', filters.search);
    setParam('logType', filters.logType);
    setParam('severity', filters.severity);

    params = params.set('page', String(filters.page ?? 1));
    params = params.set('limit', String(filters.limit ?? 25));

    return this.http.get<GovernmentAuditLogsApiResponse<GovernmentAuditLog[]>>(
      this.apiUrl,
      { params }
    );
  }
}
