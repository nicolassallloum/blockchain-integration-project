import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GovernmentTransactionApiService {
  private readonly baseUrl =
    'http://172.31.13.90:3001/api/v1/government-blockchain/transactions';

  constructor(private http: HttpClient) {}

  getResidentsDropdown() {
    return this.http.get<any>(`${this.baseUrl}/residents-dropdown`);
  }

  getServices() {
    return this.http.get<any>(`${this.baseUrl}/services`);
  }

  createTransaction(payload: any) {
    return this.http.post<any>(this.baseUrl, payload);
  }
}