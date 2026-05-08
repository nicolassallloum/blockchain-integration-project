import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { WalletService } from '../../services/wallet.service';

interface Organization {
  organizationId: string;
  organizationName: string;
  organizationCode?: string;
  organizationType?: string;
  status?: string;
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
  styleUrl: './wallet-create.css'
})
export class WalletCreate implements OnInit {
  loading = false;
  pageLoading = false;
  organizationsLoading = false;
  countriesLoading = false;

  successMessage = '';
  errorMessage = '';
  organizationErrorMessage = '';

  organizations: Organization[] = [];
  organizationTypes: string[] = [];
  selectedOrganizationType = '';
  countries: Country[] = [];

  showSuccessScreen = false;
  generatedPassword = '';

  selectedCountryId = '';

  resultData = {
    customerId: '',
    walletAddress: '',
    oneTimePassword: '',
    recoveryPhrase: '',
    currentBalance: 0,
    currencyCode: 'USD',
    organizationName: ''
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
    currencyCode: 'USD',
    requestSource: 'ANGULAR_UI',
    sourceSystem: 'BLOCKCHAIN_TEST_UI',
    createdBy: 'nix'
  };

  constructor(
    private walletService: WalletService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  initializeForm(): void {
    this.pageLoading = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.organizationErrorMessage = '';
    this.showSuccessScreen = false;

    this.generatePassword();
    this.loadNextCustomerId();
  }

  loadNextCustomerId(): void {
    this.walletService.getNextCustomerId().subscribe({
      next: (res: any) => {
        this.form.customerId =
          res?.data?.customer_id ||
          res?.data?.customerId ||
          res?.customer_id ||
          res?.customerId ||
          '';

        this.loadOrganizationTypes();
      },
      error: () => {
        /**
         * Do not block the page if sequence API is not available.
         * User can still enter Customer ID manually if needed.
         */
        this.form.customerId = '';
        this.loadOrganizationTypes();
      }
    });
  }


  loadOrganizationTypes(): void {
    this.organizationsLoading = true;
    this.organizationErrorMessage = '';

    this.walletService.getOrganizationTypes().subscribe({
      next: (res: any) => {
        const rawTypes =
          res?.data?.organizationTypes ||
          res?.data ||
          res?.organizationTypes ||
          [];

        this.organizationTypes = Array.isArray(rawTypes)
          ? rawTypes
              .map((type: any) =>
                typeof type === 'string'
                  ? type
                  : type.organizationType || type.organization_type || type.type || ''
              )
              .filter((type: string) => !!type)
          : [];

        if (this.organizationTypes.length > 0 && !this.selectedOrganizationType) {
          this.selectedOrganizationType = this.organizationTypes[0];
        }

        this.loadOrganizations();
      },
      error: () => {
        this.organizationTypes = [];
        this.selectedOrganizationType = '';
        this.loadOrganizations();
      }
    });
  }

  loadOrganizations(): void {
    this.organizationsLoading = true;
    this.organizationErrorMessage = '';
    this.form.organizationId = '';

    this.walletService.getOrganizations(this.selectedOrganizationType).subscribe({
      next: (res: any) => {
        this.organizations = this.normalizeOrganizations(res);

        if (this.organizations.length > 0) {
          this.form.organizationId = this.organizations[0].organizationId;
        }

        this.organizationsLoading = false;
        this.loadCountries();
      },
      error: (err: any) => {
        this.organizations = [];
        this.organizationsLoading = false;
        this.pageLoading = false;

        this.organizationErrorMessage =
          err?.error?.message ||
          err?.message ||
          'Failed to load organizations from backend.';
      }
    });
  }

  normalizeOrganizations(response: any): Organization[] {
    const rawOrganizations =
      response?.data?.organizations ||
      response?.data ||
      response?.organizations ||
      response ||
      [];

    if (!Array.isArray(rawOrganizations)) {
      return [];
    }

    return rawOrganizations
      .map((org: any) => ({
        organizationId:
          org.organizationId ||
          org.organization_id ||
          org.id ||
          '',

        organizationName:
          org.organizationName ||
          org.organization_name ||
          org.name ||
          org.organization_code ||
          '',

        organizationCode:
          org.organizationCode ||
          org.organization_code ||
          org.registration_number ||
          '',

        organizationType:
          org.organizationType ||
          org.organization_type ||
          '',

        status:
          org.status ||
          ''
      }))
      .filter((org: Organization) => !!org.organizationId && !!org.organizationName);
  }

  loadCountries(): void {
    this.countriesLoading = true;

    this.walletService.getCountries().subscribe({
      next: (res: any) => {
        const rawCountries =
          res?.data?.countries ||
          res?.data ||
          res?.countries ||
          [];

        this.countries = Array.isArray(rawCountries) ? rawCountries : [];

        const lebanon = this.countries.find(
          (country) =>
            country.iso_cou_code_alpha === 'LB' ||
            country.cou_name?.toLowerCase() === 'lebanon'
        );

        const defaultCountry = lebanon || this.countries[0];

        if (defaultCountry) {
          this.selectedCountryId = String(defaultCountry.cou_id);
          this.form.nationality = defaultCountry.cou_name;
          this.form.nationalIdHash = String(defaultCountry.cou_id);
        }

        this.countriesLoading = false;
        this.pageLoading = false;
      },
      error: () => {
        this.countries = [];
        this.countriesLoading = false;
        this.pageLoading = false;
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

  onOrganizationTypeChange(): void {
    this.organizationErrorMessage = '';
    this.loadOrganizations();
  }

  onOrganizationChange(): void {
    this.organizationErrorMessage = '';
  }

  getSelectedOrganizationName(): string {
    const selectedOrganization = this.organizations.find(
      (org) => org.organizationId === this.form.organizationId
    );

    return selectedOrganization?.organizationName || '';
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
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.form.customerId) {
      this.form.customerId = String(Date.now()).slice(-6);
    }

    this.form.fullName = 'NICOLAS SALLOUM';
    this.form.mobileHash = '79170430';
    this.form.emailHash = 'nsalloum95@gmail.com';
    this.form.initialBalance = '1000';
    this.form.currencyCode = 'USD';

    if (this.organizations.length > 0) {
      this.form.organizationId = this.organizations[0].organizationId;
    }

    const lebanon = this.countries.find(
      (country) =>
        country.iso_cou_code_alpha === 'LB' ||
        country.cou_name?.toLowerCase() === 'lebanon'
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
    this.loading = false;
    this.successMessage = '';
    this.errorMessage = '';
    this.organizationErrorMessage = '';
    this.showSuccessScreen = false;

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
      currencyCode: 'USD',
      requestSource: 'ANGULAR_UI',
      sourceSystem: 'BLOCKCHAIN_TEST_UI',
      createdBy: 'nix'
    };

    this.selectedCountryId = '';
    this.selectedOrganizationType = '';

    this.resultData = {
      customerId: '',
      walletAddress: '',
      oneTimePassword: '',
      recoveryPhrase: '',
      currentBalance: 0,
      currencyCode: 'USD',
      organizationName: ''
    };

    this.initializeForm();
  }

  validateForm(): boolean {
    if (!this.form.customerId) {
      this.errorMessage = 'Customer ID is required.';
      return false;
    }

    if (!this.form.organizationId) {
      this.errorMessage = 'Organization is required.';
      return false;
    }

    if (!this.form.fullName) {
      this.errorMessage = 'Full Name is required.';
      return false;
    }

    if (!this.form.mobileHash) {
      this.errorMessage = 'Mobile Hash is required.';
      return false;
    }

    if (!this.form.emailHash) {
      this.errorMessage = 'Email Hash is required.';
      return false;
    }

    if (!this.form.passwordHash) {
      this.errorMessage = 'Password is required.';
      return false;
    }

    const initialBalance = Number(this.form.initialBalance || 0);

    if (!Number.isFinite(initialBalance) || initialBalance < 0) {
      this.errorMessage = 'Initial Balance must be zero or greater.';
      return false;
    }

    return true;
  }

  createWallet(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.validateForm()) {
      return;
    }

    this.loading = true;

    const initialBalance = Number(this.form.initialBalance || 0);

    const payload = {
      customerId: String(this.form.customerId).trim(),
      organizationId: this.form.organizationId,
      fullName: String(this.form.fullName).trim(),
      nationality: this.form.nationality,
      nationalIdHash: this.form.nationalIdHash,
      mobileHash: String(this.form.mobileHash).trim(),
      emailHash: String(this.form.emailHash).trim(),
      passwordHash: this.form.passwordHash,
      initialBalance,
      currentBalance: initialBalance,
      currencyCode: this.form.currencyCode || 'USD',
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
            : recoveryValue,

          currentBalance:
            Number(
              wallet?.currentBalance ??
                wallet?.current_balance ??
                wallet?.balance ??
                initialBalance
            ),

          currencyCode:
            wallet?.currencyCode ||
            wallet?.currency_code ||
            wallet?.currency ||
            this.form.currencyCode ||
            'USD',

          organizationName:
            wallet?.organizationName ||
            wallet?.organization_name ||
            this.getSelectedOrganizationName()
        };

        this.successMessage = res?.message || 'Wallet created successfully.';
        this.showSuccessScreen = true;
      },
      error: (err: any) => {
        this.loading = false;

        console.error('Create wallet failed:', err?.error || err);

        this.errorMessage =
          err?.error?.message ||
          err?.error?.error?.message ||
          err?.error?.detail ||
          err?.error?.errorCode ||
          err?.message ||
          'Failed to create wallet.';
      }
    });
  }

  goToNewRegistration(): void {
    this.resetForm();
  }

  reloadOrganizations(): void {
    this.loadOrganizations();
  }
}
