import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ResidentReferenceApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

export interface ResidentLookupItem {
  id: string;
  code: string;
  name: string;
  arabicName?: string | null;
  riskScoreMin?: number;
  riskScoreMax?: number;
  districtCode?: string;
  governorateCode?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ResidentReferenceApiService {
  private readonly apiBaseUrl =
    'http://172.31.13.90:3001/api/v1/government-blockchain/resident-reference';

  constructor(private http: HttpClient) {}

  getNextResidentId(): Observable<ResidentReferenceApiResponse<{ residentId: string }>> {
    return this.http.get<ResidentReferenceApiResponse<{ residentId: string }>>(
      `${this.apiBaseUrl}/next-resident-id`
    );
  }

  getGovernorates(): Observable<ResidentReferenceApiResponse<ResidentLookupItem[]>> {
    return this.http.get<ResidentReferenceApiResponse<ResidentLookupItem[]>>(
      `${this.apiBaseUrl}/governorates`
    );
  }

  getDistricts(governorateId: string): Observable<ResidentReferenceApiResponse<ResidentLookupItem[]>> {
    const params = new HttpParams().set('governorateId', governorateId);

    return this.http.get<ResidentReferenceApiResponse<ResidentLookupItem[]>>(
      `${this.apiBaseUrl}/districts`,
      { params }
    );
  }

  getMunicipalities(districtId: string): Observable<ResidentReferenceApiResponse<ResidentLookupItem[]>> {
    const params = new HttpParams().set('districtId', districtId);

    return this.http.get<ResidentReferenceApiResponse<ResidentLookupItem[]>>(
      `${this.apiBaseUrl}/municipalities`,
      { params }
    );
  }

  getKycStatuses(): Observable<ResidentReferenceApiResponse<ResidentLookupItem[]>> {
    return this.http.get<ResidentReferenceApiResponse<ResidentLookupItem[]>>(
      `${this.apiBaseUrl}/kyc-statuses`
    );
  }

  getRiskCategories(): Observable<ResidentReferenceApiResponse<ResidentLookupItem[]>> {
    return this.http.get<ResidentReferenceApiResponse<ResidentLookupItem[]>>(
      `${this.apiBaseUrl}/risk-categories`
    );
  }

  getEmploymentStatuses(): Observable<ResidentReferenceApiResponse<ResidentLookupItem[]>> {
    return this.http.get<ResidentReferenceApiResponse<ResidentLookupItem[]>>(
      `${this.apiBaseUrl}/employment-statuses`
    );
  }
}
