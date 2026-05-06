import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

export interface WalletDashboardRow {
  id: string;
  walletId: string;
  walletAddress: string;
  customerId: string;
  organizationId: string;
  organizationCode: string | null;
  walletType: string;
  fullName: string;
  customerName: string;
  customerType: string;
  nationality: string;
  idType: string;
  idNumber: string | null;
  nationalIdHash: string | null;
  mobileHash: string | null;
  emailHash: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletDashboardResponse {
  success: boolean;
  message: string;
  data: WalletDashboardRow[];
  pagination: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
  filters?: {
    search?: string | null;
  };
  source?: string;
  requestId?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardApiService {
  private http = inject(HttpClient);
  private config = inject(ApiConfigService);

  getWallets(page = 1, limit = 13, search = ''): Observable<WalletDashboardResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<WalletDashboardResponse>(`${this.config.baseUrl}/wallets`, { params });
  }
}
