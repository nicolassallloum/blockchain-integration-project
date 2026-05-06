import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../../services/transaction.service';
import { WalletSessionService } from '../../../services/wallet-session.service';

@Component({
  selector: 'app-transaction-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transaction-history.component.html',
  styleUrl: './transaction-history.component.css'
})
export class TransactionHistoryComponent implements OnInit {
  session: any = null;
  loading = false;
  errorMessage = '';
  successMessage = '';
  apiResponse: any = null;
  transactions: any[] = [];
  selectedTransaction: any = null;

  filters = {
    walletAddress: '',
    customerId: '',
    organizationId: '',
    transactionType: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    page: 1,
    limit: 10
  };

  pagination = {
    page: 1,
    limit: 10,
    totalRecords: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false
  };

  constructor(
    private transactionService: TransactionService,
    private walletSessionService: WalletSessionService
  ) {}

  ngOnInit(): void {
    this.session = this.walletSessionService.getSession();

    if (this.session?.walletAddress) {
      this.filters.walletAddress = this.session.walletAddress;
    }

    this.loadTransactions();
  }

  loadTransactions(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.apiResponse = null;

    this.transactionService.getTransactions(this.filters).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.apiResponse = response;
        this.transactions = Array.isArray(response?.data) ? response.data : [];

        this.pagination = {
          page: response?.pagination?.page || Number(this.filters.page) || 1,
          limit: response?.pagination?.limit || Number(this.filters.limit) || 10,
          totalRecords: response?.pagination?.totalRecords || 0,
          totalPages: response?.pagination?.totalPages || 0,
          hasNextPage: response?.pagination?.hasNextPage || false,
          hasPreviousPage: response?.pagination?.hasPreviousPage || false
        };

        this.successMessage = 'Transaction history loaded successfully.';
      },
      error: (error: any) => {
        this.loading = false;
        this.apiResponse = error?.error || error;
        this.transactions = [];
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to load transaction history.';
      }
    });
  }

  search(): void {
    this.filters.page = 1;
    this.loadTransactions();
  }

  refresh(): void {
    this.loadTransactions();
  }

  clearFilters(): void {
    this.filters = {
      walletAddress: this.session?.walletAddress || '',
      customerId: '',
      organizationId: '',
      transactionType: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      page: 1,
      limit: 10
    };

    this.selectedTransaction = null;
    this.loadTransactions();
  }

  nextPage(): void {
    if (!this.pagination.hasNextPage) {
      return;
    }

    this.filters.page = Number(this.filters.page) + 1;
    this.loadTransactions();
  }

  previousPage(): void {
    if (!this.pagination.hasPreviousPage || Number(this.filters.page) <= 1) {
      return;
    }

    this.filters.page = Number(this.filters.page) - 1;
    this.loadTransactions();
  }

  viewDetails(transaction: any): void {
    this.selectedTransaction = transaction;
  }

  closeDetails(): void {
    this.selectedTransaction = null;
  }

  getField(row: any, ...keys: string[]): any {
    for (const key of keys) {
      if (row?.[key] !== undefined && row?.[key] !== null) {
        return row[key];
      }
    }

    return '-';
  }
}