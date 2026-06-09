import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GovernmentTransaction,
  GovernmentTransactionsService,
  GovernmentTransactionStats,
  GovernmentTransactionPagination
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
  selectedTransaction: GovernmentTransaction | null = null;

  stats: GovernmentTransactionStats = {
    totalTransactions: 0,
    approved: 0,
    pending: 0,
    failed: 0
  };

  pagination: GovernmentTransactionPagination = {
    total: 0,
    limit: 50,
    offset: 0
  };

  filters = {
    transactionId: '',
    residentName: '',
    service: '',
    paymentMethod: 'ALL',
    status: 'ALL',
    blockchainStatus: 'ALL',
    dateFrom: '',
    dateTo: ''
  };

  paymentMethods = [
    { value: 'ALL', label: 'All Payment Methods' },
    { value: 'RESIDENT_WALLET', label: 'Resident Wallet' },
    { value: 'DIGITAL_STAMP_WALLET', label: 'Digital Stamp Wallet' },
    { value: 'BANK_CARD', label: 'Bank Card' },
    { value: 'CASH_OFFICE_PAYMENT', label: 'Cash Office Payment' },
    { value: 'GOVERNMENT_PAYMENT_GATEWAY', label: 'Government Payment Gateway' }
  ];

  transactionStatuses = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'PAID', label: 'Paid' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'PENDING_REVIEW', label: 'Pending Review' },
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ];

  blockchainStatuses = [
    { value: 'ALL', label: 'All Blockchain Statuses' },
    { value: 'SYNCED', label: 'Synced' },
    { value: 'COMMITTED', label: 'Committed' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'FAILED', label: 'Failed' }
  ];

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
      transactionId: this.filters.transactionId,
      residentName: this.filters.residentName,
      service: this.filters.service,
      paymentMethod: this.filters.paymentMethod,
      status: this.filters.status,
      blockchainStatus: this.filters.blockchainStatus,
      dateFrom: this.filters.dateFrom,
      dateTo: this.filters.dateTo,
      limit: this.pagination.limit,
      offset: this.pagination.offset
    }).subscribe({
      next: (response) => {
        this.transactions = response.data || [];

        this.stats = response.stats || {
          totalTransactions: 0,
          approved: 0,
          pending: 0,
          failed: 0
        };

        this.pagination = response.pagination || {
          total: 0,
          limit: 50,
          offset: 0
        };

        this.loading = false;
      },
      error: (error) => {
        console.error('[TRANSACTION LIST ERROR]', error);
        this.errorMessage = error?.error?.message || 'Failed to load transactions from PostgreSQL.';
        this.loading = false;
      }
    });
  }

  searchTransactions(): void {
    this.pagination.offset = 0;
    this.loadTransactions();
  }

  resetFilters(): void {
    this.filters = {
      transactionId: '',
      residentName: '',
      service: '',
      paymentMethod: 'ALL',
      status: 'ALL',
      blockchainStatus: 'ALL',
      dateFrom: '',
      dateTo: ''
    };

    this.pagination.offset = 0;
    this.loadTransactions();
  }

  viewDetails(transaction: GovernmentTransaction): void {
    this.selectedTransaction = transaction;
  }

  closeDetails(): void {
    this.selectedTransaction = null;
  }

  getDisplayTransactionId(tx: GovernmentTransaction): string {
    return String(tx.transaction_reference || tx.transaction_id || '-');
  }

  getResidentName(tx: GovernmentTransaction): string {
    return tx.resident_name || tx.resident_full_name || '-';
  }

  getServiceName(tx: GovernmentTransaction): string {
    return tx.service_name || '-';
  }

  getAdministrationName(tx: GovernmentTransaction): string {
    return tx.administration_name || '-';
  }

  getTotalFees(tx: GovernmentTransaction): number {
    return Number(tx.total_fees || tx.total_fee || tx.amount || 0);
  }

  getCurrency(tx: GovernmentTransaction): string {
    return 'GOV';
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
      value === 'DRAFT' ||
      value === 'SUBMITTED' ||
      value === 'PROCESSING' ||
      value === 'PENDING_REVIEW' ||
      value === 'PENDING_APPROVAL'
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

  formatPaymentMethod(method: string | null | undefined): string {
    if (!method) {
      return '-';
    }

    return method
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  formatAmount(amount: number | string | null | undefined): string {
    const numericAmount = Number(amount || 0);
    return numericAmount.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    });
  }

  formatDate(date: string | null | undefined): string {
    if (!date) {
      return '-';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '-';
    }

    return parsedDate.toLocaleString();
  }

  exportTransactions(): void {
    const rows = this.transactions.map(tx => ({
      transactionId: this.getDisplayTransactionId(tx),
      residentName: this.getResidentName(tx),
      serviceName: this.getServiceName(tx),
      administrationName: this.getAdministrationName(tx),
      totalFees: this.getTotalFees(tx),
      currency: 'GOV',
      paymentMethod: tx.payment_method || '-',
      transactionStatus: tx.transaction_status || '-',
      blockchainStatus: tx.blockchain_status || '-',
      createdDate: this.formatDate(tx.created_at)
    }));

    console.table(rows);
  }
}
