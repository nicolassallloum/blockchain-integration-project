import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AmlCaseSummary {
  totalCases: number;
  openCases: number;
  escalatedCases: number;
  closedCases: number;
}

export interface AmlCaseItem {
  caseId: string;
  caseNumber: string;
  alertId: string | null;
  residentId: string | null;
  walletAddress: string | null;
  transactionId: string | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  assignedTo: string | null;
  assignedTeam: string | null;
  openedBy: string | null;
  openedAt: string | null;
  reviewedAt: string | null;
  escalatedAt: string | null;
  closedAt: string | null;
  closureReason: string | null;
  riskScore: string | number | null;
  riskLevel: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  alert?: {
    status?: string | null;
    ruleCode?: string | null;
    severity?: string | null;
    reason?: string | null;
    customerId?: string | null;
    amount?: string | number | null;
    currency?: string | null;
    type?: string | null;
    riskAction?: string | null;
  };
  resident?: {
    fullName?: string | null;
    nationalIdNumber?: string | null;
    mobileNumber?: string | null;
    email?: string | null;
  };
  wallet?: {
    address?: string | null;
    balance?: string | number | null;
    status?: string | null;
    currency?: string | null;
  };
}

export interface AmlCaseAction {
  action_id?: string;
  actionId?: string;
  case_id?: string;
  caseId?: string;
  action_type?: string;
  actionType?: string;
  old_status?: string | null;
  oldStatus?: string | null;
  new_status?: string | null;
  newStatus?: string | null;
  action_by?: string | null;
  actionBy?: string | null;
  action_note?: string | null;
  actionNote?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
}

export interface AmlCaseDetail extends AmlCaseItem {
  investigationNotes?: string | null;
  blockchainProofId?: string | null;
  transaction?: any;
  actions?: AmlCaseAction[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  timestamp?: string;
}

export interface AmlCaseFilters {
  status?: string;
  priority?: string;
  assignedTo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AmlCaseManagementApiService {
  private readonly baseUrl = 'http://172.31.13.90:3001/api/v1/government-blockchain/aml-cases';

  constructor(private http: HttpClient) {}

  getSummary(): Observable<ApiResponse<AmlCaseSummary>> {
    return this.http.get<ApiResponse<AmlCaseSummary>>(`${this.baseUrl}/summary`);
  }

  getCases(filters: AmlCaseFilters = {}): Observable<ApiResponse<AmlCaseItem[]>> {
    let params = new HttpParams();

    if (filters.status) {
      params = params.set('status', filters.status);
    }

    if (filters.priority) {
      params = params.set('priority', filters.priority);
    }

    if (filters.assignedTo) {
      params = params.set('assignedTo', filters.assignedTo);
    }

    return this.http.get<ApiResponse<AmlCaseItem[]>>(this.baseUrl, { params });
  }

  getCase(caseId: string): Observable<ApiResponse<AmlCaseDetail>> {
    return this.http.get<ApiResponse<AmlCaseDetail>>(`${this.baseUrl}/${caseId}`);
  }

  createCase(payload: {
    alertId: string;
    assignedTo?: string;
    assignedTeam?: string;
    priority?: string;
    description?: string;
    openedBy?: string;
  }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(this.baseUrl, payload);
  }

  assignCase(caseId: string, payload: {
    assignedTo?: string;
    assignedTeam?: string;
    actionBy?: string;
    note?: string;
  }): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${this.baseUrl}/${caseId}/assign`, payload);
  }

  updateStatus(caseId: string, payload: {
    status: 'Open' | 'In Review' | 'Escalated' | 'Closed';
    actionBy?: string;
    note?: string;
  }): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${this.baseUrl}/${caseId}/status`, payload);
  }

  closeCase(caseId: string, payload: {
    closureReason: string;
    actionBy?: string;
    note?: string;
  }): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${this.baseUrl}/${caseId}/close`, payload);
  }
}
