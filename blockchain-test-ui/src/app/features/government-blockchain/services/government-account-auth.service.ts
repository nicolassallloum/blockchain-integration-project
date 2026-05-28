import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type GovernmentAccountType =
  | 'MINISTRY'
  | 'PUBLIC_ADMINISTRATION'
  | 'RESIDENT';

export interface GovernmentLoginRequest {
  username: string;
  password: string;
  accountType: GovernmentAccountType;
}

export interface GovernmentAccountInfo {
  accountId: string;
  accountType: GovernmentAccountType;
  username: string;
  displayName: string;
  arabicName?: string;
  email?: string;
  mobile?: string;
  nationalId?: string;
  walletAddress: string;
  walletBalance: number;
  currency: string;
  status: string;
  createdAt: string;
  blockchainTxId?: string;
  couchDbDocId?: string;
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
      `${this.apiBaseUrl}/auth/login`,
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
