import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AvailableLicense {
  licenseId: string;
  customerId: string;
  installId: string;
  contractRef: string;
  sequenceNumber: number;
  productModules: unknown;
  maxUsers: number;
  graceDays: number;
  validFrom: string;
  validUntil: string;
  issuedAt: string;
  issuedBy: string;
  revoked: boolean;
}

export interface AvailableLicensesResponse {
  success: boolean;
  count: number;
  licenses: AvailableLicense[];
}

export interface ProvisionLicenseWalletResponse {
  success: boolean;
  message: string;
  wallet: {
    licenseId: string;
    customerId: string;
    installId: string;
    walletAddress: string;
    walletPublicKey: string;
    walletType: string;
    derivationPath: string;
    recoveryWordCount: number;
    recoveryConfirmed: boolean;
    walletStatus: string;
    walletVersion: number;
    blockchainTransactionId: string | null;
    blockchainBlockNumber: string | null;
    createdAt: string;
    updatedAt: string;
  };
  license: AvailableLicense;
  blockchain: {
    status: string;
    verified: boolean;
    transactionId: string | null;
    blockNumber: string | null;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LicenseWalletService {
  private readonly apiUrl = '/api/license-wallets';

  constructor(private readonly http: HttpClient) {}

  getAvailableLicenses(): Observable<AvailableLicensesResponse> {
    return this.http.get<AvailableLicensesResponse>(
      `${this.apiUrl}/available-licenses`
    );
  }

  provisionWallet(payload: {
    licenseId: string;
    walletAddress: string;
    walletPublicKey: string;
    encryptedWalletJson: Record<string, unknown>;
    derivationPath: string;
    recoveryConfirmed: true;
  }): Observable<ProvisionLicenseWalletResponse> {
    return this.http.post<ProvisionLicenseWalletResponse>(
      `${this.apiUrl}/provision`,
      payload
    );
  }
}
