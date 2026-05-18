import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { WalletSessionService } from '../../services/wallet-session.service';

@Component({
  selector: 'app-wallet-information',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './wallet-information.component.html',
  styleUrl: './wallet-information.component.css'
})
export class WalletInformationComponent implements OnInit {
  session: any = null;
  errorMessage = '';
  successMessage = '';

  constructor(
    private walletSessionService: WalletSessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSession();

    window.addEventListener('wallet-session-changed', () => {
      this.loadSession();
    });
  }

  loadSession(): void {
    this.session = this.walletSessionService.getSession();

    if (!this.session) {
      this.errorMessage = 'No wallet session found. Please login first.';
      return;
    }

    this.errorMessage = '';
  }

  goToWalletTransfer(): void {
    this.router.navigateByUrl('/digital-kyc/wallet-transfer');
  }

  goToOrganizationTransfer(): void {
    this.router.navigateByUrl('/digital-kyc/organization-transfer');
  }

  goToTransactionHistory(): void {
    this.router.navigateByUrl('/digital-kyc/transaction-history');
  }

  logoutWallet(): void {
    this.walletSessionService.clearSession();
    this.session = null;
    this.successMessage = 'Wallet session cleared successfully.';
    this.router.navigateByUrl('/digital-kyc/wallet-login');
  }

  copyWalletAddress(): void {
    if (!this.session?.walletAddress) {
      this.errorMessage = 'No wallet address available to copy.';
      return;
    }

    navigator.clipboard
      .writeText(this.session.walletAddress)
      .then(() => {
        this.successMessage = 'Wallet address copied successfully.';
        this.errorMessage = '';
      })
      .catch(() => {
        this.errorMessage = 'Failed to copy wallet address.';
      });
  }

  maskToken(token: string): string {
    if (!token) {
      return '-';
    }

    if (token.length <= 18) {
      return token;
    }

    return `${token.slice(0, 10)}...${token.slice(-8)}`;
  }
}