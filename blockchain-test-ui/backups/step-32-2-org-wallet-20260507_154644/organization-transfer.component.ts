import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TransactionService } from '../../../services/transaction.service';
import { WalletSessionService } from '../../../services/wallet-session.service';

@Component({
  selector: 'app-organization-transfer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './organization-transfer.component.html',
  styleUrl: './organization-transfer.component.css'
})
export class OrganizationTransferComponent implements OnInit {
  session: any = null;

  loading = false;
  successMessage = '';
  errorMessage = '';
  transactionId = '';
  apiResponse: any = null;

  /**
   * Organization Transfer business meaning:
   * Customer wallet from Organization A transfers to customer wallet from Organization B.
   */
  form = {
    senderWalletAddress: '',
    receiverWalletAddress: '',
    amount: '',
    currency: 'USD',
    transactionPurpose: 'Inter-organization customer transfer',
    transactionDescription: 'Customer from organization A transfers to customer from organization B',
    requestSource: 'ANGULAR_UI',
    sourceSystem: 'BLOCKCHAIN_TEST_UI',
    createdBy: 'nix'
  };

  constructor(
    private transactionService: TransactionService,
    private walletSessionService: WalletSessionService
  ) {}

  ngOnInit(): void {
    this.loadSession();
  }

  loadSession(): void {
    this.session = this.walletSessionService.getSession();

    if (this.session) {
      this.form.senderWalletAddress = this.session.walletAddress || '';
      this.form.currency = this.session.currencyCode || 'USD';
    }
  }

  fillSample(): void {
    this.form.receiverWalletAddress = 'WALLET_1778067488069_3704C026E691';
    this.form.amount = '50';
    this.form.currency = this.session?.currencyCode || 'USD';
    this.form.transactionPurpose = 'Inter-organization customer transfer';
    this.form.transactionDescription =
      'Customer from organization A transfers to customer from organization B';
  }

  validateForm(): string | null {
    if (!this.walletSessionService.isLoggedIn()) {
      return 'No wallet session found. Please login first.';
    }

    if (!this.form.senderWalletAddress) {
      return 'Sender wallet address is required from the logged-in session.';
    }

    if (!this.form.receiverWalletAddress) {
      return 'Receiver customer wallet address is required.';
    }

    if (this.form.senderWalletAddress === this.form.receiverWalletAddress) {
      return 'Receiver wallet address cannot be the same as sender wallet address.';
    }

    const transferAmount = Number(this.form.amount);

    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
      return 'Amount is required and must be greater than zero.';
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

    this.transactionService.organizationTransfer(payload).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.apiResponse = response;

        this.transactionId =
          response?.data?.transactionId ||
          response?.transactionId ||
          response?.data?.id ||
          '';

        this.successMessage = 'Inter-organization customer transfer completed successfully.';
      },
      error: (error: any) => {
        this.loading = false;
        this.apiResponse = error?.error || error;

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Inter-organization customer transfer failed.';
      }
    });
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.transactionId = '';
    this.apiResponse = null;
  }
}