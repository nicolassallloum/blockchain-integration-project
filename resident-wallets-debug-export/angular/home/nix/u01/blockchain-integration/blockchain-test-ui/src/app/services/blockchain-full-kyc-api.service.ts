 
import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpParams,
  HttpResponse
} from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

import {
  CitizenKycProfile,
  CitizenKycDocument,
  CitizenDuplicateCheck,
  CitizenRiskScreening,
  CitizenKycBlockchainRecord,
  DashboardSummary,
  DashboardStatusDistribution,
  GeneratedReport,
  ReferenceDataItem
} from '../models/blockchain-full-kyc.models';

type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

@Injectable({
  providedIn: 'root'
})
export class BlockchainFullKycApiService {
  private readonly apiBaseUrl = this.resolveApiBaseUrl();

  private readonly stateKycBaseUrl = `${this.apiBaseUrl}/state-kyc`;
  private readonly dashboardBaseUrl = `${this.apiBaseUrl}/state-kyc-dashboard`;
  private readonly reportsBaseUrl = `${this.apiBaseUrl}/state-kyc-reports`;

  constructor(private readonly http: HttpClient) {}

  // =====================================================
  // Dashboard APIs
  // =====================================================

  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(
      `${this.dashboardBaseUrl}/summary`,
      this.httpOptions()
    );
  }

  getStatusDistribution(): Observable<DashboardStatusDistribution[]> {
    return this.http.get<DashboardStatusDistribution[]>(
      `${this.dashboardBaseUrl}/status-distribution`,
      this.httpOptions()
    );
  }

  getInstitutionSummary(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.dashboardBaseUrl}/institution-summary`,
      this.httpOptions()
    );
  }

  getRiskDistribution(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.dashboardBaseUrl}/risk-distribution`,
      this.httpOptions()
    );
  }

  // =====================================================
  // Citizen KYC APIs
  // =====================================================

  createCitizenKyc(
    payload: Partial<CitizenKycProfile>
  ): Observable<CitizenKycProfile> {
    return this.http.post<CitizenKycProfile>(
      `${this.stateKycBaseUrl}/citizens`,
      payload,
      this.httpOptions()
    );
  }

  updateCitizenKyc(
    kycId: string,
    payload: Partial<CitizenKycProfile>
  ): Observable<CitizenKycProfile> {
    return this.http.put<CitizenKycProfile>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}`,
      payload,
      this.httpOptions()
    );
  }

  submitCitizenKyc(
    kycId: string,
    payload: Record<string, any> = {}
  ): Observable<CitizenKycProfile> {
    return this.http.post<CitizenKycProfile>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/submit`,
      payload,
      this.httpOptions()
    );
  }

  getCitizenKycDetails(kycId: string): Observable<CitizenKycProfile> {
    return this.http.get<CitizenKycProfile>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}`,
      this.httpOptions()
    );
  }

  searchCitizenKyc(
    params: QueryParams = {}
  ): Observable<CitizenKycProfile[]> {
    return this.http.get<CitizenKycProfile[]>(
      `${this.stateKycBaseUrl}/citizens`,
      {
        headers: this.buildHeaders(),
        params: this.buildHttpParams(params)
      }
    );
  }

  approveCitizenKyc(
    kycId: string,
    payload: Record<string, any>
  ): Observable<CitizenKycProfile> {
    return this.http.post<CitizenKycProfile>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/approve`,
      payload,
      this.httpOptions()
    );
  }

  rejectCitizenKyc(
    kycId: string,
    payload: Record<string, any>
  ): Observable<CitizenKycProfile> {
    return this.http.post<CitizenKycProfile>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/reject`,
      payload,
      this.httpOptions()
    );
  }

  requestCitizenKycUpdate(
    kycId: string,
    payload: Record<string, any>
  ): Observable<CitizenKycProfile> {
    return this.http.post<CitizenKycProfile>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/request-update`,
      payload,
      this.httpOptions()
    );
  }

  // =====================================================
  // Document APIs
  // =====================================================

  uploadDocument(
    kycId: string,
    formData: FormData
  ): Observable<CitizenKycDocument> {
    return this.http.post<CitizenKycDocument>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/documents`,
      formData,
      {
        headers: this.buildHeaders(false)
      }
    );
  }

  listDocuments(kycId: string): Observable<CitizenKycDocument[]> {
    return this.http.get<CitizenKycDocument[]>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/documents`,
      this.httpOptions()
    );
  }

  verifyDocument(
    documentId: string,
    payload: Record<string, any>
  ): Observable<CitizenKycDocument> {
    return this.http.post<CitizenKycDocument>(
      `${this.stateKycBaseUrl}/documents/${encodeURIComponent(documentId)}/verify`,
      payload,
      this.httpOptions()
    );
  }

  rejectDocument(
    documentId: string,
    payload: Record<string, any>
  ): Observable<CitizenKycDocument> {
    return this.http.post<CitizenKycDocument>(
      `${this.stateKycBaseUrl}/documents/${encodeURIComponent(documentId)}/reject`,
      payload,
      this.httpOptions()
    );
  }

  // =====================================================
  // Duplicate / Risk APIs
  // =====================================================

  runDuplicateCheck(kycId: string): Observable<CitizenDuplicateCheck> {
    return this.http.post<CitizenDuplicateCheck>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/duplicate-check/run`,
      {},
      this.httpOptions()
    );
  }

  getDuplicateResult(kycId: string): Observable<CitizenDuplicateCheck> {
    return this.http.get<CitizenDuplicateCheck>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/duplicate-check`,
      this.httpOptions()
    );
  }

  runRiskScreening(kycId: string): Observable<CitizenRiskScreening> {
    return this.http.post<CitizenRiskScreening>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/risk-screening/run`,
      {},
      this.httpOptions()
    );
  }

  getRiskResult(kycId: string): Observable<CitizenRiskScreening> {
    return this.http.get<CitizenRiskScreening>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/risk-screening`,
      this.httpOptions()
    );
  }

  // =====================================================
  // Blockchain APIs
  // =====================================================

  getBlockchainProof(kycId: string): Observable<CitizenKycBlockchainRecord> {
    return this.http.get<CitizenKycBlockchainRecord>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/blockchain-proof`,
      this.httpOptions()
    );
  }

  verifyHash(kycId: string): Observable<any> {
    return this.http.post<any>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/verify-hash`,
      {},
      this.httpOptions()
    );
  }

  reconcileKyc(kycId: string): Observable<any> {
    return this.http.post<any>(
      `${this.stateKycBaseUrl}/citizens/${encodeURIComponent(kycId)}/reconcile`,
      {},
      this.httpOptions()
    );
  }

  // =====================================================
  // Report APIs
  // =====================================================

  generateReport(params: QueryParams): Observable<GeneratedReport> {
    return this.http.post<GeneratedReport>(
      `${this.reportsBaseUrl}/generate`,
      params,
      this.httpOptions()
    );
  }

  exportReport(
    reportId: string,
    format: 'PDF' | 'EXCEL' | 'CSV' | string
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(
      `${this.reportsBaseUrl}/${encodeURIComponent(reportId)}/export/${encodeURIComponent(format)}`,
      {
        headers: this.buildHeaders(),
        observe: 'response',
        responseType: 'blob'
      }
    );
  }

  // =====================================================
  // Settings / Reference Data APIs
  // =====================================================

  getReferenceData(type: string): Observable<ReferenceDataItem[]> {
    return this.http.get<ReferenceDataItem[]>(
      `${this.stateKycBaseUrl}/reference-data/${encodeURIComponent(type)}`,
      this.httpOptions()
    );
  }

  createReferenceData(
    type: string,
    payload: Partial<ReferenceDataItem>
  ): Observable<ReferenceDataItem> {
    return this.http.post<ReferenceDataItem>(
      `${this.stateKycBaseUrl}/reference-data/${encodeURIComponent(type)}`,
      payload,
      this.httpOptions()
    );
  }

  updateReferenceData(
    type: string,
    id: string,
    payload: Partial<ReferenceDataItem>
  ): Observable<ReferenceDataItem> {
    return this.http.put<ReferenceDataItem>(
      `${this.stateKycBaseUrl}/reference-data/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
      payload,
      this.httpOptions()
    );
  }

  // =====================================================
  // Private Helpers
  // =====================================================

  private resolveApiBaseUrl(): string {
    const env = environment as any;

    return (
      env.apiBaseUrl ||
      env.apiUrl ||
      env.baseApiUrl ||
      '/api/v1'
    ).replace(/\/$/, '');
  }

  private httpOptions(includeJsonContentType = true): {
    headers: HttpHeaders;
  } {
    return {
      headers: this.buildHeaders(includeJsonContentType)
    };
  }

  private buildHeaders(includeJsonContentType = true): HttpHeaders {
    let headers = new HttpHeaders()
      .set('x-request-source', 'BLOCKCHAIN_FULL_KYC_UI')
      .set('x-source-system', 'BLOCKCHAIN_FULL_KYC_UI')
      .set('x-request-id', this.generateRequestId());

    if (includeJsonContentType) {
      headers = headers.set('Content-Type', 'application/json');
    }

    return headers;
  }

  private buildHttpParams(params: QueryParams): HttpParams {
    let httpParams = new HttpParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return httpParams;
  }

  private generateRequestId(): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, '');

    const random = Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase();

    return `BFKYC-${timestamp}-${random}`;
  }
}