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
    'http://172.31.13.90:3001/api/v1/government-blockchain/resident-wallets';

  constructor(private http: HttpClient) {}

  getResidentWallets(filters: any = {}) {
    let params = new HttpParams();

    if (filters.walletAddress) {
      params = params.set('walletAddress', filters.walletAddress);
    }

    if (filters.residentId) {
      params = params.set('residentId', filters.residentId);
    }

    if (filters.residentName) {
      params = params.set('residentName', filters.residentName);
    }

    if (filters.walletStatus) {
      params = params.set('walletStatus', filters.walletStatus);
    }

    if (filters.blockchainStatus) {
      params = params.set('blockchainStatus', filters.blockchainStatus);
    }

    return this.http.get<any>(
      `${this.apiUrl}/government-blockchain/resident-wallets`,
      { params }
    );
  }
}
