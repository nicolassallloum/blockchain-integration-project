import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://127.0.0.1:3001/api/v1';

@Injectable({
  providedIn: 'root'
})
export class BlockchainKycService {
  constructor(private http: HttpClient) {}

  getNextCustomerId(): Observable<any> {
    return this.http.get(`${API_BASE_URL}/reference/next-customer-id`);
  }

  getCountries(): Observable<any> {
    return this.http.get(`${API_BASE_URL}/reference/countries`);
  }

  getOrganizationTypes(): Observable<any> {
    return this.http.get(`${API_BASE_URL}/reference/blockchain-organization-types`);
  }

  getOrganizations(): Observable<any> {
    return this.http.get(`${API_BASE_URL}/reference/blockchain-organizations`);
  }

  getSourceOfFunds(): Observable<any> {
    return this.http.get(`${API_BASE_URL}/reference/source-of-funds`);
  }

  getOccupations(): Observable<any> {
    return this.http.get(`${API_BASE_URL}/reference/occupations`);
  }

  getEconomicSectors(): Observable<any> {
    return this.http.get(`${API_BASE_URL}/reference/economic-sectors`);
  }

  createBlockchainKycWallet(formData: FormData): Observable<any> {
    return this.http.post(`${API_BASE_URL}/kyc/blockchain-wallet`, formData);
  }
}
