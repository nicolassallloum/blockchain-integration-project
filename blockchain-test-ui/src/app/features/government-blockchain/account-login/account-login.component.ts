import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  GovernmentAccountAuthService,
  GovernmentAccountInfo,
  GovernmentTransaction
} from '../services/government-account-auth.service';

@Component({
  selector: 'app-account-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, DecimalPipe],
  templateUrl: './account-login.component.html',
  styleUrl: './account-login.component.scss'
})
export class AccountLoginComponent {
  loginForm: FormGroup;

  isLoading = false;
  isTransactionsLoading = false;
  isLoggedIn = false;

  errorMessage = '';
  successMessage = '';
  transactionMessage = '';

  loggedInAccount: GovernmentAccountInfo | null = null;
  transactions: GovernmentTransaction[] = [];

  accountTypes = [
    {
      label: 'Ministry Account',
      value: 'MINISTRY'
    },
    {
      label: 'Public Administration Account',
      value: 'PUBLIC_ADMINISTRATION'
    },
    {
      label: 'Resident Account',
      value: 'RESIDENT'
    }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: GovernmentAccountAuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      accountType: ['MINISTRY', Validators.required],
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  login(): void {
    this.resetMessages();

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'Please enter account type, username, and password.';
      return;
    }

    this.isLoading = true;
    this.isLoggedIn = false;
    this.loggedInAccount = null;
    this.transactions = [];

    const payload = {
      accountType: this.loginForm.value.accountType,
      username: String(this.loginForm.value.username || '').trim(),
      password: String(this.loginForm.value.password || '').trim()
    };

    console.log('[LOGIN PAYLOAD]', payload);

    this.authService.login(payload).subscribe({
      next: response => {
        this.isLoading = false;

        console.log('[ACCOUNT LOGIN RESPONSE]', response);

        if (!response?.success || !response?.data) {
          this.errorMessage =
            response?.message ||
            'Login failed. Invalid response returned from API.';
          return;
        }

        this.loggedInAccount = response.data;
        this.isLoggedIn = true;
        this.successMessage = 'Login successful. Account information loaded.';

        localStorage.setItem(
          'governmentLoggedInAccount',
          JSON.stringify(response.data)
        );

        localStorage.setItem(
          'governmentTransactionSourceAccount',
          JSON.stringify(response.data)
        );

        this.loadTransactions(response.data.accountId);
      },
      error: error => {
        this.isLoading = false;
        this.isLoggedIn = false;
        this.loggedInAccount = null;
        this.transactions = [];

        console.error('[ACCOUNT LOGIN ERROR]', error);

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Login failed. Please check API connection, username, password, and account type.';
      }
    });
  }

  loadTransactions(accountId: string): void {
    if (!accountId) {
      this.transactions = [];
      this.transactionMessage = 'No account ID found to load transactions.';
      return;
    }

    this.isTransactionsLoading = true;
    this.transactionMessage = '';

    this.authService.getAccountTransactions(accountId).subscribe({
      next: response => {
        this.isTransactionsLoading = false;

        console.log('[ACCOUNT TRANSACTIONS RESPONSE]', response);

        /**
         * Supports both backend response formats:
         *
         * Format 1:
         * [
         *   { transactionId: 'TX-1', ... }
         * ]
         *
         * Format 2:
         * {
         *   success: true,
         *   data: [
         *     { transactionId: 'TX-1', ... }
         *   ]
         * }
         */
        const responseAsAny = response as any;

        if (Array.isArray(responseAsAny)) {
          this.transactions = responseAsAny;
        } else if (Array.isArray(responseAsAny?.data)) {
          this.transactions = responseAsAny.data;
        } else {
          this.transactions = [];
        }

        if (this.transactions.length === 0) {
          this.transactionMessage =
            'Login successful. No transactions found for this account yet.';
        }
      },
      error: error => {
        this.isTransactionsLoading = false;

        console.error('[ACCOUNT TRANSACTIONS ERROR]', error);

        this.transactions = [];

        /**
         * Important:
         * Do not set isLoggedIn = false here.
         * Login is already successful.
         * Only the transaction grid API failed.
         */
        this.transactionMessage =
          error?.error?.message ||
          'Login successful. Account information loaded, but transaction history is not available yet.';
      }
    });
  }

  startNewTransaction(): void {
    if (!this.loggedInAccount) {
      this.errorMessage = 'Please login before starting a new transaction.';
      return;
    }

    localStorage.setItem(
      'governmentTransactionSourceAccount',
      JSON.stringify(this.loggedInAccount)
    );

    this.router.navigate(['/government-blockchain/new-transaction']);
  }

  logout(): void {
    this.isLoading = false;
    this.isTransactionsLoading = false;
    this.isLoggedIn = false;

    this.errorMessage = '';
    this.successMessage = '';
    this.transactionMessage = '';

    this.loggedInAccount = null;
    this.transactions = [];

    this.loginForm.reset({
      accountType: 'MINISTRY',
      username: '',
      password: ''
    });

    localStorage.removeItem('governmentLoggedInAccount');
    localStorage.removeItem('governmentTransactionSourceAccount');
  }

  refreshTransactions(): void {
    if (!this.loggedInAccount?.accountId) {
      this.transactionMessage = 'No logged-in account found.';
      return;
    }

    this.loadTransactions(this.loggedInAccount.accountId);
  }

  resetMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.transactionMessage = '';
  }

  getStatusClass(status?: string): string {
    switch ((status || '').toUpperCase()) {
      case 'ACTIVE':
      case 'SUCCESS':
      case 'COMPLETED':
      case 'APPROVED':
        return 'status-success';

      case 'PENDING':
      case 'PROCESSING':
      case 'IN_PROGRESS':
        return 'status-warning';

      case 'FAILED':
      case 'REJECTED':
      case 'BLOCKED':
      case 'INACTIVE':
        return 'status-danger';

      default:
        return 'status-neutral';
    }
  }

  getAccountTypeLabel(accountType?: string): string {
    switch ((accountType || '').toUpperCase()) {
      case 'MINISTRY':
        return 'Ministry Account';

      case 'PUBLIC_ADMINISTRATION':
        return 'Public Administration Account';

      case 'RESIDENT':
        return 'Resident Account';

      default:
        return accountType || '-';
    }
  }
}