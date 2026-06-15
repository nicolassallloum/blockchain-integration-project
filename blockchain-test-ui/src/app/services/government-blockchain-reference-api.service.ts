import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  count: number;
  data: T;
}

export interface GovernmentCountry {
  countryId: string;
  countryCode: string;
  countryName: string;
}

export interface GovernmentGovernorate {
  governorateId: string;
  countryId: string;
  countryCode: string;
  governorateCode: string;
  governorateName: string;
  governorateNameAr: string;
  isActive: boolean;
}

export interface WalletType {
  walletTypeId: string;
  walletTypeCode: string;
  walletTypeName: string;
  walletTypeDescription: string;
  isActive: boolean;
}

export interface WalletStatus {
  walletStatusId: string;
  walletStatusCode: string;
  walletStatusName: string;
  walletStatusDescription: string;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentBlockchainReferenceApiService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = 'http://172.31.13.90:3001/api/v1/government-blockchain/reference';

  getCountries(): Observable<ApiResponse<GovernmentCountry[]>> {
    return this.http.get<ApiResponse<GovernmentCountry[]>>(
      `${this.baseUrl}/countries`
    );
  }

  getGovernorates(countryCode: string): Observable<ApiResponse<GovernmentGovernorate[]>> {
    const params = new HttpParams().set('countryCode', countryCode);

    return this.http.get<ApiResponse<GovernmentGovernorate[]>>(
      `${this.baseUrl}/governorates`,
      { params }
    );
  }

  getWalletTypes(): Observable<ApiResponse<WalletType[]>> {
    return this.http.get<ApiResponse<WalletType[]>>(
      `${this.baseUrl}/wallet-types`
    );
  }

  getWalletStatuses(): Observable<ApiResponse<WalletStatus[]>> {
    return this.http.get<ApiResponse<WalletStatus[]>>(
      `${this.baseUrl}/wallet-statuses`
    );
  }
}
