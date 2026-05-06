import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';

@Component({
  selector: 'app-wallet-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wallet-login.component.html',
  styleUrl: './wallet-login.component.css'
})
export class WalletLoginComponent {
  loading = false;
  successMessage = '';
  errorMessage = '';
  responseData: any = null;
  token = '';

  form = {
    customerId: '',
    password: ''
  };

  constructor(private walletService: WalletService) {}

  loginWallet(): void {
    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.responseData = null;
    this.token = '';

    this.walletService.loginWallet(this.form).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.responseData = res;

        const receivedToken = res?.data?.token || res?.token || '';

        if (receivedToken) {
          this.token = receivedToken;
          localStorage.setItem('wallet_token', receivedToken);
        }

        this.successMessage = res?.message || 'Wallet login successful';
      },
      error: (err: any) => {
        this.loading = false;
        this.errorMessage =
          err?.error?.message ||
          err?.message ||
          'Wallet login failed';
        this.responseData = err?.error || err;
      }
    });
  }

  fillSampleData(): void {
    this.form = {
      customerId: 'CUST2017',
      password: 'password123'
    };
  }

  resetForm(): void {
    this.form = {
      customerId: '',
      password: ''
    };

    this.successMessage = '';
    this.errorMessage = '';
    this.responseData = null;
    this.token = '';
  }

  copyToken(): void {
    if (this.token) {
      navigator.clipboard.writeText(this.token);
      this.successMessage = 'Token copied to clipboard';
    }
  }
}