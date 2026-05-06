import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  /**
   * IMPORTANT:
   * Use server IP because Angular is opened from your Windows browser.
   * If you use 127.0.0.1 in the browser, it means the Windows machine,
   * not the Linux server.
   */
  private readonly apiBaseUrl = 'http://172.31.13.90:3001/api/v1';

  constructor(private http: HttpClient) {}

  private buildHeaders(extraHeaders: Record<string, string> = {}): HttpHeaders {
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
        headers: this.buildHeaders()
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
        headers: this.buildHeaders()
      }
    );
  }

  /**
   * Query wallet by customer ID
   * GET /api/v1/wallets/customer/:customerId
   */
  getWalletByCustomerId(customerId: string, token?: string): Observable<any> {
    const extraHeaders: Record<string, string> = {};

    if (token) {
      extraHeaders['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get<any>(
      `${this.apiBaseUrl}/wallets/customer/${encodeURIComponent(customerId)}`,
      {
        headers: this.buildHeaders(extraHeaders)
      }
    );
  }

  /**
   * Query wallet by wallet address
   * GET /api/v1/wallets/address/:walletAddress
   */
  getWalletByAddress(walletAddress: string, token?: string): Observable<any> {
    const extraHeaders: Record<string, string> = {};

    if (token) {
      extraHeaders['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get<any>(
      `${this.apiBaseUrl}/wallets/address/${encodeURIComponent(walletAddress)}`,
      {
        headers: this.buildHeaders(extraHeaders)
      }
    );
  }

  /**
   * Get next customer ID from PostgreSQL sequence
   * GET /api/v1/reference/next-customer-id
   */
  getNextCustomerId(): Observable<any> {
    return this.http.get<any>(
      `${this.apiBaseUrl}/reference/next-customer-id`,
      {
        headers: this.buildHeaders()
      }
    );
  }

  /**
   * Get organizations dropdown
   * Data source:
   * blockchain.blockchain_organization
   *
   * Display:
   * organization_name
   *
   * Value sent:
   * organization_id
   *
   * GET /api/v1/reference/organizations
   */
  getOrganizations(): Observable<any> {
    return this.http.get<any>(
      `${this.apiBaseUrl}/reference/organizations`,
      {
        headers: this.buildHeaders()
      }
    );
  }

  /**
   * Get countries / nationality dropdown
   * Data source:
   * blockchain.countries
   *
   * Display:
   * cou_name
   *
   * Value used for National ID Hash:
   * cou_id
   *
   * GET /api/v1/reference/countries
   */
  getCountries(): Observable<any> {
    return this.http.get<any>(
      `${this.apiBaseUrl}/reference/countries`,
      {
        headers: this.buildHeaders()
      }
    );
  }

  /**
   * Optional helper:
   * Save wallet token after login
   */
  saveWalletToken(token: string): void {
    localStorage.setItem('wallet_token', token);
  }

  /**
   * Optional helper:
   * Read wallet token
   */
  getWalletToken(): string {
    return localStorage.getItem('wallet_token') || '';
  }

  /**
   * Optional helper:
   * Clear wallet token
   */
  clearWalletToken(): void {
    localStorage.removeItem('wallet_token');
  }
}