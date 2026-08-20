import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RecoveryChallengeResponse {
  challengeId: string;
  challenge: string;
  expiresAt: string;
}

export interface LicenseWalletData {
  customerId: string;
  licenseId: string;
  installId: string;
  walletAddress: string;
  walletPublicKey: string;
  walletType: string;
  derivationPath: string;
  recoveryWordCount: number;
  walletStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseData {
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
  signedJwt: string;
  revoked: boolean;
  calculatedStatus: string;
}

export interface LicenseRecoveryResponse {
  success: boolean;
  message: string;
  recoveredAt: string;
  wallet: LicenseWalletData;
  licenses: LicenseData[];
}

@Injectable({
  providedIn: 'root'
})
export class LicenseRecoveryService {
  private readonly apiUrl = '/api/license-recovery';

  constructor(private readonly http: HttpClient) {}

  createChallenge(
    walletAddress: string
  ): Observable<RecoveryChallengeResponse> {
    return this.http.post<RecoveryChallengeResponse>(
      `${this.apiUrl}/challenge`,
      {
        walletAddress
      }
    );
  }

  recoverLicense(payload: {
    walletAddress: string;
    challengeId: string;
    signature: string;
  }): Observable<LicenseRecoveryResponse> {
    return this.http.post<LicenseRecoveryResponse>(
      `${this.apiUrl}/recover`,
      payload
    );
  }
}