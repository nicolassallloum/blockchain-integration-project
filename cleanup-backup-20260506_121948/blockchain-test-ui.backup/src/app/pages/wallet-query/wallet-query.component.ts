import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';

@Component({
  selector: 'app-wallet-query',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wallet-query.component.html',
  styleUrl: './wallet-query.component.css'
})
export class WalletQueryComponent {
  loading = false;
  successMessage = '';
  errorMessage = '';
  responseData: any = null;
  wallet: any = null;

  queryType: 'customerId' | 'walletAddress' = 'customerId';
  searchValue = '';

  constructor(private walletService: WalletService) {}

  searchWallet(): void {
    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.responseData = null;
    this.wallet = null;

    const token = localStorage.getItem('wallet_token') || '';

    const request$ =
      this.queryType === 'customerId'
        ? this.walletService.getWalletByCustomerId(this.searchValue, token)
        : this.walletService.getWalletByAddress(this.searchValue, token);

    request$.subscribe({
      next: (res: any) => {
        this.loading = false;
        this.responseData = res;

        this.wallet =
          res?.data?.wallet ||
          res?.data ||
          res?.wallet ||
          null;

        this.successMessage = res?.message || 'Wallet retrieved successfully';
      },
      error: (err: any) => {
        this.loading = false;
        this.errorMessage =
          err?.error?.message ||
          err?.message ||
          'Failed to retrieve wallet';
        this.responseData = err?.error || err;
      }
    });
  }

  fillCustomerSample(): void {
    this.queryType = 'customerId';
    this.searchValue = 'CUST2017';
  }

  resetSearch(): void {
    this.queryType = 'customerId';
    this.searchValue = '';
    this.successMessage = '';
    this.errorMessage = '';
    this.responseData = null;
    this.wallet = null;
  }
}
