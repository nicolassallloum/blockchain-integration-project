import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { TransactionService } from '../../../services/transaction.service';
import { WalletSessionService } from '../../../services/wallet-session.service';

@Component({
  selector: 'app-organization-transfer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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

  form = {
    senderWalletAddress: '',
    receiverWalletAddress: '',
    amount: '',
    currency: 'USD',
    transactionPurpose: 'Inter-organization customer transfer',
    transactionDescription: 'Customer wallet transfer to another customer wallet in a different organization',
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
    this.session =
      this.walletSessionService.getSession() ||
      this.getLoggedInWallet();

    if (!this.session) {
      return;
    }

    this.form.senderWalletAddress =
      this.session.walletAddress ||
      this.session.wallet_address ||
      '';

    this.form.currency =
      this.session.currencyCode ||
      this.session.currency_code ||
      this.session.currency ||
      'USD';
  }

  fillSample(): void {
    this.loadSession();

    this.form.receiverWalletAddress = 'WALLET_RECEIVER_FROM_OTHER_ORG';
    this.form.amount = '100';

    this.form.currency =
      this.session?.currencyCode ||
      this.session?.currency_code ||
      this.session?.currency ||
      'USD';

    this.form.transactionPurpose = 'Inter-organization customer transfer';
    this.form.transactionDescription =
      'Customer wallet transfer to another customer wallet in a different organization';

    this.clearMessages();
  }

  validateForm(): string | null {
    this.loadSession();

    if (!this.session) {
      return 'No wallet session found. Please login first.';
    }

    /*
     * IMPORTANT BUSINESS RULE:
     * This screen is Inter-Organization Customer Transfer.
     * The logged-in sender can be a CUSTOMER wallet.
     * Do not block the screen by requiring ORGANIZATION wallet type.
     */

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
    this.clearMessages();

    const validationError = this.validateForm();

    if (validationError) {
      this.errorMessage = validationError;

      console.warn('[INTER_ORG_TRANSFER_FRONTEND_VALIDATION_FAILED]', {
        validationError,
        session: this.session,
        detectedWalletType: this.getWalletType(this.session),
        senderWalletAddress: this.form.senderWalletAddress,
        receiverWalletAddress: this.form.receiverWalletAddress
      });

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

        if (response?.success === false) {
          this.errorMessage =
            response?.message ||
            'Inter-organization customer transfer failed.';
          return;
        }

        this.transactionId =
          response?.data?.transactionId ||
          response?.transactionId ||
          response?.data?.id ||
          '';

        const senderBalanceAfter =
          response?.data?.senderBalanceAfter ??
          response?.senderBalanceAfter ??
          null;

        if (senderBalanceAfter !== null && senderBalanceAfter !== undefined) {
          this.walletSessionService.updateBalance(Number(senderBalanceAfter));
          this.updateLocalSessionBalance(Number(senderBalanceAfter));
          this.loadSession();
        }

        this.successMessage =
          response?.message ||
          'Inter-organization customer transfer completed successfully.';
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

  clearForm(): void {
    this.form.receiverWalletAddress = '';
    this.form.amount = '';
    this.form.transactionPurpose = 'Inter-organization customer transfer';
    this.form.transactionDescription =
      'Customer wallet transfer to another customer wallet in a different organization';

    this.clearMessages();
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

    this.form.senderWalletAddress = '';
    this.form.receiverWalletAddress = '';
    this.form.amount = '';
    this.form.currency = 'USD';

    this.clearMessages();

    this.router.navigateByUrl('/digital-kyc/wallet-login');
  }

  goToWalletInformation(): void {
    this.router.navigateByUrl('/digital-kyc/wallet-information');
  }

  private getLoggedInWallet(): any | null {
    const possibleKeys = [
      'blockchain_logged_wallet',
      'digital_kyc_wallet_session',
      'digital_kyc_wallet_profile',
      'digitalKycWalletSession',
      'digitalKycWalletProfile',
      'walletSession',
      'walletProfile',
      'loggedInWallet',
      'currentWallet',
      'loggedWallet',
      'wallet_session',
      'wallet_profile'
    ];

    for (const key of possibleKeys) {
      const rawValue =
        localStorage.getItem(key) ||
        sessionStorage.getItem(key);

      if (!rawValue) {
        continue;
      }

      try {
        const parsed = JSON.parse(rawValue);
        const wallet = this.extractWalletFromSession(parsed);

        if (wallet?.walletAddress || wallet?.wallet_address) {
          this.walletSessionService.setSession(wallet);
          return wallet;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private extractWalletFromSession(parsed: any): any {
    const wallet =
      parsed?.data?.wallet ||
      parsed?.data?.profile ||
      parsed?.data?.walletProfile ||
      parsed?.wallet ||
      parsed?.profile ||
      parsed?.walletProfile ||
      parsed?.data ||
      parsed;

    const walletAddress =
      wallet?.walletAddress ||
      wallet?.wallet_address ||
      parsed?.walletAddress ||
      parsed?.wallet_address ||
      '';

    const customerId =
      wallet?.customerId ||
      wallet?.customer_id ||
      parsed?.customerId ||
      parsed?.customer_id ||
      '';

    const currencyCode =
      wallet?.currencyCode ||
      wallet?.currency_code ||
      wallet?.currency ||
      parsed?.currencyCode ||
      parsed?.currency_code ||
      parsed?.currency ||
      'USD';

    const currentBalance =
      wallet?.currentBalance ??
      wallet?.current_balance ??
      wallet?.balance ??
      parsed?.currentBalance ??
      parsed?.current_balance ??
      parsed?.balance ??
      0;

    return {
      ...wallet,

      walletAddress,
      wallet_address: walletAddress,

      customerId,
      customer_id: customerId,

      walletType:
        wallet?.walletType ||
        wallet?.wallet_type ||
        wallet?.type ||
        parsed?.walletType ||
        parsed?.wallet_type ||
        parsed?.type ||
        this.inferWalletType(wallet || parsed),

      wallet_type:
        wallet?.walletType ||
        wallet?.wallet_type ||
        wallet?.type ||
        parsed?.walletType ||
        parsed?.wallet_type ||
        parsed?.type ||
        this.inferWalletType(wallet || parsed),

      fullName:
        wallet?.fullName ||
        wallet?.full_name ||
        wallet?.customerName ||
        wallet?.customer_name ||
        parsed?.fullName ||
        parsed?.full_name ||
        parsed?.customerName ||
        parsed?.customer_name ||
        '',

      full_name:
        wallet?.fullName ||
        wallet?.full_name ||
        wallet?.customerName ||
        wallet?.customer_name ||
        parsed?.fullName ||
        parsed?.full_name ||
        parsed?.customerName ||
        parsed?.customer_name ||
        '',

      organizationId:
        wallet?.organizationId ||
        wallet?.organization_id ||
        parsed?.organizationId ||
        parsed?.organization_id ||
        '',

      organization_id:
        wallet?.organizationId ||
        wallet?.organization_id ||
        parsed?.organizationId ||
        parsed?.organization_id ||
        '',

      organizationName:
        wallet?.organizationName ||
        wallet?.organization_name ||
        parsed?.organizationName ||
        parsed?.organization_name ||
        '',

      organization_name:
        wallet?.organizationName ||
        wallet?.organization_name ||
        parsed?.organizationName ||
        parsed?.organization_name ||
        '',

      currencyCode,
      currency_code: currencyCode,
      currency: currencyCode,

      currentBalance,
      current_balance: currentBalance,

      token:
        wallet?.token ||
        parsed?.token ||
        parsed?.data?.token ||
        localStorage.getItem('digital_kyc_wallet_token') ||
        sessionStorage.getItem('digital_kyc_wallet_token') ||
        ''
    };
  }

  private isOrganizationWallet(wallet: any): boolean {
    return this.getWalletType(wallet) === 'ORGANIZATION';
  }

  private isCustomerWallet(wallet: any): boolean {
    return this.getWalletType(wallet) === 'CUSTOMER';
  }

  private getWalletType(wallet: any): string {
    const walletType = String(
      wallet?.walletType ||
      wallet?.wallet_type ||
      wallet?.type ||
      this.inferWalletType(wallet)
    )
      .trim()
      .toUpperCase();

    if (walletType === 'ORG') {
      return 'ORGANIZATION';
    }

    if (walletType === 'CUSTOMER_WALLET') {
      return 'CUSTOMER';
    }

    if (walletType === 'ORGANIZATION_WALLET') {
      return 'ORGANIZATION';
    }

    return walletType || 'CUSTOMER';
  }

  private inferWalletType(wallet: any): string {
    const walletAddress = String(
      wallet?.walletAddress ||
      wallet?.wallet_address ||
      ''
    ).toUpperCase();

    const customerId = String(
      wallet?.customerId ||
      wallet?.customer_id ||
      ''
    ).toUpperCase();

    if (
      walletAddress.startsWith('ORG_WALLET_') ||
      customerId.startsWith('ORG_')
    ) {
      return 'ORGANIZATION';
    }

    return 'CUSTOMER';
  }

  private updateLocalSessionBalance(newBalance: number): void {
    const possibleKeys = [
      'blockchain_logged_wallet',
      'digital_kyc_wallet_session',
      'digital_kyc_wallet_profile',
      'digitalKycWalletSession',
      'digitalKycWalletProfile',
      'walletSession',
      'walletProfile',
      'loggedInWallet',
      'currentWallet',
      'loggedWallet',
      'wallet_session',
      'wallet_profile'
    ];

    for (const key of possibleKeys) {
      const localRawValue = localStorage.getItem(key);
      const sessionRawValue = sessionStorage.getItem(key);

      if (localRawValue) {
        this.updateStorageBalance(localStorage, key, localRawValue, newBalance);
      }

      if (sessionRawValue) {
        this.updateStorageBalance(sessionStorage, key, sessionRawValue, newBalance);
      }
    }
  }

  private updateStorageBalance(
    storage: Storage,
    key: string,
    rawValue: string,
    newBalance: number
  ): void {
    try {
      const parsed = JSON.parse(rawValue);

      if (parsed?.data?.wallet) {
        parsed.data.wallet.currentBalance = newBalance;
        parsed.data.wallet.current_balance = newBalance;
      } else if (parsed?.wallet) {
        parsed.wallet.currentBalance = newBalance;
        parsed.wallet.current_balance = newBalance;
      } else if (parsed?.data) {
        parsed.data.currentBalance = newBalance;
        parsed.data.current_balance = newBalance;
      } else {
        parsed.currentBalance = newBalance;
        parsed.current_balance = newBalance;
      }

      storage.setItem(key, JSON.stringify(parsed));
    } catch {
      return;
    }
  }
}