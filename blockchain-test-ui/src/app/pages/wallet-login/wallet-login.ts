import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { WalletService } from '../../services/wallet.service';
import { WalletSessionService } from '../../services/wallet-session.service';

@Component({
  selector: 'app-wallet-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wallet-login.html',
  styleUrl: './wallet-login.css'
})
export class WalletLogin implements OnInit {
  loading = false;
  successMessage = '';
  errorMessage = '';

  responseData: any = null;
  apiResponse: any = null;
  token = '';

  redirectTo = '/digital-kyc/wallet-information';

  form = {
    walletAddress: '',
    password: ''
  };

  walletSummary = {
    status: '-',
    walletAddress: '-',
    customerId: '-',
    customerName: '-',
    organizationId: '-',
    organizationName: '-',
    countryId: '-',
    countryName: '-',
    emailAddress: '-',
    mobilePhone: '-',
    balance: '-',
    currency: 'USD',
    creationDateTime: '-'
  };

  constructor(
    private walletService: WalletService,
    private walletSessionService: WalletSessionService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.redirectTo =
      this.route.snapshot.queryParamMap.get('redirectTo') ||
      '/digital-kyc/wallet-information';
  }

  fillSampleData(): void {
    this.form = {
      walletAddress: 'WALLET_177814333918_F039E75D04FE3',
      password: ''
    };

    this.successMessage = '';
    this.errorMessage = '';
    this.responseData = null;
    this.apiResponse = null;
    this.token = '';
  }

  fillSample(): void {
    this.fillSampleData();
  }

  resetForm(): void {
    this.form = {
      walletAddress: '',
      password: ''
    };

    this.successMessage = '';
    this.errorMessage = '';
    this.responseData = null;
    this.apiResponse = null;
    this.token = '';

    this.walletSummary = {
      status: '-',
      walletAddress: '-',
      customerId: '-',
      customerName: '-',
      organizationId: '-',
      organizationName: '-',
      countryId: '-',
      countryName: '-',
      emailAddress: '-',
      mobilePhone: '-',
      balance: '-',
      currency: 'USD',
      creationDateTime: '-'
    };
  }

  loginWallet(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.responseData = null;
    this.apiResponse = null;
    this.token = '';

    if (!this.form.walletAddress) {
      this.errorMessage = 'Wallet Address is required.';
      return;
    }

    if (!this.form.password) {
      this.errorMessage = 'Password is required.';
      return;
    }

    this.loading = true;

    const payload = {
      walletAddress: String(this.form.walletAddress).trim(),
      password: String(this.form.password)
    };

    this.walletService.loginWallet(payload).subscribe({
      next: (response: any) => {
        this.loading = false;

        this.responseData = response;
        this.apiResponse = response;

        const wallet =
          response?.data?.wallet ||
          response?.wallet ||
          response?.data ||
          {};

        this.token =
          response?.data?.token ||
          response?.token ||
          '';

        this.walletSummary = {
          status:
            wallet?.status ||
            wallet?.walletStatus ||
            wallet?.wallet_status ||
            '-',

          walletAddress:
            wallet?.walletAddress ||
            wallet?.wallet_address ||
            '-',

          customerId:
            wallet?.customerId ||
            wallet?.customer_id ||
            '-',

          customerName:
            wallet?.customerName ||
            wallet?.customer_name ||
            wallet?.fullName ||
            wallet?.full_name ||
            '-',

          organizationId:
            wallet?.organizationId ||
            wallet?.organization_id ||
            '-',

          organizationName:
            wallet?.organizationName ||
            wallet?.organization_name ||
            '-',

          countryId:
            wallet?.countryId ||
            wallet?.country_id ||
            '-',

          countryName:
            wallet?.countryName ||
            wallet?.country_name ||
            '-',

          emailAddress:
            wallet?.emailAddress ||
            wallet?.email_address ||
            wallet?.emailHash ||
            wallet?.email_hash ||
            '-',

          mobilePhone:
            wallet?.mobilePhone ||
            wallet?.mobile_phone ||
            wallet?.mobileHash ||
            wallet?.mobile_hash ||
            '-',

          balance:
            wallet?.currentBalance ??
            wallet?.current_balance ??
            wallet?.balance ??
            '-',

          currency:
            wallet?.currencyCode ||
            wallet?.currency_code ||
            wallet?.currency ||
            'USD',

          creationDateTime:
            wallet?.createdAt ||
            wallet?.created_at ||
            wallet?.creationDateTime ||
            wallet?.creation_date_time ||
            '-'
        };

        const normalizedSession = {
          customerId: this.walletSummary.customerId,
          walletAddress: this.walletSummary.walletAddress,
          organizationId: this.walletSummary.organizationId,
          organizationName: this.walletSummary.organizationName,
          fullName: this.walletSummary.customerName,
          currentBalance: Number(this.walletSummary.balance || 0),
          currencyCode: this.walletSummary.currency,
          token: this.token
        };

        this.walletSessionService.setSession(normalizedSession);
        this.walletService.saveWalletToken(this.token);
        this.walletService.saveWalletProfile({
          token: this.token,
          wallet
        });

        this.successMessage = 'Wallet login successful. Opening wallet information...';

        setTimeout(() => {
          this.router.navigateByUrl(this.redirectTo);
        }, 300);
      },
      error: (error: any) => {
        this.loading = false;

        this.responseData = error?.error || error;
        this.apiResponse = error?.error || error;

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Wallet login failed. Please check the wallet address and password.';
      }
    });
  }

