import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

type HistoryTab = 'history' | 'verification';

@Component({
  selector: 'app-blockchain-proof-history-screens',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './blockchain-proof-history-screens.html',
  styleUrls: ['./blockchain-proof-history-screens.css']
})
export class BlockchainProofHistoryScreens implements OnInit {
  activeTab: HistoryTab = 'history';

  recordTypes = [
    'ALL',
    'AML',
    'TRANSACTION',
    'SCREENING_ACTIVITY',
    'CUSTOMER'
  ];

  limits = [10, 25, 50, 100];

  selectedRecordType = 'ALL';
  selectedLimit = 50;

  historyData: any = null;
  verificationData: any = null;

  loading = false;
  loadingHistory = false;
  loadingVerification = false;
  error = '';
  lastLoadedAt: string | null = null;

  ngOnInit(): void {
    this.loadAll();
  }

  get apiBaseUrl(): string {
    if (typeof window === 'undefined') {
      return 'http://localhost:3001/api/v1/blockchain-proof/api';
    }

    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';

    return `${protocol}//${hostname}:3001/api/v1/blockchain-proof/api`;
  }

  get historyRows(): any[] {
    return this.historyData?.rows || [];
  }

  get verificationRows(): any[] {
    return this.verificationData?.rows || [];
  }

  get historyTotalRows(): number {
    return this.historyRows.length;
  }

  get verificationTotalRows(): number {
    return this.verificationRows.length;
  }

  get historyRowsWithTx(): number {
    return this.historyRows.filter((row) => row.hasBlockchainTransaction === true).length;
  }

  get historyRowsWithoutTx(): number {
    return this.historyRows.filter((row) => row.hasBlockchainTransaction !== true).length;
  }

  get verificationRowsWithFakeSuccess(): number {
    return this.verificationRows.filter(
      (row) => row.metadataSummary?.fakeBlockchainSuccess === true
    ).length;
  }

  get recordTypeQuery(): string {
    if (!this.selectedRecordType || this.selectedRecordType === 'ALL') {
      return '';
    }

    return `&recordType=${encodeURIComponent(this.selectedRecordType)}`;
  }

  number(value: any): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  setTab(tab: HistoryTab): void {
    this.activeTab = tab;
  }

  async onFilterChange(): Promise<void> {
    await this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {
      await Promise.all([
        this.loadHistory(false),
        this.loadVerification(false)
      ]);

      this.lastLoadedAt = new Date().toISOString();
    } catch (error: any) {
      this.error = error?.message || 'Unable to load blockchain proof history screens.';
    } finally {
      this.loading = false;
    }
  }

  async loadHistory(showLoading = true): Promise<void> {
    if (showLoading) {
      this.loadingHistory = true;
    }

    try {
      const url =
        `${this.apiBaseUrl}/dashboard/latest-history?limit=${this.selectedLimit}${this.recordTypeQuery}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || `History API failed with HTTP ${response.status}`);
      }

      this.historyData = payload.data;
    } finally {
      this.loadingHistory = false;
    }
  }

  async loadVerification(showLoading = true): Promise<void> {
    if (showLoading) {
      this.loadingVerification = true;
    }

    try {
      const url =
        `${this.apiBaseUrl}/dashboard/latest-verification-logs?limit=${this.selectedLimit}${this.recordTypeQuery}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || `Verification logs API failed with HTTP ${response.status}`);
      }

      this.verificationData = payload.data;
    } finally {
      this.loadingVerification = false;
    }
  }

  shortValue(value: any, length = 22): string {
    if (!value) {
      return 'N/A';
    }

    const text = String(value);

    if (text.length <= length) {
      return text;
    }

    return `${text.slice(0, length)}...`;
  }

  txLabel(row: any): string {
    return row?.hasBlockchainTransaction ? 'LINKED' : 'NO TX';
  }

  fakeSuccessLabel(row: any): string {
    return row?.metadataSummary?.fakeBlockchainSuccess === true ? 'YES' : 'NO';
  }
}
