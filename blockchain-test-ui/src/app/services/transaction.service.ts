import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * IMPORTANT:
   * Backend API security is enabled:
   * ENABLE_API_KEY_PROTECTION=true
   *
   * Therefore all protected transaction calls must include x-api-key.
   */
  private readonly apiKey =
    '774101c2e4e6e8d46a8bb6c02571f0239ac7c8bd548c22db1162671e502278f7';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const requestId = `REQ_UI_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)
      .toUpperCase()}`;

    let headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .set('x-api-key', this.apiKey)
      .set('x-request-id', requestId)
      .set('x-correlation-id', requestId)
      .set('x-source-system', 'BLOCKCHAIN_TEST_UI')
      .set('x-request-source', 'ANGULAR_UI');

    const token =
      localStorage.getItem('digital_kyc_wallet_token') ||
      sessionStorage.getItem('digital_kyc_wallet_token');

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  walletTransfer(payload: any): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/transactions/wallet-transfer`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  organizationTransfer(payload: any): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/transactions/organization-transfer`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  getTransactions(filters: any = {}): Observable<any> {
    let params = new HttpParams();

    Object.keys(filters || {}).forEach((key) => {
      const value = filters[key];

      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value);
      }
    });

    return this.http.get(
      `${this.baseUrl}/transactions`,
      {
        headers: this.getHeaders(),
        params
      }
    );
  }

  getTransactionById(transactionId: string): Observable<any> {
    return this.http.get(
      `${this.baseUrl}/transactions/${encodeURIComponent(transactionId)}`,
      { headers: this.getHeaders() }
    );
  }
}
