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

  /**
   * Existing template compatibility.
   * wallet-login.html uses these names.
   */
  responseData: any = null;
  apiResponse: any = null;
  token = '';

  redirectTo = '/digital-kyc/dashboard';

  form = {
    customerId: '',
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

  countries: any[] = [];

  constructor(
    private walletService: WalletService,
    private walletSessionService: WalletSessionService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.redirectTo =
      this.route.snapshot.queryParamMap.get('redirectTo') ||
      '/digital-kyc/dashboard';

    this.loadCountries();
  }

  loadCountries(): void {
    if (!this.walletService.getCountries) {
      return;
    }

    this.walletService.getCountries().subscribe({
      next: (response: any) => {
        if (Array.isArray(response)) {
          this.countries = response;
          return;
        }

        if (Array.isArray(response?.data)) {
          this.countries = response.data;
          return;
        }

        if (Array.isArray(response?.data?.countries)) {
          this.countries = response.data.countries;
          return;
        }

        this.countries = [];
      },
      error: () => {
        this.countries = [];
      }
    });
  }

  fillSampleData(): void {
    this.form = {
      customerId: '19',
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
      customerId: '',
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

    if (!this.form.customerId) {
      this.errorMessage = 'Customer ID is required.';
      return;
    }

    if (!this.form.password) {
      this.errorMessage = 'Password is required.';
      return;
    }

    this.loading = true;

    const payload = {
      customerId: String(this.form.customerId).trim(),
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
          currentBalance: this.walletSummary.balance,
          currencyCode: this.walletSummary.currency,
          token: this.token
        };

        this.walletSessionService.setSession(normalizedSession);

        if (this.walletService.saveWalletToken) {
          this.walletService.saveWalletToken(this.token);
        }

        if (this.walletService.saveWalletProfile) {
          this.walletService.saveWalletProfile({
            token: this.token,
            wallet
          });
        }

        this.successMessage = 'Wallet login successful. Redirecting to the requested page...';

        setTimeout(() => {
          this.router.navigateByUrl(this.redirectTo);
        }, 600);
      },
      error: (error: any) => {
        this.loading = false;

        this.responseData = error?.error || error;
        this.apiResponse = error?.error || error;

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Wallet login failed. Please check the customer ID and password.';
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
}