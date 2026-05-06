import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';

@Component({
  selector: 'app-wallet-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wallet-create.component.html',
  styleUrl: './wallet-create.component.css'
})
export class WalletCreateComponent {
  loading = false;
  successMessage = '';
  errorMessage = '';
  responseData: any = null;

  form = {
    customerId: '',
    organizationId: '',
    fullName: '',
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

  createWallet(): void {
    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.responseData = null;

    this.walletService.createWallet(this.form).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.responseData = res;
        this.successMessage = res?.message || 'Wallet created successfully';
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

  fillSampleData(): void {
    const randomId = Math.floor(Math.random() * 9000) + 1000;

    this.form = {
      customerId: `CUST${randomId}`,
      organizationId: '26af0fd4-80c4-4da6-9240-b66ff88a7023',
      fullName: `UI Test Customer ${randomId}`,
      nationalIdHash: `NID_HASH_${randomId}`,
      mobileHash: `MOBILE_HASH_${randomId}`,
      emailHash: `EMAIL_HASH_${randomId}`,
      passwordHash: `PASSWORD_HASH_${randomId}`,
      initialBalance: '1000',
      requestSource: 'ANGULAR_UI',
      sourceSystem: 'BLOCKCHAIN_TEST_UI',
      createdBy: 'nix'
    };
  }

  resetForm(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.responseData = null;

    this.form = {
      customerId: '',
      organizationId: '',
      fullName: '',
      nationalIdHash: '',
      mobileHash: '',
      emailHash: '',
      passwordHash: '',
      initialBalance: '1000',
      requestSource: 'ANGULAR_UI',
      sourceSystem: 'BLOCKCHAIN_TEST_UI',
      createdBy: 'nix'
    };
  }
}
