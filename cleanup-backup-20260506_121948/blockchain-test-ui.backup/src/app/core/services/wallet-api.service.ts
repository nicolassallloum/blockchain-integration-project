import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private readonly apiBaseUrl = 'http://172.31.13.90:3001/api/v1';

  constructor(private http: HttpClient) {}

  private getHeaders(extraHeaders: Record<string, string> = {}) {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-request-id': `REQ_UI_${Date.now()}`,
      ...extraHeaders
    });
  }

  createWallet(payload: any) {
    return this.http.post(
      `${this.apiBaseUrl}/wallets`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  loginWallet(payload: any) {
    return this.http.post(
      `${this.apiBaseUrl}/wallets/login`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  getWalletByCustomerId(customerId: string, token?: string) {
    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get(
      `${this.apiBaseUrl}/wallets/customer/${customerId}`,
      { headers: this.getHeaders(headers) }
    );
  }

  getWalletByAddress(walletAddress: string, token?: string) {
    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get(
      `${this.apiBaseUrl}/wallets/address/${walletAddress}`,
      { headers: this.getHeaders(headers) }
    );
  }
}