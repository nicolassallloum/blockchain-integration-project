import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GovernmentTransaction {
  transaction_id: number | string;
  transaction_reference: string;

  resident_id?: string;
  resident_db_id?: number | string;
  resident_wallet_address?: string;
  resident_full_name?: string;
  resident_name?: string;
  resident_national_id?: string;
  resident_mobile?: string;
  resident_email?: string;

  service_id?: number | string;
  service_public_id?: string;
  service_code?: string;
  service_name?: string;
  service_arabic_name?: string;
  service_category?: string;
  category_id?: string;

  ministry_id?: string;
  ministry_name?: string;
  administration_id?: string;
  administration_name?: string;

  amount?: number | string;
  base_fee?: number | string;
  fee_extra_amount?: number | string;
  fee_percentage?: number | string;
  total_fee?: number | string;
  total_fees?: number | string;

  currency_code?: string;
  currency?: string;

  payment_method?: string;
  payment_details?: any;
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

export interface GovernmentTransactionPagination {
  total: number;
  limit: number;
  offset: number;
}

export interface GovernmentTransactionResponse {
  success: boolean;
  message: string;
  data: GovernmentTransaction[];
  pagination: GovernmentTransactionPagination;
  stats: GovernmentTransactionStats;
  filters?: any;
}

export interface GovernmentTransactionFilters {
  search?: string;
  transactionId?: string;
  residentName?: string;
  service?: string;
  paymentMethod?: string;
  status?: string;
  blockchainStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentTransactionsService {
  private readonly apiUrl =
    'http://172.31.13.90:3001/api/v1/government-blockchain/transactions';

  constructor(private http: HttpClient) {}

  getTransactions(filters?: GovernmentTransactionFilters): Observable<GovernmentTransactionResponse> {
    let params = new HttpParams();

    const setParam = (key: keyof GovernmentTransactionFilters, value: any) => {
      if (value !== undefined && value !== null && String(value).trim() !== '' && value !== 'ALL') {
        params = params.set(String(key), String(value).trim());
      }
    };

    setParam('search', filters?.search);
    setParam('transactionId', filters?.transactionId);
    setParam('residentName', filters?.residentName);
    setParam('service', filters?.service);
    setParam('paymentMethod', filters?.paymentMethod);
    setParam('status', filters?.status);
    setParam('blockchainStatus', filters?.blockchainStatus);
    setParam('dateFrom', filters?.dateFrom);
    setParam('dateTo', filters?.dateTo);

    params = params.set('limit', String(filters?.limit ?? 50));
    params = params.set('offset', String(filters?.offset ?? 0));

    return this.http.get<GovernmentTransactionResponse>(this.apiUrl, { params });
  }
}
