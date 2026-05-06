import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class WalletApiService {
  private http = inject(HttpClient);
  private config = inject(ApiConfigService);

  createWallet(payload: any): Observable<any> {
    return this.http.post(`${this.config.baseUrl}/wallets`, payload);
  }

  loginWallet(payload: any): Observable<any> {
    return this.http.post(`${this.config.baseUrl}/wallets/login`, payload);
  }

  getWalletByCustomerId(customerId: string): Observable<any> {
    return this.http.get(`${this.config.baseUrl}/wallets/customer/${customerId}`);
  }

  getWalletByAddress(walletAddress: string): Observable<any> {
    return this.http.get(`${this.config.baseUrl}/wallets/${walletAddress}`);
  }
}
