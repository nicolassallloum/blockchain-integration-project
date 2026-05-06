import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private readonly apiBaseUrl = 'http://127.0.0.1:3001/api/v1';

  constructor(private http: HttpClient) {}

  private buildHeaders(extraHeaders: Record<string, string> = {}): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-request-id': `REQ_UI_${Date.now()}`,
      ...extraHeaders
    });
  }

  createWallet(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiBaseUrl}/wallets`,
      payload,
      {
        headers: this.buildHeaders()
      }
    );
  }

  loginWallet(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiBaseUrl}/wallets/login`,
      payload,
      {
        headers: this.buildHeaders()
      }
    );
  }

  getWalletByCustomerId(customerId: string, token?: string): Observable<any> {
    const extraHeaders: Record<string, string> = {};

    if (token) {
      extraHeaders['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get<any>(
      `${this.apiBaseUrl}/wallets/customer/${customerId}`,
      {
        headers: this.buildHeaders(extraHeaders)
      }
    );
  }

  getWalletByAddress(walletAddress: string, token?: string): Observable<any> {
    const extraHeaders: Record<string, string> = {};

    if (token) {
      extraHeaders['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get<any>(
      `${this.apiBaseUrl}/wallets/address/${walletAddress}`,
      {
        headers: this.buildHeaders(extraHeaders)
      }
    );
  }
}
