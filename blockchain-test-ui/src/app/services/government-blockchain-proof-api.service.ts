import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BlockchainProofFilters {
  entityType?: string | null;
  entityId?: string | null;
  blockchainStatus?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  offset?: number;
}

export interface BlockchainProofRecord {
  proofId: string;
  proofType: string;
  entityType: string;
  entityId: string;
  blockchainTransactionHash: string | null;
  blockchainStatus: string;
  submittedDate: string | null;
  createdBy: string | null;
  couchDbDocumentId: string | null;
  sourceTable: string;
}

export interface BlockchainProofResponse {
  success: boolean;
  message: string;
  data: BlockchainProofRecord[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    filters: {
      entityType: string | null;
      entityId: string | null;
      blockchainStatus: string | null;
      dateFrom: string | null;
      dateTo: string | null;
    };
  };
  timestamp: string;
}

export interface BlockchainOwnershipArea {
  area?: string;
  owner: string;
  primaryOwnership?: boolean;
  responsibility?: string[];
  storedData?: string[];
  prohibitedFromFabric?: string[];
  doesNotOwn?: string[];
  approvalStatuses?: string[];
  verificationStatuses?: string[];
  retryRules?: string[];
  flow?: string[];
  systemOfRecord?: boolean;
  storesSensitiveData?: boolean;
  sensitiveDataAllowedOnFabric?: boolean;
  [key: string]: unknown;
}

export interface BlockchainOwnershipModel {
  project: {
    name: string;
    phase: string;
    architectureRule: string;
  };
  phase2Rules: string[];
  requiredAreas: string[];
  ownershipModel: {
    [key: string]: BlockchainOwnershipArea;
  };
}

export interface BlockchainOwnershipValidation {
  valid: boolean;
  requiredAreas: string[];
  missingAreas: string[];
  invalidRules: string[];
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentBlockchainProofApiService {
  private readonly baseUrl =
    'http://172.31.13.90:3001/api/v1/government-blockchain/blockchain-proofs';

  private readonly ownershipBaseUrl =
    'http://172.31.13.90:3001/api/v1/blockchain-proof/ownership';

  constructor(private readonly http: HttpClient) {}

  getProofs(filters: BlockchainProofFilters = {}): Observable<BlockchainProofResponse> {
    let params = new HttpParams();

    if (filters.entityType) {
      params = params.set('entityType', filters.entityType);
    }

    if (filters.entityId) {
      params = params.set('entityId', filters.entityId);
    }

    if (filters.blockchainStatus) {
      params = params.set('blockchainStatus', filters.blockchainStatus);
    }

    if (filters.dateFrom) {
      params = params.set('dateFrom', filters.dateFrom);
    }

    if (filters.dateTo) {
      params = params.set('dateTo', filters.dateTo);
    }

    params = params.set('limit', String(filters.limit || 100));
    params = params.set('offset', String(filters.offset || 0));

    return this.http.get<BlockchainProofResponse>(this.baseUrl, { params });
  }

  getOwnershipModel(): Observable<ApiResponse<BlockchainOwnershipModel>> {
    return this.http.get<ApiResponse<BlockchainOwnershipModel>>(this.ownershipBaseUrl);
  }

  validateOwnershipModel(): Observable<ApiResponse<BlockchainOwnershipValidation>> {
    return this.http.get<ApiResponse<BlockchainOwnershipValidation>>(
      `${this.ownershipBaseUrl}/validate`
    );
  }

  getOwnershipArea(areaName: string): Observable<ApiResponse<BlockchainOwnershipArea>> {
    return this.http.get<ApiResponse<BlockchainOwnershipArea>>(
      `${this.ownershipBaseUrl}/${encodeURIComponent(areaName)}`
    );
  }
}
