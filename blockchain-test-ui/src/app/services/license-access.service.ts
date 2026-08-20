import {
  Injectable
} from '@angular/core';

import {
  HttpClient
} from '@angular/common/http';

import {
  Observable
} from 'rxjs';

export interface LicenseAccessWallet {
  licenseId: string;
  customerId: string;
  installId: string;
  walletAddress: string;
  encryptedWalletJson:
    Record<string, unknown>;
  walletType: string;
  derivationPath: string;
  walletStatus: string;
  contractRef: string;
}

export interface LicenseAccessWalletResponse {
  success: boolean;
  wallet: LicenseAccessWallet;
}

export interface WordChallengeResponse {
  success: boolean;
  challengeId: string;
  walletAddress: string;
  contractRef: string;
  wordPosition1: number;
  wordPosition2: number;
  expiresAt: string;
}

export interface AccessedLicense {
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
  signedJwt: string;
  walletAddress: string;
  walletStatus: string;
  calculatedStatus: string;
}

export interface WordVerificationResponse {
  success: boolean;
  message: string;
  license: AccessedLicense;
  licenseHash: string;

  passwordReset: {
    allowed: boolean;
    resetToken: string;
    expiresInSeconds: number;
  };
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;

  wallet: {
    licenseId: string;
    walletAddress: string;
    walletStatus: string;
    walletVersion: number;
    updatedAt: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LicenseAccessService {

  private readonly apiUrl =
    '/api/license-access';

  constructor(
    private readonly http: HttpClient
  ) {}

  getWallet(
    walletAddress: string
  ): Observable<LicenseAccessWalletResponse> {

    return this.http.get<
      LicenseAccessWalletResponse
    >(
      `${this.apiUrl}/wallet/` +
      encodeURIComponent(walletAddress)
    );
  }

  createForgotPasswordChallenge(
    walletAddress: string
  ): Observable<WordChallengeResponse> {

    return this.http.post<
      WordChallengeResponse
    >(
      `${this.apiUrl}/forgot-password/challenge`,
      {
        walletAddress
      }
    );
  }

  verifyRecoveryWords(
    payload: {
      challengeId: string;
      wordDigest1: string;
      wordDigest2: string;
    }
  ): Observable<WordVerificationResponse> {

    return this.http.post<
      WordVerificationResponse
    >(
      `${this.apiUrl}/forgot-password/verify`,
      payload
    );
  }


  completePasswordReset(
    payload: {
      walletAddress: string;
      resetToken: string;
      signature: string;
      encryptedWalletJson:
        Record<string, unknown>;
    }
  ): Observable<PasswordResetResponse> {

    return this.http.post<
      PasswordResetResponse
    >(
      `${this.apiUrl}/password-reset/complete`,
      payload
    );
  }
}
