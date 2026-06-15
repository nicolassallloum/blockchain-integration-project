import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface HashVerificationResult {
  verificationStatus: string;
  verified: boolean;
  found: boolean;
  source: string | null;
  entityType: string | null;
  entityId: string | null;
  hash: string;
  blockchainStatus: string | null;
  createdDate: string | null;
  relatedProof: any;
  details: any;
}

interface HashVerificationResponse {
  success: boolean;
  message: string;
  data: HashVerificationResult;
  requestId?: string;
  timestamp?: string;
}

@Component({
  selector: 'app-hash-verification',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './hash-verification.html',
  styleUrl: './hash-verification.scss',
})
export class HashVerification {
  hashValue = '';

  loading = false;
  errorMessage = '';
  successMessage = '';

  result: HashVerificationResult | null = null;
  recentVerifications: HashVerificationResult[] = [];

  private readonly apiUrl = 'http://172.31.13.90:3001/api/v1/government-blockchain/hash-verification';

  constructor(private readonly http: HttpClient) {}

  verifyHash(): void {
    const cleanHash = this.hashValue.trim();

    this.errorMessage = '';
    this.successMessage = '';
    this.result = null;

    if (!cleanHash) {
      this.errorMessage = 'Please enter a document hash or blockchain proof hash.';
      return;
    }

    if (cleanHash.length < 8) {
      this.errorMessage = 'Hash value must be at least 8 characters.';
      return;
    }

    this.loading = true;

    this.http.post<HashVerificationResponse>(this.apiUrl, { hash: cleanHash }).subscribe({
      next: (response) => {
        this.loading = false;
        this.result = response.data;
        this.successMessage = response.message || 'Hash verified successfully.';
        this.addRecentVerification(response.data);
      },
      error: (error) => {
        this.loading = false;

        const responseData = error?.error?.data;

        if (error?.status === 404 && responseData) {
          this.result = responseData;
          this.successMessage = '';
          this.errorMessage = error?.error?.message || 'Hash not found.';
          this.addRecentVerification(responseData);
          return;
        }

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to verify hash. Please try again.';
      }
    });
  }

  clearForm(): void {
    this.hashValue = '';
    this.result = null;
    this.errorMessage = '';
    this.successMessage = '';
  }

  get isVerified(): boolean {
    return this.result?.verificationStatus === 'VERIFIED' || this.result?.verified === true;
  }

  get statusLabel(): string {
    if (!this.result) {
      return 'Ready';
    }

    return this.isVerified ? 'Verified' : 'Not Found';
  }

  get statusClass(): string {
    if (!this.result) {
      return 'neutral';
    }

    return this.isVerified ? 'success' : 'warning';
  }

  get createdDateFormatted(): string {
    if (!this.result?.createdDate) {
      return '-';
    }

    return new Date(this.result.createdDate).toLocaleString();
  }

  get relatedProofText(): string {
    if (!this.result?.relatedProof) {
      return '-';
    }

    const proof = this.result.relatedProof;

    if (typeof proof === 'string') {
      return proof;
    }

    return proof.proofId || proof.proofType || JSON.stringify(proof);
  }

  formatValue(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  }

  previewHash(hash: string | null | undefined): string {
    if (!hash) {
      return '-';
    }

    if (hash.length <= 28) {
      return hash;
    }

    return `${hash.slice(0, 18)}...${hash.slice(-10)}`;
  }

  private addRecentVerification(item: HashVerificationResult): void {
    this.recentVerifications = [
      item,
      ...this.recentVerifications
    ].slice(0, 5);
  }
}
