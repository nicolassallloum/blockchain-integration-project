// src/app/blockchain/audit-validation/audit-validation.service.ts

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface AuditEvent {
  id: number;
  event_id: string;
  source_system: string;
  source_database: string;
  source_schema: string;
  source_object: string;
  source_table: string;
  source_view?: string | null;
  record_pk: string;
  action_type: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: any;
  new_data?: any;
  changed_by: string;
  changed_at: string;
  application_user?: string | null;
  request_id?: string | null;
  correlation_id?: string | null;
  hash_value: string;
  recalculated_hash?: string | null;
  hash_status: 'PENDING' | 'VALID' | 'INVALID';
  validation_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  blockchain_status: 'NOT_SUBMITTED' | 'SUBMITTED' | 'FAILED';
  blockchain_tx_id?: string | null;
  ledger_key?: string | null;
  couchdb_doc_id?: string | null;
  submitted_at?: string | null;
  submit_error?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  reject_reason?: string | null;
}

export interface AuditEventFilters {
  record_pk?: string;
  record_pk_field?: string;
  page_size?: number;
  limit?: number;
  source_object?: string;
  source_table?: string;
  action_type?: string;
  hash_status?: string;
  validation_status?: string;
  blockchain_status?: string;
  date_from?: string;
  date_to?: string;
  offset?: number;
}

export interface AuditEventsResponse {
  total: number;
  limit: number;
  offset: number;
  events: AuditEvent[];
}



export interface AuditDashboardPoint {
  day?: string;
  status?: string;
  action_type?: string;
  source_object?: string;
  object_label?: string;
  count?: number;
  total_count?: number;
}

export interface AuditDashboardResponse {
  daily: {
    INSERT: AuditDashboardPoint[];
    UPDATE: AuditDashboardPoint[];
    DELETE: AuditDashboardPoint[];
  };
  totals: {
    INSERT: number;
    UPDATE: number;
    DELETE: number;
  };
  hashStatus: AuditDashboardPoint[];
  validationStatus: AuditDashboardPoint[];
  blockchainStatus: AuditDashboardPoint[];
  actionCounts: AuditDashboardPoint[];
  objectCounts: AuditDashboardPoint[];
}

@Injectable({ providedIn: 'root' })
export class AuditValidationService {
  private readonly baseUrl = '/api/v1/audit-validation';

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<AuditDashboardResponse> {
    return this.http.get<AuditDashboardResponse>(`${this.baseUrl}/dashboard`);
  }

  getEvents(filters: AuditEventFilters = {}): Observable<AuditEventsResponse> {
    const normalizedFilters: AuditEventFilters = {
      ...filters,
      limit: filters.page_size || filters.limit || 50
    };

    let params = new HttpParams();

    Object.entries(normalizedFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<AuditEventsResponse>(`${this.baseUrl}/events`, { params });
  }

  getEvent(eventId: string): Observable<AuditEvent> {
    return this.http.get<AuditEvent>(`${this.baseUrl}/events/${eventId}`);
  }

  validate(eventId: string): Observable<{ message: string; event: AuditEvent }> {
    return this.http.post<{ message: string; event: AuditEvent }>(
      `${this.baseUrl}/events/${eventId}/hash-verify`,
      {}
    );
  }

  approve(eventId: string): Observable<{ message: string; event: AuditEvent }> {
    return this.http.post<{ message: string; event: AuditEvent }>(
      `${this.baseUrl}/events/${eventId}/approve`,
      {}
    );
  }

  reject(eventId: string, reason?: string): Observable<{ message: string; event: AuditEvent }> {
    return this.http.post<{ message: string; event: AuditEvent }>(
      `${this.baseUrl}/events/${eventId}/reject`,
      { reason }
    );
  }

  submitBlockchain(eventId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/events/${eventId}/submit-blockchain`, {});
  }
}