  copyWalletAddress(): void {
    const walletAddress = this.walletSummary?.walletAddress;

    if (!walletAddress || walletAddress === '-') {
      this.errorMessage = 'No wallet address available to copy.';
      return;
    }

    navigator.clipboard
      .writeText(walletAddress)
      .then(() => {
        this.successMessage = 'Wallet address copied successfully.';
      })
      .catch(() => {
        this.errorMessage = 'Failed to copy wallet address.';
      });
  }

  copyToken(): void {
    if (!this.token) {
      this.errorMessage = 'No token available to copy.';
      return;
    }

    navigator.clipboard
      .writeText(this.token)
      .then(() => {
        this.successMessage = 'Token copied successfully.';
      })
      .catch(() => {
        this.errorMessage = 'Failed to copy token.';
      });
  }
  private normalizeWalletSession(rawWallet: any): any {
    const wallet = rawWallet || {};

    const walletAddress = String(
      wallet.walletAddress ||
      wallet.wallet_address ||
      ''
    );

    const customerId = String(
      wallet.customerId ||
      wallet.customer_id ||
      ''
    );

    const rawWalletType = String(
      wallet.walletType ||
      wallet.wallet_type ||
      wallet.type ||
      ''
    ).trim().toUpperCase();

    let walletType = rawWalletType;

    if (
      rawWalletType === 'ORG' ||
      rawWalletType === 'ORGANIZATION' ||
      walletAddress.toUpperCase().startsWith('ORG_WALLET_') ||
      customerId.toUpperCase().startsWith('ORG_')
    ) {
      walletType = 'ORGANIZATION';
    } else {
      walletType = 'CUSTOMER';
    }

    return {
      ...wallet,
      walletAddress,
      wallet_address: walletAddress,
      customerId,
      customer_id: customerId,
      walletType,
      wallet_type: walletType,
      currencyCode:
        wallet.currencyCode ||
        wallet.currency_code ||
        wallet.currency ||
        'USD',
      currency_code:
        wallet.currencyCode ||
        wallet.currency_code ||
        wallet.currency ||
        'USD',
      currentBalance:
        wallet.currentBalance ??
        wallet.current_balance ??
        0,
      current_balance:
        wallet.currentBalance ??
        wallet.current_balance ??
        0
    };
  }

}
