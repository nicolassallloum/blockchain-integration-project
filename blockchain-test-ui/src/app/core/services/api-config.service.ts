import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  private readonly defaultBaseUrl = 'http://172.31.13.90:3001/api/v1';

  get baseUrl(): string {
    return localStorage.getItem('BLOCKCHAIN_API_BASE_URL') || this.defaultBaseUrl;
  }

  setBaseUrl(value: string): void {
    localStorage.setItem('BLOCKCHAIN_API_BASE_URL', value);
  }

  getApiKey(): string {
    return localStorage.getItem('BLOCKCHAIN_API_KEY') || '';
  }

  setApiKey(value: string): void {
    localStorage.setItem('BLOCKCHAIN_API_KEY', value);
  }

  getJwtToken(): string {
    return localStorage.getItem('BLOCKCHAIN_JWT_TOKEN') || '';
  }

  setJwtToken(value: string): void {
    localStorage.setItem('BLOCKCHAIN_JWT_TOKEN', value);
  }

  clearJwtToken(): void {
    localStorage.removeItem('BLOCKCHAIN_JWT_TOKEN');
  }
}
