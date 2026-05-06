import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';

@Component({
  selector: 'app-wallet-query',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wallet-query.html',
  styleUrl: './wallet-query.css'
})
export class WalletQuery {
  loading = false;
  errorMessage = '';
  successMessage = '';

  searchType: 'customerId' | 'walletAddress' = 'customerId';
  searchValue = '';

  wallet: any = null;
  responseData: any = null;

  constructor(private walletService: WalletService) {}

  queryWallet(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.wallet = null;
    this.responseData = null;

    const value = this.searchValue.trim();

    if (!value) {
      this.loading = false;
      this.errorMessage = 'Please enter a customer ID or wallet address.';
      return;
    }

    const request =
      this.searchType === 'customerId'
        ? this.walletService.getWalletByCustomerId(value)
        : this.walletService.getWalletByAddress(value);

    request.subscribe({
      next: (res: any) => {
        this.loading = false;
        this.responseData = res;

        this.wallet =
          res?.data?.wallet ||
          res?.wallet ||
          res?.data ||
          null;

        this.successMessage = res?.message || 'Wallet retrieved successfully';
      },
      error: (err: any) => {
        this.loading = false;
        this.responseData = err?.error || err;
        this.errorMessage =
          err?.error?.message ||
          err?.message ||
          'Failed to retrieve wallet';
      }
    });
  }

  fillSampleCustomer(): void {
    this.searchType = 'customerId';
    this.searchValue = '19';
  }

  fillSampleWalletAddress(): void {
    this.searchType = 'walletAddress';
    this.searchValue = 'WALLET_1778070501985_A574CF7592927';
  }

  resetForm(): void {
    this.loading = false;
    this.errorMessage = '';
    this.successMessage = '';
    this.searchType = 'customerId';
    this.searchValue = '';
    this.wallet = null;
    this.responseData = null;
  }

  copyWalletAddress(): void {
    const walletAddress =
      this.wallet?.walletAddress ||
      this.wallet?.wallet_address ||
      '';

    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      this.successMessage = 'Wallet address copied to clipboard';
    }
  }

  getValue(...values: any[]): string {
    for (const value of values) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value);
      }
    }

    return '-';
  }
}