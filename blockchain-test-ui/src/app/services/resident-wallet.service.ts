import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ResidentWallet {
  walletAddress: string;
  residentId: string;
  residentName: string;
  currency: string;
  currentBalance: number;
  walletStatus: string;
  blockchainStatus: string;
  createdAt: string;
}

export interface ResidentWalletSummary {
  totalWallets: number;
  activeWallets: number;
  suspendedWallets: number;
  blockedWallets: number;
  blockchainSynced: number;
}

export interface ResidentWalletResponse {
  success: boolean;
  message: string;
  summary: ResidentWalletSummary;
  data: ResidentWallet[];
}

export interface ResidentWalletFilters {
  walletAddress?: string;
  residentId?: string;
  residentName?: string;
  walletStatus?: string;
  blockchainStatus?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ResidentWalletService {
  private readonly apiUrl =
    'http://127.0.0.1:3001/api/v1/government-blockchain/resident-wallets';

  constructor(private http: HttpClient) {}

  getResidentWallets(filters: ResidentWalletFilters = {}): Observable<ResidentWalletResponse> {
    let params = new HttpParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    });

    return this.http.get<ResidentWalletResponse>(this.apiUrl, { params });
  }
}
