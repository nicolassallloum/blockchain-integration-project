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
  templateUrl: './wallet-create.component.html',
  styleUrl: './wallet-create.component.css'
})
export class WalletCreateComponent implements OnInit {
  loading = false;
  pageLoading = false;
  successMessage = '';
  errorMessage = '';
  responseData: any = null;

  organizations: Organization[] = [];
  countries: Country[] = [];

  showSuccessScreen = false;

  generatedPassword = '';

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
    this.responseData = null;
    this.showSuccessScreen = false;

    this.generatePassword();

    this.walletService.getNextCustomerId().subscribe({
      next: (res: any) => {
        this.form.customerId =
          res?.data?.customer_id ||
          res?.data?.customerId ||
          '';

        this.walletService.getOrganizations().subscribe({
          next: (orgRes: any) => {
            this.organizations = orgRes?.data || [];

            this.walletService.getCountries().subscribe({
              next: (countryRes: any) => {
                this.countries = countryRes?.data || [];
                this.pageLoading = false;
              },
              error: (err: any) => {
                this.pageLoading = false;
                this.errorMessage =
                  err?.error?.message || 'Failed to load countries';
              }
            });
          },
          error: (err: any) => {
            this.pageLoading = false;
            this.errorMessage =
              err?.error?.message || 'Failed to load organizations';
          }
        });
      },
      error: (err: any) => {
        this.pageLoading = false;
        this.errorMessage =
          err?.error?.message || 'Failed to load next customer id';
      }
    });
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
    this.form.organizationId = this.organizations.length > 0
      ? this.organizations[0].organization_id
      : '';
    this.form.nationality = this.countries.length > 0
      ? this.countries.find((c) => c.iso_cou_code_alpha === 'LB')?.cou_name || this.countries[0].cou_name
      : '';
    this.form.nationalIdHash = '123123';
    this.form.mobileHash = '79170430';
    this.form.emailHash = 'Nsalloum95@gmail.com';
    this.form.initialBalance = '1000';
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
    this.responseData = null;

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
        this.responseData = res;
        this.successMessage = res?.message || 'Wallet created successfully';

        const responsePayload = res?.data || {};

        const recoveryValue =
          responsePayload?.recoveryPhrase ||
          responsePayload?.recovery_phrase ||
          responsePayload?.mnemonic ||
          responsePayload?.walletBackup ||
          responsePayload?.wallet_backup ||
          responsePayload?.recoveryWords ||
          responsePayload?.recovery_words ||
          '';

        this.resultData = {
          customerId:
            responsePayload?.customerId ||
            responsePayload?.customer_id ||
            this.form.customerId,
          walletAddress:
            responsePayload?.walletAddress ||
            responsePayload?.wallet_address ||
            responsePayload?.loginId ||
            responsePayload?.login_id ||
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

        this.showSuccessScreen = true;
      },
      error: (err: any) => {
        this.loading = false;
        this.errorMessage =
          err?.error?.message ||
          err?.message ||
          'Failed to create wallet';
        this.responseData = err?.error || err;
      }
    });
  }

  goToNewRegistration(): void {
    this.resetForm();
  }

  copyValue(value: string): void {
    if (value) {
      navigator.clipboard.writeText(value);
    }
  }
}