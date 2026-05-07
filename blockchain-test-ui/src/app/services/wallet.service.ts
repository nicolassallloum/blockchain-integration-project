import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getWallets(params?: any): Observable<any> {
    let httpParams = new HttpParams();

    Object.keys(params || {}).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });

    return this.http.get(`${this.baseUrl}/wallets`, { params: httpParams });
  }

  getNextCustomerId(): Observable<any> {
    return this.http.get(`${this.baseUrl}/wallets/next-customer-id`);
  }

  createWallet(payload: any): Observable<any> {
    const normalizedPayload = {
      ...payload,
      organizationId: payload.organizationId || payload.organization_id,
      initialBalance: Number(payload.initialBalance ?? payload.currentBalance ?? 0),
      currentBalance: Number(payload.initialBalance ?? payload.currentBalance ?? 0),
      currencyCode: payload.currencyCode || payload.currency_code || payload.currency || 'USD'
    };

    return this.http.post(`${this.baseUrl}/wallets`, normalizedPayload);
  }

  loginWallet(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/wallets/login`, payload);
  }

  getWalletByCustomerId(customerId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/wallets/customer/${encodeURIComponent(customerId)}`);
  }

  getWalletByAddress(walletAddress: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/wallets/address/${encodeURIComponent(walletAddress)}`);
  }

  getOrganizations(): Observable<any> {
    return this.http.get(`${this.baseUrl}/organizations`).pipe(
      catchError(() => this.http.get(`${this.baseUrl}/reference/organizations`)),
      map((response: any) => {
        const rawOrganizations =
          response?.data?.organizations ||
          response?.data ||
          response?.organizations ||
          response ||
          [];

        const organizations = Array.isArray(rawOrganizations)
          ? rawOrganizations.map((org: any) => ({
              organizationId:
                org.organizationId ||
                org.organization_id ||
                org.id ||
                '',
              organizationName:
                org.organizationName ||
                org.organization_name ||
                org.name ||
                org.organization_code ||
                '',
              organizationCode:
                org.organizationCode ||
                org.organization_code ||
                ''
            }))
          : [];

        return {
          success: true,
          data: organizations
        };
      })
    );
  }

  getCountries(): Observable<any> {
    return this.http.get(`${this.baseUrl}/reference/countries`).pipe(
      catchError(() => of({ success: true, data: [] }))
    );
  }

  saveWalletToken(token: string): void {
    if (token) {
      localStorage.setItem('digital_kyc_wallet_token', token);
    }
  }

  saveWalletProfile(profile: any): void {
    if (profile) {
      localStorage.setItem('digital_kyc_wallet_profile', JSON.stringify(profile));
    }
  }

  clearWalletAuth(): void {
    localStorage.removeItem('digital_kyc_wallet_token');
    localStorage.removeItem('digital_kyc_wallet_profile');
  }
}