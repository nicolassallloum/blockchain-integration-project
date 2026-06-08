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
      accountType: ['RESIDENT', Validators.required],
      walletAddress: ['', [Validators.required, Validators.minLength(6)]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  login(): void {
    this.resetMessages();

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'Please select account type, then enter wallet address and password.';
      return;
    }

    this.isLoading = true;
    this.isLoggedIn = false;
    this.loggedInAccount = null;
    this.transactions = [];

    const payload = {
      accountType: this.loginForm.value.accountType,
      walletAddress: String(this.loginForm.value.walletAddress || '').trim(),
      password: String(this.loginForm.value.password || '').trim()
    };

    this.authService.login(payload).subscribe({
      next: response => {
        this.isLoading = false;

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

        if (response.data.accountId) {
          this.loadTransactions(response.data.accountId);
        }
      },
      error: error => {
        this.isLoading = false;
        this.isLoggedIn = false;
        this.loggedInAccount = null;
        this.transactions = [];

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Login failed. Please check wallet address and password.';
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
        this.transactions = [];

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
      accountType: 'RESIDENT',
      walletAddress: '',
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

  getStatusClass(status?: string | null): string {
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
      case 'SUSPENDED':
        return 'status-danger';

      default:
        return 'status-neutral';
    }
  }

  getAccountTypeLabel(accountType?: string): string {
    switch ((accountType || '').toUpperCase()) {
      case 'MINISTRY':
        return 'Ministry';

      case 'PUBLIC_ADMINISTRATION':
        return 'Public Administration';

      case 'RESIDENT':
        return 'Resident';

      default:
        return accountType || '-';
    }
  }
}
