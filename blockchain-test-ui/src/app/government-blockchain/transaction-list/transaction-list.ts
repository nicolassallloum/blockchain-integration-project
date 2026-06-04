import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GovernmentTransaction,
  GovernmentTransactionsService,
  GovernmentTransactionStats
} from '../../services/government-transactions.service';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.scss'
})
export class TransactionList implements OnInit {
  transactions: GovernmentTransaction[] = [];

  stats: GovernmentTransactionStats = {
    totalTransactions: 0,
    approved: 0,
    pending: 0,
    failed: 0
  };

  searchText = '';
  selectedStatus = 'ALL';
  selectedBlockchainStatus = 'ALL';

  loading = false;
  errorMessage = '';

  constructor(
    private transactionService: GovernmentTransactionsService
  ) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.loading = true;
    this.errorMessage = '';

    this.transactionService.getTransactions({
      search: this.searchText,
      status: this.selectedStatus,
      blockchainStatus: this.selectedBlockchainStatus,
      limit: 50,
      offset: 0
    }).subscribe({
      next: (response) => {
        this.transactions = response.data || [];

        this.stats = response.stats || {
          totalTransactions: 0,
          approved: 0,
          pending: 0,
          failed: 0
        };

        this.loading = false;
      },
      error: (error) => {
        console.error('[TRANSACTION LIST ERROR]', error);
        this.errorMessage = 'Failed to load transactions from PostgreSQL.';
        this.loading = false;
      }
    });
  }

  searchTransactions(): void {
    this.loadTransactions();
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedStatus = 'ALL';
    this.selectedBlockchainStatus = 'ALL';
    this.loadTransactions();
  }

  getStatusClass(status: string | null | undefined): string {
    const value = (status || '').toUpperCase();

    if (
      value === 'APPROVED' ||
      value === 'COMPLETED' ||
      value === 'SUCCESS' ||
      value === 'PAID'
    ) {
      return 'status-approved';
    }

    if (
      value === 'PENDING' ||
      value === 'WAITING_APPROVAL' ||
      value === 'WAITING' ||
      value === 'DRAFT'
    ) {
      return 'status-pending';
    }

    if (
      value === 'REJECTED' ||
      value === 'FAILED' ||
      value === 'CANCELLED'
    ) {
      return 'status-rejected';
    }

    return 'status-default';
  }

  getBlockchainStatusClass(status: string | null | undefined): string {
    const value = (status || '').toUpperCase();

    if (
      value === 'SYNCED' ||
      value === 'COMMITTED' ||
      value === 'SUCCESS'
    ) {
      return 'blockchain-synced';
    }

    if (
      value === 'PENDING' ||
      value === 'SUBMITTED' ||
      value === 'PROCESSING'
    ) {
      return 'blockchain-pending';
    }

    if (value === 'FAILED' || value === 'ERROR') {
      return 'blockchain-failed';
    }

    return 'blockchain-default';
  }

  formatAmount(amount: number | string | null | undefined, currency: string | null | undefined): string {
    const numericAmount = Number(amount || 0).toLocaleString();
    return `${numericAmount} ${currency || 'LBP'}`;
  }

  formatDate(date: string | null | undefined): string {
    if (!date) {
      return '-';
    }

    return new Date(date).toISOString().slice(0, 10);
  }

  exportTransactions(): void {
    const rows = this.transactions.map(tx => ({
      reference: tx.transaction_reference,
      resident: tx.resident_full_name || tx.resident_name || '-',
      service: tx.service_name || '-',
      amount: tx.total_fee || tx.amount || 0,
      currency: tx.currency_code || tx.currency || 'LBP',
      status: tx.transaction_status || '-',
      blockchainStatus: tx.blockchain_status || '-',
      date: this.formatDate(tx.created_at)
    }));

    console.log('Export transactions:', rows);
  }
}
