import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams
} from '@angular/common/http';
import { Observable } from 'rxjs';


export interface KycVersionRecord {
  docType?: string;
  versionSchema?: string;
  residentId: string;
  customerId: string;
  sessionId?: string;
  ledgerKey?: string;
  latestVersionKey?: string;
  versionKey?: string;
  versionNumber: number | null;
  versionOperation?: string | null;
  previousVersionNumber?: number | null;
  previousVersionKey?: string | null;
  previousTransactionId?: string | null;
  versionPayloadHash?: string;
  versionChangedFields?: string[];
  versionChangeCount?: number;
  changeReason?: string | null;
  deletionReason?: string | null;
  isDeleted?: boolean;
  createdByMsp?: string;
  fabricTransactionId?: string;
  createdAt?: string;
  payload?: {
    customerId?: string;
    customer_id?: string;
    residentId?: string;
    sessionId?: string;
    session_id?: string;
    changeReason?: string;
    formData?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface KycVersionComparisonChange {
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface KycVersionComparison {
  source?: string;
  residentId: string;
  oldVersionNumber: number;
  newVersionNumber: number;
  oldVersionHash?: string;
  newVersionHash?: string;
  changeCount: number;
  changes: KycVersionComparisonChange[];
}

export interface KycBlockchainMetadata {
  channelName?: string | null;
  chaincodeName?: string | null;
  functionName?: string | null;
}

export interface KycCustomerMetadata {
  customerId: string;
  residentId: string;
  ledgerKey: string;
}

export interface KycVersionResponse {
  success: boolean;
  message?: string;
  source?: string;
  data: KycVersionRecord;
  customer?: KycCustomerMetadata;
  blockchain?: KycBlockchainMetadata;
}

export interface KycVersionsResponse {
  success: boolean;
  message?: string;
  source?: string;
  data: {
    customerId: string;
    residentId: string;
    ledgerKey: string;
    versions: KycVersionRecord[];
  };
  pagination?: {
    totalVersions?: number;
    returnedVersions?: number;
    fetchedRecordsCount?: number;
    bookmark?: string | null;
    hasMore?: boolean;
  };
  blockchain?: KycBlockchainMetadata;
}

export interface KycVersionComparisonResponse {
  success: boolean;
  message?: string;
  source?: string;
  data: KycVersionComparison;
  customer?: KycCustomerMetadata;
  blockchain?: KycBlockchainMetadata;
}

@Injectable({
  providedIn: 'root'
})
export class KycVersionAuditApiService {
  private readonly customersUrl =
    '/api/v1/valoores-blockchain/customers';

  constructor(
    private readonly http: HttpClient
  ) {}

  getVersions(
    customerId: string
  ): Observable<KycVersionsResponse> {
    return this.http.get<KycVersionsResponse>(
      `${this.customersUrl}/${this.encodeCustomerId(customerId)}/versions`
    );
  }

  getLatestVersion(
    customerId: string
  ): Observable<KycVersionResponse> {
    return this.http.get<KycVersionResponse>(
      `${this.customersUrl}/${this.encodeCustomerId(customerId)}/versions/latest`
    );
  }

  getVersion(
    customerId: string,
    versionNumber: number
  ): Observable<KycVersionResponse> {
    return this.http.get<KycVersionResponse>(
      `${this.customersUrl}/${this.encodeCustomerId(customerId)}` +
      `/versions/${encodeURIComponent(String(versionNumber))}`
    );
  }

  compareVersions(
    customerId: string,
    oldVersion: number,
    newVersion: number
  ): Observable<KycVersionComparisonResponse> {
    const params = new HttpParams()
      .set('oldVersion', String(oldVersion))
      .set('newVersion', String(newVersion));

    return this.http.get<KycVersionComparisonResponse>(
      `${this.customersUrl}/${this.encodeCustomerId(customerId)}` +
      '/versions/compare',
      { params }
    );
  }

  private encodeCustomerId(customerId: string): string {
    return encodeURIComponent(
      String(customerId || '')
        .trim()
        .replace(/^KYC_VALOORES-/i, '')
        .replace(/^VALOORES-/i, '')
    );
  }
}
