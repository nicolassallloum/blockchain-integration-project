import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private readonly apiBaseUrl = '/api/v1';

  constructor(private http: HttpClient) {}

  /**
   * Use JSON headers only for POST APIs.
   * Do NOT use these headers for simple reference GET APIs,
   * because x-request-id triggers browser OPTIONS preflight.
   */
  private buildJsonHeaders(extraHeaders: Record<string, string> = {}): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-request-id': `REQ_UI_${Date.now()}`,
      ...extraHeaders
    });
  }

  /**
   * Create Wallet
   * POST /api/v1/wallets
   */
  createWallet(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiBaseUrl}/wallets`,
      payload,
      {
        headers: this.buildJsonHeaders()
      }
    );
  }

  /**
   * Wallet Login
   * POST /api/v1/wallets/login
   */
  loginWallet(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiBaseUrl}/wallets/login`,
      payload,
      {
        headers: this.buildJsonHeaders()
      }
    );
  }

  /**
   * Query wallet by customer ID
   */
  getWalletByCustomerId(customerId: string, token?: string): Observable<any> {
    const extraHeaders: Record<string, string> = {};

    if (token) {
      extraHeaders['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get<any>(
      `${this.apiBaseUrl}/wallets/customer/${encodeURIComponent(customerId)}`,
      {
        headers: this.buildJsonHeaders(extraHeaders)
      }
    );
  }

  /**
   * Query wallet by wallet address
   */
  getWalletByAddress(walletAddress: string, token?: string): Observable<any> {
    const extraHeaders: Record<string, string> = {};

    if (token) {
      extraHeaders['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get<any>(
      `${this.apiBaseUrl}/wallets/address/${encodeURIComponent(walletAddress)}`,
      {
        headers: this.buildJsonHeaders(extraHeaders)
      }
    );
  }

  /**
   * Reference APIs
   * These must be simple GET requests without custom headers.
   */

  getNextCustomerId(): Observable<any> {
    return this.http.get<any>(
      `${this.apiBaseUrl}/reference/next-customer-id`
    );
  }

  getOrganizations(): Observable<any> {
    return this.http.get<any>(
      `${this.apiBaseUrl}/reference/organizations`
    );
  }

  getCountries(): Observable<any> {
    return this.http.get<any>(
      `${this.apiBaseUrl}/reference/countries`
    );
  }

  saveWalletToken(token: string): void {
    localStorage.setItem('wallet_token', token);
  }

  getWalletToken(): string {
    return localStorage.getItem('wallet_token') || '';
  }

  clearWalletToken(): void {
    localStorage.removeItem('wallet_token');
  }
}
