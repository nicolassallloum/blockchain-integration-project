import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class TransactionApiService {
  private http = inject(HttpClient);
  private config = inject(ApiConfigService);

  walletTransfer(payload: any): Observable<any> {
    return this.http.post(`${this.config.baseUrl}/transactions/wallet-transfer`, payload);
  }

  organizationTransfer(payload: any): Observable<any> {
    return this.http.post(`${this.config.baseUrl}/transactions/organization-transfer`, payload);
  }

  searchTransactions(filters: any): Observable<any> {
    let params = new HttpParams();

    Object.keys(filters).forEach((key) => {
      const value = filters[key];

      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    });

    return this.http.get(`${this.config.baseUrl}/transactions`, { params });
  }
}
