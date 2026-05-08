import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { WalletService } from '../../services/wallet.service';

interface Organization {
  organizationId: string;
  organizationName: string;
  organizationCode?: string;
}

@Component({
  selector: 'app-organization-wallet-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './organization-wallet-create.html',
  styleUrl: './organization-wallet-create.css'
})
export class OrganizationWalletCreate implements OnInit {
  loading = false;
  pageLoading = false;
  successMessage = '';
  errorMessage = '';

  organizations: Organization[] = [];

  generatedPassword = '';

  form = {
    organizationId: '',
    initialBalance: '100000',
    currencyCode: 'USD',
    passwordHash: '',
    requestSource: 'ANGULAR_UI',
    sourceSystem: 'BLOCKCHAIN_TEST_UI',
    createdBy: 'nix'
  };

  resultData = {
    walletAddress: '',
    customerId: '',
    organizationName: '',
    currentBalance: 0,
    currencyCode: 'USD',
    oneTimePassword: ''
  };

  showSuccessScreen = false;

  constructor(private walletService: WalletService) {}

  ngOnInit(): void {
    this.generatePassword();
    this.loadOrganizations();
  }

  loadOrganizations(): void {
    this.pageLoading = true;
    this.errorMessage = '';

    this.walletService.getOrganizations().subscribe({
      next: (response: any) => {
        const rawOrganizations =
          response?.data?.organizations ||
          response?.data ||
          response?.organizations ||
          [];

        this.organizations = Array.isArray(rawOrganizations)
          ? rawOrganizations.map((org: any) => ({
              organizationId:
                org.organizationId ||
                org.organization_id ||
                org.id ||
                '',
              organizationName:
                org.organizationName ||
                org.organization_name ||
                org.name ||
                '',
              organizationCode:
                org.organizationCode ||
                org.organization_code ||
                org.registration_number ||
                ''
            }))
          : [];

        if (this.organizations.length > 0) {
          this.form.organizationId = this.organizations[0].organizationId;
        }

        this.pageLoading = false;
      },
      error: (error: any) => {
        this.pageLoading = false;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to load organizations.';
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

  getSelectedOrganizationName(): string {
    return (
      this.organizations.find(
        (org) => org.organizationId === this.form.organizationId
      )?.organizationName || ''
    );
  }

  validateForm(): string | null {
    if (!this.form.organizationId) {
      return 'Organization is required.';
    }

    const initialBalance = Number(this.form.initialBalance || 0);

    if (!Number.isFinite(initialBalance) || initialBalance < 0) {
      return 'Initial Balance must be zero or greater.';
    }

    if (!this.form.passwordHash) {
      return 'Password is required.';
    }

    return null;
  }

  createOrganizationWallet(): void {
    this.successMessage = '';
    this.errorMessage = '';

    const validationError = this.validateForm();

    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.loading = true;

    const payload = {
      organizationId: this.form.organizationId,
      initialBalance: Number(this.form.initialBalance || 0),
      currentBalance: Number(this.form.initialBalance || 0),
      currencyCode: this.form.currencyCode || 'USD',
      passwordHash: this.form.passwordHash,
      requestSource: this.form.requestSource,
      sourceSystem: this.form.sourceSystem,
      createdBy: this.form.createdBy
    };

    this.walletService.createOrganizationWallet(payload).subscribe({
      next: (response: any) => {
        this.loading = false;

        const data = response?.data || {};
        const wallet = data?.wallet || data;

        this.resultData = {
          walletAddress:
            wallet?.walletAddress ||
            wallet?.wallet_address ||
            '',
          customerId:
            wallet?.customerId ||
            wallet?.customer_id ||
            '',
          organizationName:
            wallet?.organizationName ||
            wallet?.organization_name ||
            this.getSelectedOrganizationName(),
          currentBalance:
            Number(
              wallet?.currentBalance ??
                wallet?.current_balance ??
                payload.initialBalance
            ),
          currencyCode:
            wallet?.currencyCode ||
            wallet?.currency_code ||
            payload.currencyCode,
          oneTimePassword:
            data?.oneTimePassword ||
            data?.one_time_password ||
            this.generatedPassword
        };

        this.successMessage =
          response?.message || 'Organization wallet created successfully.';
        this.showSuccessScreen = true;
      },
      error: (error: any) => {
        this.loading = false;
        this.errorMessage =
          error?.error?.message ||
          error?.error?.error?.message ||
          error?.message ||
          'Failed to create organization wallet.';
      }
    });
  }

  resetForm(): void {
    this.showSuccessScreen = false;
    this.successMessage = '';
    this.errorMessage = '';
    this.form.initialBalance = '100000';
    this.form.currencyCode = 'USD';

    if (this.organizations.length > 0) {
      this.form.organizationId = this.organizations[0].organizationId;
    }

    this.generatePassword();
  }
}
