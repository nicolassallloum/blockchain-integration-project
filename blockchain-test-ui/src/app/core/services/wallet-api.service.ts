import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface WalletListFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customerId?: string;
  walletAddress?: string;
  organizationId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WalletApiService {
  private readonly apiBaseUrl = environment.apiBaseUrl;
  private readonly walletsUrl = `${environment.apiBaseUrl}/wallets`;

  constructor(private http: HttpClient) {}

  /**
   * Dashboard / wallet list
   */
  getWallets(filters: WalletListFilters = {}): Observable<any> {
    let params = new HttpParams();

    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<any>(this.walletsUrl, { params });
  }

  getAllWallets(filters: WalletListFilters = {}): Observable<any> {
    return this.getWallets(filters);
  }

  /**
   * Wallet creation
   */
  createWallet(payload: any): Observable<any> {
    return this.http.post<any>(this.walletsUrl, payload);
  }

  /**
   * Wallet login
   */
  loginWallet(payload: any): Observable<any> {
    return this.http.post<any>(`${this.walletsUrl}/login`, payload);
  }

  /**
   * Wallet query
   */
  getWalletByCustomerId(customerId: string): Observable<any> {
    return this.http.get<any>(
      `${this.walletsUrl}/customer/${encodeURIComponent(customerId)}`
    );
  }

  getWalletByAddress(walletAddress: string): Observable<any> {
    return this.http.get<any>(
      `${this.walletsUrl}/address/${encodeURIComponent(walletAddress)}`
    );
  }

  /**
   * Reference APIs
   */
  getNextCustomerId(): Observable<any> {
    return this.http.get<any>(`${this.apiBaseUrl}/reference/next-customer-id`);
  }

  getCountries(): Observable<any> {
    return this.http.get<any>(`${this.apiBaseUrl}/reference/countries`);
  }

  getNationalities(): Observable<any> {
    return this.http.get<any>(`${this.apiBaseUrl}/reference/nationalities`);
  }

  getOrganizations(): Observable<any> {
    return this.http.get<any>(`${this.apiBaseUrl}/organizations`);
  }

  /**
   * Transaction APIs
   */
  getTransactions(filters: any = {}): Observable<any> {
    let params = new HttpParams();

    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<any>(`${this.apiBaseUrl}/transactions`, { params });
  }

  walletTransfer(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiBaseUrl}/transactions/wallet-transfer`,
      payload
    );
  }

  organizationTransfer(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiBaseUrl}/transactions/organization-transfer`,
      payload
    );
  }

  /**
   * Dashboard summary helper.
   * If backend does not have a dedicated dashboard endpoint,
   * this method calculates summary from /wallets.
   */
  getDashboardSummary(limit: number = 13): Observable<any> {
    return this.getWallets({ page: 1, limit }).pipe(
      map((response: any) => {
        const wallets = this.extractWalletArray(response);

        const totalWallets =
          response?.pagination?.totalRecords ??
          response?.pagination?.total ??
          response?.totalRecords ??
          wallets.length;

        const activeWallets = wallets.filter((wallet: any) => {
          const status =
            wallet?.status ||
            wallet?.walletStatus ||
            wallet?.wallet_status ||
            '';

          return String(status).toUpperCase() === 'ACTIVE';
        }).length;

        return {
          success: true,
          message: 'Dashboard summary calculated successfully',
          data: {
            totalWallets,
            activeWallets,
            currentPage: response?.pagination?.page || 1,
            limit: response?.pagination?.limit || limit,
            dataSource: response?.source || 'PostgreSQL',
            table: response?.table || 'blockchain.wallets',
            wallets
          },
          pagination: response?.pagination || {
            page: 1,
            limit,
            totalRecords: totalWallets,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
          }
        };
      })
    );
  }

  /**
   * Session helpers
   */
  saveWalletToken(token: string): void {
    if (!token) {
      return;
    }

    localStorage.setItem('wallet_token', token);
  }

  getWalletToken(): string | null {
    return localStorage.getItem('wallet_token');
  }

  clearWalletToken(): void {
    localStorage.removeItem('wallet_token');
  }

  saveWalletProfile(profile: any): void {
    if (!profile) {
      return;
    }

    localStorage.setItem('wallet_profile', JSON.stringify(profile));

    const wallet = profile?.wallet || profile?.data?.wallet || profile;

    const session = {
      customerId: wallet?.customerId || wallet?.customer_id || '',
      walletAddress: wallet?.walletAddress || wallet?.wallet_address || '',
      organizationId: wallet?.organizationId || wallet?.organization_id || '',
      organizationName: wallet?.organizationName || wallet?.organization_name || '',
      fullName:
        wallet?.fullName ||
        wallet?.full_name ||
        wallet?.customerName ||
        wallet?.customer_name ||
        '',
      currentBalance: wallet?.currentBalance ?? wallet?.current_balance ?? 0,
      currencyCode:
        wallet?.currencyCode ||
        wallet?.currency_code ||
        wallet?.currency ||
        'USD',
      token: profile?.token || profile?.data?.token || this.getWalletToken() || ''
    };

    localStorage.setItem('digital_kyc_wallet_session', JSON.stringify(session));
  }

  getWalletProfile(): any | null {
    const raw = localStorage.getItem('wallet_profile');

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem('wallet_profile');
      return null;
    }
  }

  getWalletSession(): any | null {
    const raw = localStorage.getItem('digital_kyc_wallet_session');

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem('digital_kyc_wallet_session');
      return null;
    }
  }

  clearWalletSession(): void {
    localStorage.removeItem('wallet_token');
    localStorage.removeItem('wallet_profile');
    localStorage.removeItem('digital_kyc_wallet_session');
  }

  /**
   * Response normalization helpers
   */
  extractWalletArray(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.data)) {
      return response.data;
    }

    if (Array.isArray(response?.data?.wallets)) {
      return response.data.wallets;
    }

    if (Array.isArray(response?.wallets)) {
      return response.wallets;
    }

    return [];
  }

  extractWallet(response: any): any | null {
    return (
      response?.data?.wallet ||
      response?.data ||
      response?.wallet ||
      null
    );
  }
}