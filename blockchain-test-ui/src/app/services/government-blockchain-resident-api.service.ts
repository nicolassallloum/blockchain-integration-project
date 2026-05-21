import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

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
  private readonly baseUrl = '/api/v1/government-blockchain/residents';

  constructor(private http: HttpClient) {}

  createResident(payload: CreateResidentPayload): Observable<any> {
    return this.http.post<any>(this.baseUrl, payload);
  }

  createWallet(residentId: string, payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${residentId}/wallet`, payload);
  }

  saveDraft(payload: CreateResidentPayload): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/drafts`, payload);
  }

  submitKyc(residentId: string, payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${residentId}/kyc/submit`, payload);
  }

  getResidentById(residentId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${residentId}`);
  }

  searchResidents(filters: Record<string, any>): Observable<any> {
    let params = new HttpParams();

    Object.keys(filters || {}).forEach((key) => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params = params.set(key, filters[key]);
      }
    });

    return this.http.get<any>(this.baseUrl, { params });
  }
}