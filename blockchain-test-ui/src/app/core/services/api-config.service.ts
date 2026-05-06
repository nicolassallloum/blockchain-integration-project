import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  /**
   * Main Blockchain API base URL.
   *
   * Example:
   * http://172.31.13.90:3001/api/v1
   */
  public readonly baseUrl = environment.apiBaseUrl;

  /**
   * Compatibility getter for older services.
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Compatibility getter for services using getApiBaseUrl().
   */
  getApiBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Wallet APIs
   */
  get walletsUrl(): string {
    return `${this.baseUrl}/wallets`;
  }

  /**
   * Transaction APIs
   */
  get transactionsUrl(): string {
    return `${this.baseUrl}/transactions`;
  }

  /**
   * Fabric APIs
   */
  get fabricUrl(): string {
    return `${this.baseUrl}/fabric`;
  }

  /**
   * Reference APIs
   */
  get referenceUrl(): string {
    return `${this.baseUrl}/reference`;
  }

  /**
   * Organization APIs
   */
  get organizationsUrl(): string {
    return `${this.baseUrl}/organizations`;
  }
}