import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type GovernmentAccountType =
  | 'MINISTRY'
  | 'PUBLIC_ADMINISTRATION'
  | 'RESIDENT';

export interface GovernmentLoginRequest {
  accountType: GovernmentAccountType;
  walletAddress: string;
  password: string;
}

export interface GovernmentAccountInfo {
  accountId: string;
  accountName: string;
  accountType: GovernmentAccountType;
  username?: string;
  displayName: string;
  arabicName?: string | null;
  email?: string | null;
  mobile?: string | null;
  nationalId?: string | null;
  walletAddress: string;
  walletBalance: number;
  currency: string;
  walletStatus: string;
  status: string;
  blockchainStatus?: string | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  blockchainTxId?: string | null;
  couchDbDocId?: string | null;
}

export interface GovernmentTransaction {
  transactionId: string;
  transactionType: string;
  fromAccountId: string;
  fromWalletAddress: string;
  toAccountId: string;
  toWalletAddress: string;
  amount: number;
  currency: string;
  transactionStatus: string;
  serviceName?: string;
  ministryName?: string;
  administrationName?: string;
  blockchainTxId?: string;
  createdAt: string;
}

export interface GovernmentLoginResponse {
  success: boolean;
  message: string;
  data: GovernmentAccountInfo;
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentAccountAuthService {
  private readonly apiBaseUrl =
    'http://172.31.13.90:3001/api/v1/government-blockchain';

  constructor(private http: HttpClient) {}

  login(payload: GovernmentLoginRequest): Observable<GovernmentLoginResponse> {
    return this.http.post<GovernmentLoginResponse>(
      `${this.apiBaseUrl}/account-login`,
      payload
    );
  }

  getAccountInfo(accountId: string): Observable<GovernmentAccountInfo> {
    return this.http.get<GovernmentAccountInfo>(
      `${this.apiBaseUrl}/accounts/${accountId}`
    );
  }

  getAccountTransactions(accountId: string): Observable<GovernmentTransaction[]> {
    return this.http.get<GovernmentTransaction[]>(
      `${this.apiBaseUrl}/accounts/${accountId}/transactions`
    );
  }
}
