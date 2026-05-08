import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TransactionService } from '../../../services/transaction.service';

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
    transactionPurpose: 'Organization-to-organization transfer',
    transactionDescription: 'Organization wallet transfers to another organization wallet',
    requestSource: 'ANGULAR_UI',
    sourceSystem: 'BLOCKCHAIN_TEST_UI',
    createdBy: 'nix'
  };

  constructor(private transactionService: TransactionService) {}

  ngOnInit(): void {
    this.loadSession();
  }

  loadSession(): void {
    this.session = this.getLoggedInWallet();

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

    this.form.receiverWalletAddress = 'ORG_WALLET_1778160269059_6971AFBA84D6';
    this.form.amount = '10';

    this.form.currency =
      this.session?.currencyCode ||
      this.session?.currency_code ||
      this.session?.currency ||
      'USD';

    this.form.transactionPurpose = 'Organization-to-organization transfer';
    this.form.transactionDescription =
      'Organization wallet transfers to another organization wallet';

    this.clearMessages();
  }

  validateForm(): string | null {
    this.loadSession();

    if (!this.session) {
      return 'No wallet session found. Please login first using an organization wallet.';
    }

    if (!this.isOrganizationWallet(this.session)) {
      return 'Organization wallet login is required for organization-to-organization transfer.';
    }

    if (!this.form.senderWalletAddress) {
      return 'Sender organization wallet address is required from the logged-in session.';
    }

    if (!this.form.receiverWalletAddress) {
      return 'Receiver organization wallet address is required.';
    }

    if (this.form.senderWalletAddress === this.form.receiverWalletAddress) {
      return 'Receiver organization wallet address cannot be the same as sender organization wallet address.';
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

      console.warn('[ORG_TRANSFER_FRONTEND_VALIDATION_FAILED]', {
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
            'Organization-to-organization transfer failed.';
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
          this.updateLocalSessionBalance(Number(senderBalanceAfter));
          this.loadSession();
        }

        this.successMessage =
          response?.message ||
          'Organization-to-organization transfer completed successfully.';
      },
      error: (error: any) => {
        this.loading = false;
        this.apiResponse = error?.error || error;

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Organization-to-organization transfer failed.';
      }
    });
  }

  clearForm(): void {
    this.form.receiverWalletAddress = '';
    this.form.amount = '';
    this.form.transactionPurpose = 'Organization-to-organization transfer';
    this.form.transactionDescription =
      'Organization wallet transfers to another organization wallet';

    this.clearMessages();
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.transactionId = '';
    this.apiResponse = null;
  }

  private getLoggedInWallet(): any | null {
    const possibleKeys = [
      'digital_kyc_wallet_session',
      'digital_kyc_wallet_profile',
      'digitalKycWalletSession',
      'digitalKycWalletProfile',
      'walletSession',
      'walletProfile',
      'loggedInWallet',
      'currentWallet'
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

    return {
      ...wallet,

      walletAddress:
        wallet?.walletAddress ||
        wallet?.wallet_address ||
        parsed?.walletAddress ||
        parsed?.wallet_address ||
        '',

      customerId:
        wallet?.customerId ||
        wallet?.customer_id ||
        parsed?.customerId ||
        parsed?.customer_id ||
        '',

      walletType:
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
        parsed?.fullName ||
        parsed?.full_name ||
        '',

      organizationId:
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

      currencyCode:
        wallet?.currencyCode ||
        wallet?.currency_code ||
        wallet?.currency ||
        parsed?.currencyCode ||
        parsed?.currency_code ||
        parsed?.currency ||
        'USD',

      currentBalance:
        wallet?.currentBalance ??
        wallet?.current_balance ??
        parsed?.currentBalance ??
        parsed?.current_balance ??
        0
    };
  }

  private isOrganizationWallet(wallet: any): boolean {
    return this.getWalletType(wallet) === 'ORGANIZATION';
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

    return walletType;
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
      'digital_kyc_wallet_session',
      'digital_kyc_wallet_profile',
      'digitalKycWalletSession',
      'digitalKycWalletProfile',
      'walletSession',
      'walletProfile',
      'loggedInWallet',
      'currentWallet'
    ];

    for (const key of possibleKeys) {
      const rawValue = localStorage.getItem(key);

      if (!rawValue) {
        continue;
      }

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

        localStorage.setItem(key, JSON.stringify(parsed));
      } catch {
        continue;
      }
    }
  }
}
