import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../environments/environment';

export interface BulkWalletRequest {
  customerId: string;
  fullName: string;
  nationalIdHash: string;
  emailHash?: string;
  mobileHash?: string;
  countryId?: string | number;
  organizationId: string;
  organizationType?: string;
  initialBalance: number;
  currencyCode: string;
  passwordHash?: string;
  requestSource?: string;
  sourceSystem?: string;
  createdBy?: string;
}

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
      customerId: String(payload.customerId || payload.customer_id || '').trim(),
      organizationId: payload.organizationId || payload.organization_id,
      fullName: payload.fullName || payload.full_name,
      nationalIdHash:
        payload.nationalIdHash ||
        payload.national_id_hash ||
        payload.countryId ||
        payload.country_id ||
        '',
      mobileHash: payload.mobileHash || payload.mobile_hash || '',
      emailHash: payload.emailHash || payload.email_hash || '',
      passwordHash:
        payload.passwordHash ||
        payload.password_hash ||
        payload.password ||
        this.generatePassword(),
      initialBalance: Number(payload.initialBalance ?? payload.currentBalance ?? 0),
      currentBalance: Number(payload.initialBalance ?? payload.currentBalance ?? 0),
      currencyCode: payload.currencyCode || payload.currency_code || payload.currency || 'USD',
      requestSource: payload.requestSource || 'ANGULAR_UI',
      sourceSystem: payload.sourceSystem || 'BLOCKCHAIN_TEST_UI',
      createdBy: payload.createdBy || 'nix'
    };

    return this.http.post(`${this.baseUrl}/wallets`, normalizedPayload);
  }

  bulkCreateWallets(wallets: BulkWalletRequest[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/wallets/bulk-create`, { wallets });
  }

  createOrganizationWallet(payload: any): Observable<any> {
    const normalizedPayload = {
      ...payload,
      organizationId: payload.organizationId || payload.organization_id,
      passwordHash: payload.passwordHash || payload.password_hash || payload.password,
      initialBalance: Number(payload.initialBalance ?? payload.currentBalance ?? 0),
      currentBalance: Number(payload.initialBalance ?? payload.currentBalance ?? 0),
      currencyCode: payload.currencyCode || payload.currency_code || payload.currency || 'USD',
      requestSource: payload.requestSource || 'ANGULAR_UI',
      sourceSystem: payload.sourceSystem || 'BLOCKCHAIN_TEST_UI',
      createdBy: payload.createdBy || 'nix'
    };

    return this.http.post(`${this.baseUrl}/wallets/organization-wallets`, normalizedPayload);
  }

  loginWallet(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/wallets/login`, payload);
  }

  getWalletByCustomerId(customerId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/wallets/customer/${encodeURIComponent(customerId)}`);
  }

  getWalletByAddress(walletAddress: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/wallets/${encodeURIComponent(walletAddress)}`);
  }

  getOrganizationTypes(): Observable<any> {
    return this.http.get(`${this.baseUrl}/reference/organization-types`).pipe(
      catchError(() => of({ success: true, data: [] })),
      map((response: any) => {
        const rawTypes =
          response?.data?.organizationTypes ||
          response?.data ||
          response?.organizationTypes ||
          response ||
          [];

        const organizationTypes = Array.isArray(rawTypes)
          ? rawTypes
              .map((item: any) =>
                item.organizationType ||
                item.organization_type ||
                item.type ||
                item
              )
              .filter((type: any) => !!type)
          : [];

        return {
          success: true,
          data: organizationTypes
        };
      })
    );
  }

  getOrganizations(organizationType?: string): Observable<any> {
    let params = new HttpParams();

    if (organizationType) {
      params = params.set('organizationType', organizationType);
    }

    return this.http.get(`${this.baseUrl}/reference/organizations`, { params }).pipe(
      catchError(() => this.http.get(`${this.baseUrl}/organizations`, { params })),
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
                org.registration_number ||
                '',
              organizationType:
                org.organizationType ||
                org.organization_type ||
                org.type ||
                '',
              status:
                org.status ||
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

  getOrganizationsByType(organizationType: string): Observable<any> {
    return this.getOrganizations(organizationType);
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

  private generatePassword(length: number = 16): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return password;
  }
}
