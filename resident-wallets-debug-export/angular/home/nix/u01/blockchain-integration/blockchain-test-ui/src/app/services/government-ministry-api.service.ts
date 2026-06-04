import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GovernmentApiResponse<T> {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
  errorCode?: string;
  timestamp?: string;
  requestId?: string;
  correlationId?: string;
}

export interface CreateMinistryAccountPayload {
  ministry: {
    ministryId: string;
    ministryCode: string;
    ministryName: string;
    arabicName: string;
    ministryType: string;
    parentMinistry?: string | null;
    ministerName: string;
    contactPerson: string;
    contactEmail: string;
    contactMobile: string;
    address: string;

    countryId?: string | null;
    countryCode?: string | null;
    countryName?: string | null;

    governorateId?: string | null;
    governorateCode?: string | null;
    governorateName?: string | null;
    governorateNameAr?: string | null;

    website?: string | null;
    walletStatus: string;
    institutionStatus: string;

    loginUsername?: string | null;
    password?: string | null;
  };

  wallet?: {
    walletAddress?: string | null;
    walletCurrency: string;
    walletInitialBalance: number;
    walletType: string;
    walletStatus: string;
  };

  blockchain?: {
    sourceSystem: string;
    module: string;
    ledgerAction: string;
    preparedForFabricSubmission: boolean;
  };
}

export interface SaveMinistryDraftPayload {
  draftStatus: string;
  data: unknown;
}

export interface CreateMinistryWalletPayload {
  walletAddress?: string | null;
  walletCurrency: string;
  walletInitialBalance: number;
  walletType: string;
  walletStatus: string;
}

export interface MinistryLoginPayload {
  username: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentMinistryApiService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = '/api/v1/government-blockchain/ministries';

  createMinistryAccount(
    payload: CreateMinistryAccountPayload
  ): Observable<GovernmentApiResponse<any>> {
    return this.http.post<GovernmentApiResponse<any>>(this.baseUrl, payload);
  }

  saveDraft(
    payload: SaveMinistryDraftPayload
  ): Observable<GovernmentApiResponse<any>> {
    return this.http.post<GovernmentApiResponse<any>>(
      `${this.baseUrl}/draft`,
      payload
    );
  }

  createMinistryWallet(
    ministryId: string,
    payload: CreateMinistryWalletPayload
  ): Observable<GovernmentApiResponse<any>> {
    return this.http.post<GovernmentApiResponse<any>>(
      `${this.baseUrl}/${encodeURIComponent(ministryId)}/wallet`,
      payload
    );
  }

  loginMinistry(
    payload: MinistryLoginPayload
  ): Observable<GovernmentApiResponse<any>> {
    return this.http.post<GovernmentApiResponse<any>>(
      `${this.baseUrl}/login`,
      payload
    );
  }

  getMinistries(): Observable<GovernmentApiResponse<any[]>> {
    return this.http.get<GovernmentApiResponse<any[]>>(this.baseUrl);
  }

  getMinistryById(ministryId: string): Observable<GovernmentApiResponse<any>> {
    return this.http.get<GovernmentApiResponse<any>>(
      `${this.baseUrl}/${encodeURIComponent(ministryId)}`
    );
  }
}