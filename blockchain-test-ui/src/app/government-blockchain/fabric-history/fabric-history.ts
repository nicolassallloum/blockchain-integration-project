import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FabricApiService } from '../../core/services/fabric-api.service';

interface FabricHistoryRecord {
  txId?: string;
  timestamp?: any;
  isDelete?: boolean;
  value?: any;
}

@Component({
  selector: 'app-fabric-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fabric-history.html',
  styleUrls: ['./fabric-history.css']
})
export class FabricHistory {
  fabricKey = '';
  loading = false;
  searched = false;
  errorMessage = '';
  historyRecords: FabricHistoryRecord[] = [];

  exampleKeys = [
    'GOV_TXN_GOV-TXN-000001',
    'GOV_TXN_GOV-TXN-000007',
    'RESIDENT_RES-BLOCKCHAIN-000018',
    'RESIDENT_WALLET_RES-BLOCKCHAIN-000018',
    'MINISTRY_MIN-BLOCKCHAIN-164',
    'PUBLIC_ADMINISTRATION_ADM-BLOCKCHAIN-127',
    'AUTH_AUDIT_b0ec627d4366f410baa3239e6796e9c9799c0956e09dffb112e13b25c7a9be90'
  ];

  constructor(private fabricApiService: FabricApiService) {}

  searchHistory(): void {
    const key = this.fabricKey.trim();

    this.errorMessage = '';
    this.historyRecords = [];
    this.searched = true;

    if (!key) {
      this.errorMessage = 'Please enter a Fabric ledger key.';
      return;
    }

    this.loading = true;

    this.fabricApiService
      .evaluate({
        functionName: 'GetHistoryForKey',
        args: [key]
      })
      .subscribe({
        next: (response) => {
          this.loading = false;

          if (!response?.success) {
            this.errorMessage = response?.message || 'Failed to load Fabric history.';
            return;
          }

          this.historyRecords = Array.isArray(response.data)
            ? response.data
            : [];
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage =
            error?.error?.message ||
            error?.error?.error?.message ||
            'Server error while loading Fabric history.';
        }
      });
  }

  useExampleKey(key: string): void {
    this.fabricKey = key;
    this.searchHistory();
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp) {
      return '-';
    }

    if (typeof timestamp === 'string') {
      return timestamp;
    }

    if (timestamp.seconds) {
      const seconds =
        typeof timestamp.seconds === 'object'
          ? Number(timestamp.seconds.low || 0)
          : Number(timestamp.seconds);

      const nanos = Number(timestamp.nanos || 0);
      return new Date(seconds * 1000 + Math.floor(nanos / 1000000)).toLocaleString();
    }

    return JSON.stringify(timestamp);
  }

  formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value, null, 2);
  }

  copyValue(value: any): void {
    const text = this.formatValue(value);

    if (!text) {
      return;
    }

    navigator.clipboard?.writeText(text);
  }
}
