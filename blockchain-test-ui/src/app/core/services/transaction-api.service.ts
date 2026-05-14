import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfigService } from './api-config.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TransactionApiService {
  private http = inject(HttpClient);
  private config = inject(ApiConfigService);

  private getHeaders(): HttpHeaders {
    const requestId = `REQ_UI_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)
      .toUpperCase()}`;

    return new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .set('x-api-key', environment.fabricApiKey)
      .set('x-request-id', requestId)
      .set('x-correlation-id', requestId)
      .set('x-source-system', 'BLOCKCHAIN_TEST_UI')
      .set('x-request-source', 'ANGULAR_UI');
  }

  walletTransfer(payload: any): Observable<any> {
    return this.http.post(
      `${this.config.baseUrl}/transactions/wallet-transfer`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  organizationTransfer(payload: any): Observable<any> {
    return this.http.post(
      `${this.config.baseUrl}/transactions/organization-transfer`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  searchTransactions(filters: any): Observable<any> {
    let params = new HttpParams();

    Object.keys(filters || {}).forEach((key) => {
      const value = filters[key];

      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    });

    return this.http.get(`${this.config.baseUrl}/transactions`, {
      headers: this.getHeaders(),
      params
    });
  }
}
