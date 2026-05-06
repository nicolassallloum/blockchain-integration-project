import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private readonly baseUrl = `${environment.apiBaseUrl}/transactions`;

  constructor(private http: HttpClient) {}

  walletTransfer(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/wallet-transfer`, payload);
  }

  organizationTransfer(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/organization-transfer`, payload);
  }

  getTransactions(filters: any = {}): Observable<any> {
    let params = new HttpParams();

    Object.keys(filters || {}).forEach((key) => {
      const value = filters[key];

      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    });

    return this.http.get(`${this.baseUrl}`, { params });
  }

  getTransactionById(transactionId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${encodeURIComponent(transactionId)}`);
  }
}