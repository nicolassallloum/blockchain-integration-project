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
  iso_cou_code_alpha: string;
}

@Component({
  selector: 'app-wallet-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wallet-create.html',
  styleUrl: './wallet-create.scss'
})
export class WalletCreate implements OnInit {
  loading = false;
  pageLoading = false;
  successMessage = '';
  errorMessage = '';

  organizations: Organization[] = [];
  countries: Country[] = [];

  showSuccessScreen = false;
  generatedPassword = '';

  selectedCountryId = '';

  resultData = {
    customerId: '',
    walletAddress: '',
    oneTimePassword: '',
    recoveryPhrase: ''
  };

  form = {
    customerId: '',
    organizationId: '',
    fullName: '',
    nationality: '',
    nationalIdHash: '',
    mobileHash: '',
    emailHash: '',
    passwordHash: '',
    initialBalance: '1000',
    requestSource: 'ANGULAR_UI',
    sourceSystem: 'BLOCKCHAIN_TEST_UI',
    createdBy: 'nix'
  };

  constructor(private walletService: WalletService) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  initializeForm(): void {
    this.pageLoading = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.showSuccessScreen = false;

    this.generatePassword();

    this.walletService.getNextCustomerId().subscribe({
      next: (res: any) => {
        this.form.customerId =
          res?.data?.customer_id ||
          res?.data?.customerId ||
          '';

        this.loadOrganizations();
      },
      error: (err: any) => {
        this.pageLoading = false;
        this.errorMessage =
          err?.error?.message ||
          err?.message ||
          'Failed to load customer ID sequence';
      }
    });
  }

  loadOrganizations(): void {
    this.walletService.getOrganizations().subscribe({
      next: (res: any) => {
        this.organizations = res?.data || [];

        if (this.organizations.length > 0 && !this.form.organizationId) {
          this.form.organizationId = this.organizations[0].organization_id;
        }

        this.loadCountries();
      },
      error: (err: any) => {
        this.pageLoading = false;
        this.errorMessage =
          err?.error?.message ||
          err?.message ||
          'Failed to load organizations';
      }
    });
  }

  loadCountries(): void {
    this.walletService.getCountries().subscribe({
      next: (res: any) => {
        this.countries = res?.data || [];

        const lebanon = this.countries.find(
          (country) => country.iso_cou_code_alpha === 'LB'
        );

        const defaultCountry = lebanon || this.countries[0];

        if (defaultCountry) {
          this.selectedCountryId = String(defaultCountry.cou_id);
          this.form.nationality = defaultCountry.cou_name;
          this.form.nationalIdHash = String(defaultCountry.cou_id);
        }

        this.pageLoading = false;
      },
      error: (err: any) => {
        this.pageLoading = false;
        this.errorMessage =
          err?.error?.message ||
          err?.message ||
          'Failed to load countries';
      }
    });
  }

  onCountryChange(): void {
    const selectedCountry = this.countries.find(
      (country) => String(country.cou_id) === String(this.selectedCountryId)
    );

    if (selectedCountry) {
      this.form.nationality = selectedCountry.cou_name;
      this.form.nationalIdHash = String(selectedCountry.cou_id);
    }
  }

  generatePassword(length: number = 16): void {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';

    let password = '';

    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    this.generatedPassword = password;
    this.form.passwordHash = password;
  }

  fillSampleData(): void {
    this.form.fullName = 'NICOLAS SALLOUM';
    this.form.mobileHash = '79170430';
    this.form.emailHash = 'Nsalloum95@gmail.com';
    this.form.initialBalance = '1000';

    if (this.organizations.length > 0) {
      this.form.organizationId = this.organizations[0].organization_id;
    }

    const lebanon = this.countries.find(
      (country) => country.iso_cou_code_alpha === 'LB'
    );

    const selectedCountry = lebanon || this.countries[0];

    if (selectedCountry) {
      this.selectedCountryId = String(selectedCountry.cou_id);
      this.form.nationality = selectedCountry.cou_name;
      this.form.nationalIdHash = String(selectedCountry.cou_id);
    }

    this.generatePassword();
  }

  resetForm(): void {
    this.form = {
      customerId: '',
      organizationId: '',
      fullName: '',
      nationality: '',
      nationalIdHash: '',
      mobileHash: '',
      emailHash: '',
      passwordHash: '',
      initialBalance: '1000',
      requestSource: 'ANGULAR_UI',
      sourceSystem: 'BLOCKCHAIN_TEST_UI',
      createdBy: 'nix'
    };

    this.selectedCountryId = '';

    this.resultData = {
      customerId: '',
      walletAddress: '',
      oneTimePassword: '',
      recoveryPhrase: ''
    };

    this.initializeForm();
  }

  createWallet(): void {
    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    const payload = {
      customerId: this.form.customerId,
      organizationId: this.form.organizationId,
      fullName: this.form.fullName,
      nationality: this.form.nationality,
      nationalIdHash: this.form.nationalIdHash,
      mobileHash: this.form.mobileHash,
      emailHash: this.form.emailHash,
      passwordHash: this.form.passwordHash,
      initialBalance: this.form.initialBalance,
      requestSource: this.form.requestSource,
      sourceSystem: this.form.sourceSystem,
      createdBy: this.form.createdBy
    };

    this.walletService.createWallet(payload).subscribe({
      next: (res: any) => {
        this.loading = false;

        const responsePayload = res?.data || {};
        const wallet = responsePayload?.wallet || responsePayload;

        const recoveryValue =
          responsePayload?.recoveryPhrase ||
          responsePayload?.recovery_phrase ||
          responsePayload?.mnemonic ||
          responsePayload?.recoveryWords ||
          responsePayload?.recovery_words ||
          '';

        this.resultData = {
          customerId:
            wallet?.customerId ||
            wallet?.customer_id ||
            this.form.customerId,

          walletAddress:
            wallet?.walletAddress ||
            wallet?.wallet_address ||
            responsePayload?.walletAddress ||
            responsePayload?.wallet_address ||
            '',

          oneTimePassword:
            responsePayload?.oneTimePassword ||
            responsePayload?.one_time_password ||
            responsePayload?.otp ||
            this.generatedPassword,

          recoveryPhrase: Array.isArray(recoveryValue)
            ? recoveryValue.join(' ')
            : recoveryValue
        };

        this.successMessage = res?.message || 'Wallet created successfully';
        this.showSuccessScreen = true;
      },
      error: (err: any) => {
        this.loading = false;
        this.errorMessage =
          err?.error?.message ||
          err?.message ||
          'Failed to create wallet';
      }
    });
  }

  goToNewRegistration(): void {
    this.resetForm();
  }
}