import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
  timestamp?: string;
}

export interface CreateResidentPayload {
  residentId: string;
  firstName: string;
  fatherName: string;
  motherName: string;
  lastName: string;
  fullName: string;
  arabicFullName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  nationalIdNumber: string;
  passportNumber?: string;
  residencyPermitNumber?: string;
  taxNumber?: string;
  mobileNumber: string;
  email: string;
  governorate: string;
  district: string;
  municipality: string;
  address: string;
  employmentStatus: string;
  occupation?: string;
  monthlyIncome?: number | null;
  kycStatus: string;
  riskCategory: string;
  walletAddress?: string;
  walletCurrency: string;
  walletStatus: string;
}

@Injectable({
  providedIn: 'root',
})
export class GovernmentBlockchainResidentApiService {
  private readonly apiBaseUrl =
    'http://172.31.13.90:3001/api/v1/government-blockchain/residents';

  constructor(private http: HttpClient) {}

  createResident(payload: CreateResidentPayload): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      this.apiBaseUrl,
      payload
    );
  }

  saveDraft(payload: CreateResidentPayload): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiBaseUrl}/draft`,
      payload
    );
  }

  createWallet(
    residentId: string,
    payload: { walletCurrency?: string }
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiBaseUrl}/${encodeURIComponent(residentId)}/wallet`,
      payload || {}
    );
  }

  submitKyc(
    residentId: string,
    payload: { kycStatus?: string; riskCategory?: string }
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiBaseUrl}/${encodeURIComponent(residentId)}/submit-kyc`,
      payload || {}
    );
  }

  getResidentById(residentId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${this.apiBaseUrl}/${encodeURIComponent(residentId)}`
    );
  }

  searchResidents(params?: Record<string, string>): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${this.apiBaseUrl}/search`,
      { params: params || {} }
    );
  }

  syncResidentToBlockchain(residentId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiBaseUrl}/${encodeURIComponent(residentId)}/sync-blockchain`,
      {}
    );
  }
}
