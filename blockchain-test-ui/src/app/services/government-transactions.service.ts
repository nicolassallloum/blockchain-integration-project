import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GovernmentTransaction {
  transaction_id: number;
  transaction_reference: string;

  resident_id?: string;
  resident_db_id?: number;
  resident_wallet_address?: string;
  resident_full_name?: string;
  resident_name?: string;
  resident_national_id?: string;
  resident_mobile?: string;
  resident_email?: string;

  service_id?: number;
  service_public_id?: string;
  service_code?: string;
  service_name?: string;
  service_arabic_name?: string;
  service_category?: string;
  category_id?: string;

  ministry_id?: string;
  ministry_name?: string;
  administration_id?: string;

  amount?: number;
  total_fee?: number;
  currency_code?: string;
  currency?: string;

  payment_method?: string;
  transaction_type?: string;
  transaction_status?: string;

  notes?: string;
  document_hash?: string;
  digital_stamp_required?: boolean;
  uploaded_documents_count?: number;

  created_by_account_type?: string;
  created_by_login_username?: string;
  created_by_wallet_address?: string;

  blockchain_tx_id?: string;
  blockchain_status?: string;
  blockchain_error?: string;
  blockchain_submitted_at?: string;

  created_at?: string;
  updated_at?: string;
}

export interface GovernmentTransactionStats {
  totalTransactions: number;
  approved: number;
  pending: number;
  failed: number;
}

export interface GovernmentTransactionResponse {
  success: boolean;
  message: string;
  data: GovernmentTransaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  stats: GovernmentTransactionStats;
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentTransactionsService {
  private readonly apiUrl =
    'http://172.31.13.90:3001/api/v1/government-blockchain/transactions';

  constructor(private http: HttpClient) {}

  getTransactions(filters?: {
    search?: string;
    status?: string;
    blockchainStatus?: string;
    limit?: number;
    offset?: number;
  }): Observable<GovernmentTransactionResponse> {
    let params = new HttpParams();

    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    if (filters?.status && filters.status !== 'ALL') {
      params = params.set('status', filters.status);
    }

    if (filters?.blockchainStatus && filters.blockchainStatus !== 'ALL') {
      params = params.set('blockchainStatus', filters.blockchainStatus);
    }

    params = params.set('limit', String(filters?.limit ?? 50));
    params = params.set('offset', String(filters?.offset ?? 0));

    return this.http.get<GovernmentTransactionResponse>(this.apiUrl, { params });
  }
}
