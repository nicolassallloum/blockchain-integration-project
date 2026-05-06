import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';

interface Organization {
  organization_id: string;
  organization_name: string;
}

interface Country {
  cou_id: number;
  cou_name: string;
  iso_cou_code_alpha?: string;
}

@Component({
  selector: 'app-wallet-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wallet-login.html',
  styleUrl: './wallet-login.css'
})
export class WalletLogin implements OnInit {
  loading = false;
  referenceLoading = false;

  successMessage = '';
  errorMessage = '';

  responseData: any = null;
  token = '';

  organizations: Organization[] = [];
  countries: Country[] = [];

  form = {
    customerId: '',
    password: ''
  };

  walletSummary = {
    customerId: '-',
    customerName: '-',
    organizationId: '-',
    organizationName: '-',
    countryId: '-',
    countryName: '-',
    emailAddress: '-',
    mobilePhone: '-',
    balance: '-',
    currency: '-',
    creationDateTime: '-',
    walletAddress: '-',
    status: '-'
  };

  constructor(private walletService: WalletService) {}

  ngOnInit(): void {
    this.loadReferenceData();
  }

  loadReferenceData(): void {
    this.referenceLoading = true;

    this.walletService.getOrganizations().subscribe({
      next: (orgRes: any) => {
        this.organizations = orgRes?.data || [];

        this.walletService.getCountries().subscribe({
          next: (countryRes: any) => {
            this.countries = countryRes?.data || [];
            this.referenceLoading = false;
          },
          error: () => {
            this.referenceLoading = false;
          }
        });
      },
      error: () => {
        this.referenceLoading = false;
      }
    });
  }

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

        const receivedToken =
          res?.data?.token ||
          res?.token ||
          '';

        if (receivedToken) {
          this.token = receivedToken;
          this.walletService.saveWalletToken(receivedToken);
        }

        this.buildWalletSummary(res);

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

  buildWalletSummary(res: any): void {
    const wallet =
      res?.data?.wallet ||
      res?.wallet ||
      res?.data ||
      {};

    const organizationId =
      wallet?.organizationId ||
      wallet?.organization_id ||
      '-';

    const countryId =
      wallet?.countryId ||
      wallet?.country_id ||
      wallet?.nationalIdHash ||
      wallet?.national_id_hash ||
      wallet?.nationalityId ||
      wallet?.nationality_id ||
      '-';

    const matchedOrganization = this.organizations.find(
      (org) => String(org.organization_id) === String(organizationId)
    );

    const matchedCountry = this.countries.find(
      (country) => String(country.cou_id) === String(countryId)
    );

    this.walletSummary = {
      customerId:
        wallet?.customerId ||
        wallet?.customer_id ||
        this.form.customerId ||
        '-',

      customerName:
        wallet?.fullName ||
        wallet?.full_name ||
        wallet?.customerName ||
        wallet?.customer_name ||
        '-',

      organizationId:
        organizationId,

      organizationName:
        matchedOrganization?.organization_name ||
        wallet?.organizationName ||
        wallet?.organization_name ||
        '-',

      countryId:
        countryId,

      countryName:
        matchedCountry?.cou_name ||
        wallet?.countryName ||
        wallet?.country_name ||
        wallet?.nationality ||
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
        wallet?.balance ||
        wallet?.currentBalance ||
        wallet?.current_balance ||
        wallet?.availableBalance ||
        wallet?.available_balance ||
        '-',

      currency:
        wallet?.currency ||
        wallet?.currencyCode ||
        wallet?.currency_code ||
        'USD',

      creationDateTime:
        wallet?.createdAt ||
        wallet?.created_at ||
        wallet?.creationDateTime ||
        wallet?.creation_date_time ||
        '-',

      walletAddress:
        wallet?.walletAddress ||
        wallet?.wallet_address ||
        '-',

      status:
        wallet?.status ||
        wallet?.walletStatus ||
        wallet?.wallet_status ||
        '-'
    };
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

    this.walletSummary = {
      customerId: '-',
      customerName: '-',
      organizationId: '-',
      organizationName: '-',
      countryId: '-',
      countryName: '-',
      emailAddress: '-',
      mobilePhone: '-',
      balance: '-',
      currency: '-',
      creationDateTime: '-',
      walletAddress: '-',
      status: '-'
    };
  }

  copyToken(): void {
    if (this.token) {
      navigator.clipboard.writeText(this.token);
      this.successMessage = 'Token copied to clipboard';
    }
  }

  copyWalletAddress(): void {
    if (this.walletSummary.walletAddress && this.walletSummary.walletAddress !== '-') {
      navigator.clipboard.writeText(this.walletSummary.walletAddress);
      this.successMessage = 'Wallet address copied to clipboard';
    }
  }
}