import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private readonly apiBaseUrl = environment.apiBaseUrl;
  private readonly baseUrl = `${environment.apiBaseUrl}/wallets`;

  private readonly WALLET_TOKEN_KEY = 'wallet_token';
  private readonly WALLET_PROFILE_KEY = 'wallet_profile';
  private readonly WALLET_SESSION_KEY = 'digital_kyc_wallet_session';

  constructor(private http: HttpClient) {}

  /**
   * Wallet creation
   */
  createWallet(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}`, payload);
  }

  /**
   * Wallet login
   */
  loginWallet(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, payload);
  }

  /**
   * Wallet query by customer ID
   */
  getWalletByCustomerId(customerId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/customer/${encodeURIComponent(customerId)}`);
  }

  /**
   * Wallet query by wallet address
   */
  getWalletByAddress(walletAddress: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/address/${encodeURIComponent(walletAddress)}`);
  }

  /**
   * Wallet list / dashboard
   */
  getWallets(paramsData: any = {}): Observable<any> {
    let params = new HttpParams();

    Object.keys(paramsData || {}).forEach((key) => {
      const value = paramsData[key];

      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    });

    return this.http.get(`${this.baseUrl}`, { params });
  }

  /**
   * Compatibility alias if old pages call getAllWallets()
   */
  getAllWallets(paramsData: any = {}): Observable<any> {
    return this.getWallets(paramsData);
  }

  /**
   * Reference APIs
   */
  getNextCustomerId(): Observable<any> {
    return this.http.get(`${this.apiBaseUrl}/reference/next-customer-id`);
  }

  getOrganizations(): Observable<any> {
    return this.http.get(`${this.apiBaseUrl}/organizations`);
  }

  getCountries(): Observable<any> {
    return this.http.get(`${this.apiBaseUrl}/reference/countries`);
  }

  getNationalities(): Observable<any> {
    return this.http.get(`${this.apiBaseUrl}/reference/nationalities`);
  }

  /**
   * Token/session helpers used by wallet-login.ts
   */
  saveWalletToken(token: string): void {
    if (!token) {
      return;
    }

    localStorage.setItem(this.WALLET_TOKEN_KEY, token);
  }

  getWalletToken(): string | null {
    return localStorage.getItem(this.WALLET_TOKEN_KEY);
  }

  clearWalletToken(): void {
    localStorage.removeItem(this.WALLET_TOKEN_KEY);
  }

  saveWalletProfile(profile: any): void {
    if (!profile) {
      return;
    }

    localStorage.setItem(this.WALLET_PROFILE_KEY, JSON.stringify(profile));

    const wallet = profile?.wallet || profile;

    const normalizedSession = {
      customerId: wallet?.customerId || wallet?.customer_id || '',
      walletAddress: wallet?.walletAddress || wallet?.wallet_address || '',
      organizationId: wallet?.organizationId || wallet?.organization_id || '',
      organizationName: wallet?.organizationName || wallet?.organization_name || '',
      fullName: wallet?.fullName || wallet?.full_name || wallet?.customerName || '',
      currentBalance: wallet?.currentBalance ?? wallet?.current_balance ?? 0,
      currencyCode: wallet?.currencyCode || wallet?.currency_code || wallet?.currency || 'USD',
      token: profile?.token || this.getWalletToken() || ''
    };

    localStorage.setItem(this.WALLET_SESSION_KEY, JSON.stringify(normalizedSession));
  }

  getWalletProfile(): any | null {
    const raw = localStorage.getItem(this.WALLET_PROFILE_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(this.WALLET_PROFILE_KEY);
      return null;
    }
  }

  getWalletSession(): any | null {
    const raw = localStorage.getItem(this.WALLET_SESSION_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(this.WALLET_SESSION_KEY);
      return null;
    }
  }

  clearWalletSession(): void {
    localStorage.removeItem(this.WALLET_TOKEN_KEY);
    localStorage.removeItem(this.WALLET_PROFILE_KEY);
    localStorage.removeItem(this.WALLET_SESSION_KEY);
  }
}