import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TransactionService } from '../../../services/transaction.service';
import { WalletSessionService } from '../../../services/wallet-session.service';

@Component({
  selector: 'app-wallet-transfer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './wallet-transfer.component.html',
  styleUrl: './wallet-transfer.component.css'
})
export class WalletTransferComponent implements OnInit {
  session: any = null;
  loading = false;
  successMessage = '';
  errorMessage = '';
  transactionId = '';
  apiResponse: any = null;

  form = {
    senderWalletAddress: '',
    receiverWalletAddress: '',
    amount: '',
    currency: 'USD',
    transactionPurpose: 'Wallet transfer test',
    transactionDescription: 'STEP 32 wallet-to-wallet transfer from Angular UI',
    requestSource: 'ANGULAR_UI',
    sourceSystem: 'BLOCKCHAIN_TEST_UI',
    createdBy: 'nix'
  };

  constructor(
    private transactionService: TransactionService,
    private walletSessionService: WalletSessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSession();
  }

  loadSession(): void {
    this.session = this.walletSessionService.getSession();

    if (this.session) {
      this.form.senderWalletAddress =
        this.session.walletAddress ||
        this.session.wallet_address ||
        '';

      this.form.currency =
        this.session.currencyCode ||
        this.session.currency_code ||
        'USD';
    }
  }

  fillSample(): void {
    this.form.receiverWalletAddress = 'fe43dce35bdf18108fa5b0b9788858df518c36ff';
    this.form.amount = '50';
    this.form.currency =
      this.session?.currencyCode ||
      this.session?.currency_code ||
      'USD';
    this.form.transactionPurpose = 'Wallet transfer test';
    this.form.transactionDescription = 'STEP 32 wallet-to-wallet transfer from Angular UI';
  }

  private getCurrentBalance(): number {
    const rawBalance =
      this.session?.currentBalance ??
      this.session?.current_balance ??
      this.session?.balance ??
      0;

    const balance = Number(rawBalance);

    return Number.isFinite(balance) ? balance : 0;
  }

  private getAmount(): number {
    const amount = Number(this.form.amount);
    return Number.isFinite(amount) ? amount : 0;
  }

  private extractErrorMessage(error: any): string {
    return (
      error?.error?.message ||
      error?.error?.error?.message ||
      error?.message ||
      error?.data?.message ||
      error?.data?.error?.message ||
      'Wallet-to-wallet transfer failed.'
    );
  }

  private extractResponseErrorMessage(response: any): string {
    return (
      response?.message ||
      response?.error?.message ||
      response?.data?.message ||
      response?.data?.error?.message ||
      'Wallet-to-wallet transfer failed.'
    );
  }

  validateForm(): string | null {
    if (!this.walletSessionService.isLoggedIn()) {
      return 'No wallet session found. Please login first.';
    }

    if (!this.walletSessionService.isCustomerWallet()) {
      return 'Customer wallet login is required for wallet-to-wallet transfer.';
    }

    if (!this.form.senderWalletAddress) {
      return 'Sender wallet address is required from the logged-in session.';
    }

    if (!this.form.receiverWalletAddress) {
      return 'Receiver wallet address is required.';
    }

    if (this.form.receiverWalletAddress === this.form.senderWalletAddress) {
      return 'Receiver wallet address cannot be the same as sender wallet address.';
    }

    const amount = this.getAmount();

    if (!this.form.amount || amount <= 0) {
      return 'Amount is required and must be greater than zero.';
    }

    const currentBalance = this.getCurrentBalance();

    if (currentBalance < amount) {
      return `Insufficient wallet balance. Current balance is ${currentBalance}.`;
    }

    if (!this.form.currency) {
      return 'Currency is required.';
    }

    return null;
  }

  submitTransfer(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.transactionId = '';
    this.apiResponse = null;

    this.loadSession();

    const validationError = this.validateForm();

    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    const payload = {
      senderWalletAddress: this.form.senderWalletAddress,
      receiverWalletAddress: this.form.receiverWalletAddress,
      amount: String(this.form.amount),
      currency: this.form.currency,
      transactionPurpose: this.form.transactionPurpose,
      transactionDescription: this.form.transactionDescription,
      requestSource: this.form.requestSource,
      sourceSystem: this.form.sourceSystem,
      createdBy: this.form.createdBy
    };

    this.loading = true;

    this.transactionService.walletTransfer(payload).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.apiResponse = response;

        if (response?.success !== true) {
          this.successMessage = '';
          this.transactionId = '';
          this.errorMessage = this.extractResponseErrorMessage(response);
          return;
        }

        this.transactionId =
          response?.data?.transactionId ||
          response?.data?.transaction_id ||
          response?.transactionId ||
          response?.transaction_id ||
          response?.data?.id ||
          '';

        const senderBalanceAfter =
          response?.data?.senderBalanceAfter ??
          response?.data?.sender_balance_after ??
          response?.senderBalanceAfter ??
          response?.sender_balance_after ??
          null;

        if (senderBalanceAfter !== null && senderBalanceAfter !== undefined) {
          this.walletSessionService.updateBalance(Number(senderBalanceAfter));
          this.session = this.walletSessionService.getSession();

          if (this.session) {
            this.form.senderWalletAddress =
              this.session.walletAddress ||
              this.session.wallet_address ||
              this.form.senderWalletAddress;

            this.form.currency =
              this.session.currencyCode ||
              this.session.currency_code ||
              this.form.currency ||
              'USD';
          }
        }

        this.errorMessage = '';
        this.successMessage =
          response?.message ||
          'Wallet-to-wallet transfer completed successfully.';
      },
      error: (error: any) => {
        this.loading = false;
        this.apiResponse = error?.error || error;
        this.successMessage = '';
        this.transactionId = '';
        this.errorMessage = this.extractErrorMessage(error);
      }
    });
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.transactionId = '';
    this.apiResponse = null;
  }

  logoutWallet(): void {
    this.walletSessionService.clearSession();
    this.session = null;
    this.router.navigateByUrl('/digital-kyc/wallet-login');
  }
}