import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BlockchainProofRecord,
  GovernmentBlockchainProofApiService
} from '../../services/government-blockchain-proof-api.service';

interface BlockchainProofFilterModel {
  entityType: string;
  entityId: string;
  blockchainStatus: string;
  dateFrom: string;
  dateTo: string;
}

@Component({
  selector: 'app-blockchain-proof',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './blockchain-proof.html',
  styleUrl: './blockchain-proof.scss'
})
export class BlockchainProof implements OnInit {
  proofs: BlockchainProofRecord[] = [];
  selectedProof: BlockchainProofRecord | null = null;

  isLoading = false;
  errorMessage = '';

  totalRecords = 0;
  limit = 100;
  offset = 0;

  readonly couchDbDatabase = 'kycchannelnix1_kyc-wallet-chaincode-js';

  filters: BlockchainProofFilterModel = {
    entityType: '',
    entityId: '',
    blockchainStatus: '',
    dateFrom: '',
    dateTo: ''
  };

  entityTypeOptions = [
    { value: '', label: 'All Entity Types' },
    { value: 'MINISTRY_WALLET', label: 'Ministry Wallet' },
    { value: 'RESIDENT_WALLET', label: 'Resident Wallet' },
    { value: 'GOVERNMENT_TRANSACTION', label: 'Government Transaction' },
    { value: 'TRANSACTION_DOCUMENT', label: 'Transaction Document' },
    { value: 'DIGITAL_STAMP', label: 'Digital Stamp' }
  ];

  blockchainStatusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'Blockchain Failed', label: 'Blockchain Failed' },
    { value: 'Active', label: 'Active' },
    { value: 'Redeemed', label: 'Redeemed' },
    { value: 'Issued', label: 'Issued' },
    { value: 'Not Issued', label: 'Not Issued' },
    { value: 'NOT_SUBMITTED', label: 'Not Submitted' }
  ];

  constructor(private readonly proofApi: GovernmentBlockchainProofApiService) {}

  ngOnInit(): void {
    this.loadProofs();
  }

  get totalProofs(): number {
    return this.totalRecords;
  }

  get confirmedProofs(): number {
    return this.proofs.filter((proof) => this.isConfirmedStatus(proof.blockchainStatus)).length;
  }

  get pendingProofs(): number {
    return this.proofs.filter((proof) => this.isPendingStatus(proof.blockchainStatus)).length;
  }

  get failedProofs(): number {
    return this.proofs.filter((proof) => this.isFailedStatus(proof.blockchainStatus)).length;
  }

  loadProofs(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.proofApi
      .getProofs({
        entityType: this.filters.entityType || null,
        entityId: this.filters.entityId || null,
        blockchainStatus: this.filters.blockchainStatus || null,
        dateFrom: this.filters.dateFrom || null,
        dateTo: this.filters.dateTo || null,
        limit: this.limit,
        offset: this.offset
      })
      .subscribe({
        next: (response) => {
          this.proofs = response.data || [];
          this.totalRecords = response.meta?.total || this.proofs.length;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Failed to load blockchain proofs:', error);
          this.errorMessage =
            error?.error?.message ||
            error?.message ||
            'Failed to load blockchain proofs from PostgreSQL.';
          this.proofs = [];
          this.totalRecords = 0;
          this.isLoading = false;
        }
      });
  }

  applyFilters(): void {
    this.offset = 0;
    this.loadProofs();
  }

  resetFilters(): void {
    this.filters = {
      entityType: '',
      entityId: '',
      blockchainStatus: '',
      dateFrom: '',
      dateTo: ''
    };

    this.offset = 0;
    this.loadProofs();
  }

  refreshProofs(): void {
    this.loadProofs();
  }

  viewProof(proof: BlockchainProofRecord): void {
    this.selectedProof = proof;
  }

  closeProofDetails(): void {
    this.selectedProof = null;
  }

  openCouchDbDocument(proof: BlockchainProofRecord): void {
    if (!proof.couchDbDocumentId) {
      return;
    }

    const documentId = encodeURIComponent(proof.couchDbDocumentId);
    const database = encodeURIComponent(this.couchDbDatabase);
    const url = `http://172.31.13.90:3001/api/v1/couchdb/${database}/documents/${documentId}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  copyValue(value: string | null): void {
    if (!value) {
      return;
    }

    navigator.clipboard?.writeText(value).catch(() => {
      console.warn('Clipboard copy failed.');
    });
  }

  hasPreviousPage(): boolean {
    return this.offset > 0;
  }

  hasNextPage(): boolean {
    return this.offset + this.limit < this.totalRecords;
  }

  previousPage(): void {
    if (!this.hasPreviousPage()) {
      return;
    }

    this.offset = Math.max(this.offset - this.limit, 0);
    this.loadProofs();
  }

  nextPage(): void {
    if (!this.hasNextPage()) {
      return;
    }

    this.offset += this.limit;
    this.loadProofs();
  }

  formatDate(value: string | null): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString();
  }

  statusClass(status: string | null): string {
    const normalized = String(status || '').toLowerCase();

    if (this.isConfirmedStatus(normalized)) {
      return 'status-confirmed';
    }

    if (this.isPendingStatus(normalized)) {
      return 'status-pending';
    }

    if (this.isFailedStatus(normalized)) {
      return 'status-failed';
    }

    return 'status-neutral';
  }

  shortValue(value: string | null, visibleChars = 18): string {
    if (!value) {
      return '-';
    }

    if (value.length <= visibleChars * 2) {
      return value;
    }

    return `${value.slice(0, visibleChars)}...${value.slice(-visibleChars)}`;
  }

  private isConfirmedStatus(status: string | null): boolean {
    const normalized = String(status || '').toLowerCase();

    return ['confirmed', 'success', 'active', 'issued', 'redeemed', 'document_hashed'].some((item) =>
      normalized.includes(item)
    );
  }

  private isPendingStatus(status: string | null): boolean {
    const normalized = String(status || '').toLowerCase();

    return ['pending', 'not_submitted', 'not submitted', 'not issued'].some((item) =>
      normalized.includes(item)
    );
  }

  private isFailedStatus(status: string | null): boolean {
    const normalized = String(status || '').toLowerCase();

    return ['failed', 'error', 'invalid', 'rejected'].some((item) => normalized.includes(item));
  }
}
