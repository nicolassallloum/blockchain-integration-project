import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../../services/wallet.service';
import { WalletSessionService } from '../../../services/wallet-session.service';

@Component({
  selector: 'app-balance-query',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './balance-query.component.html',
  styleUrl: './balance-query.component.css'
})
export class BalanceQueryComponent implements OnInit {
  session: any = null;
  loading = false;
  successMessage = '';
  errorMessage = '';
  apiResponse: any = null;
  wallet: any = null;

  filters = {
    customerId: '',
    walletAddress: ''
  };

  constructor(
    private walletService: WalletService,
    private walletSessionService: WalletSessionService
  ) {}

  ngOnInit(): void {
    this.session = this.walletSessionService.getSession();

    if (this.session?.walletAddress) {
      this.filters.customerId = this.session.customerId || '';
      this.filters.walletAddress = this.session.walletAddress || '';
      this.queryByWalletAddress();
    } else if (this.session?.customerId) {
      this.filters.customerId = this.session.customerId;
      this.queryByCustomerId();
    }
  }

  refreshBalance(): void {
    if (this.session?.walletAddress) {
      this.queryByWalletAddress();
      return;
    }

    if (this.session?.customerId) {
      this.queryByCustomerId();
      return;
    }

    this.errorMessage = 'No wallet session found. Please search manually by Customer ID or Wallet Address.';
  }

  searchManual(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.apiResponse = null;
    this.wallet = null;

    if (this.filters.walletAddress) {
      this.queryByWalletAddress();
      return;
    }

    if (this.filters.customerId) {
      this.queryByCustomerId();
      return;
    }

    this.errorMessage = 'Please enter Customer ID or Wallet Address.';
  }

  queryByCustomerId(): void {
    if (!this.filters.customerId) {
      this.errorMessage = 'Customer ID is required.';
      return;
    }

    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.walletService.getWalletByCustomerId(this.filters.customerId).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.apiResponse = response;
        this.wallet = this.extractWallet(response);
        this.successMessage = 'Wallet balance retrieved successfully.';
      },
      error: (error: any) => {
        this.loading = false;
        this.apiResponse = error?.error || error;
        this.wallet = null;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to retrieve wallet by Customer ID.';
      }
    });
  }

  queryByWalletAddress(): void {
    if (!this.filters.walletAddress) {
      this.errorMessage = 'Wallet Address is required.';
      return;
    }

    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.walletService.getWalletByAddress(this.filters.walletAddress).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.apiResponse = response;
        this.wallet = this.extractWallet(response);
        this.successMessage = 'Wallet balance retrieved successfully.';
      },
      error: (error: any) => {
        this.loading = false;
        this.apiResponse = error?.error || error;
        this.wallet = null;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to retrieve wallet by Wallet Address.';
      }
    });
  }

  extractWallet(response: any): any {
    return (
      response?.data?.wallet ||
      response?.data ||
      response?.wallet ||
      null
    );
  }

  clear(): void {
    this.filters.customerId = '';
    this.filters.walletAddress = '';
    this.wallet = null;
    this.apiResponse = null;
    this.successMessage = '';
    this.errorMessage = '';
  }
}