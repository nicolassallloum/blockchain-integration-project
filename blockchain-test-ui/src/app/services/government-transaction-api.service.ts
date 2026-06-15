import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GovernmentTransactionApiService {
  private readonly governmentBaseUrl =
    'http://172.31.13.90:3001/api/v1/government-blockchain';

  private readonly transactionsUrl =
    `${this.governmentBaseUrl}/transactions`;

  private readonly documentsUrl = `${this.governmentBaseUrl}/documents`;

  constructor(private http: HttpClient) {}

  getResidentsDropdown() {
    return this.http.get<any>(`${this.transactionsUrl}/residents-dropdown`);
  }

  getServices() {
    return this.http.get<any>(`${this.transactionsUrl}/services`);
  }

  getMinistriesDropdown() {
    return this.http.get<any>(`${this.transactionsUrl}/ministries-dropdown`);
  }

  getTransactionStatuses() {
    return this.http.get<any>(`${this.transactionsUrl}/reference/transaction-status`);
  }

  getPaymentMethods() {
    return this.http.get<any>(`${this.transactionsUrl}/reference/payment-methods`);
  }

  previewFees(payload: any) {
    return this.http.post<any>(`${this.transactionsUrl}/fee-preview`, payload);
  }


  getNextTransactionReference(): any {
    return this.http.get<any>(`${this.transactionsUrl}/next-reference`);
  }

  createTransaction(payload: any) {
    return this.http.post<any>(this.transactionsUrl, payload);
  }

  uploadKycDocument(formData: FormData) {
    return this.http.post<any>(`${this.documentsUrl}/upload`, formData);
  }
}
