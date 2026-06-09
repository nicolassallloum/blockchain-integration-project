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

@Injectable({
  providedIn: 'root'
})
export class GovernmentBlockchainProofApiService {
  private readonly baseUrl = '/api/v1/government-blockchain/blockchain-proofs';

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
}
