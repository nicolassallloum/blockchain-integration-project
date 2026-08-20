import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { Wallet } from 'ethers';

import {
  AvailableLicense,
  LicenseWalletService,
  ProvisionLicenseWalletResponse
} from '../../services/license-wallet.service';

@Component({
  selector: 'app-license-wallet-create',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './license-wallet-create.component.html',
  styleUrls: ['./license-wallet-create.component.scss']
})
export class LicenseWalletCreateComponent implements OnInit {
  availableLicenses: AvailableLicense[] = [];
  selectedLicenseId = '';

  encryptionPassword = '';
  confirmEncryptionPassword = '';

  generatedWords: string[] = [];
  walletAddress = '';
  walletPublicKey = '';
  encryptedWalletJson: Record<string, unknown> | null = null;
  derivationPath = "m/44'/60'/0'/0/0";

  confirmationWord3 = '';
  confirmationWord9 = '';
  recoveryConfirmed = false;
  showWords = true;

  loadingLicenses = false;
  generatingWallet = false;
  provisioningWallet = false;

  errorMessage = '';
  successMessage = '';
  result: ProvisionLicenseWalletResponse | null = null;

  constructor(
    private readonly licenseWalletService: LicenseWalletService
  ) {}

  ngOnInit(): void {
    void this.loadAvailableLicenses();
  }

  get selectedLicense(): AvailableLicense | undefined {
    return this.availableLicenses.find(
      (license) => license.licenseId === this.selectedLicenseId
    );
  }

  get canGenerateWallet(): boolean {
    return (
      !this.generatingWallet &&
      !this.provisioningWallet &&
      Boolean(this.selectedLicenseId) &&
      this.encryptionPassword.length >= 12 &&
      this.encryptionPassword === this.confirmEncryptionPassword
    );
  }

  get canConfirmWords(): boolean {
    return (
      this.generatedWords.length === 12 &&
      Boolean(this.confirmationWord3.trim()) &&
      Boolean(this.confirmationWord9.trim())
    );
  }

  get canProvisionWallet(): boolean {
    return (
      !this.provisioningWallet &&
      this.recoveryConfirmed &&
      Boolean(this.encryptedWalletJson) &&
      Boolean(this.walletAddress) &&
      Boolean(this.walletPublicKey) &&
      Boolean(this.selectedLicenseId)
    );
  }

  async loadAvailableLicenses(): Promise<void> {
    this.loadingLicenses = true;
    this.errorMessage = '';

    try {
      const response = await firstValueFrom(
        this.licenseWalletService.getAvailableLicenses()
      );

      this.availableLicenses = response.licenses || [];
    } catch {
      this.errorMessage =
        'Unable to load licenses that are ready for wallet provisioning.';
    } finally {
      this.loadingLicenses = false;
    }
  }

  onLicenseSelected(value: string): void {
    this.selectedLicenseId = value;
    this.resetGeneratedWallet();
  }

  onPasswordChanged(
    field: 'password' | 'confirmation',
    value: string
  ): void {
    if (field === 'password') {
      this.encryptionPassword = value;
    } else {
      this.confirmEncryptionPassword = value;
    }

    this.errorMessage = '';
  }

  async generateWallet(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    this.result = null;

    if (!this.canGenerateWallet) {
      this.errorMessage =
        'Select a license and enter matching passwords of at least 12 characters.';
      return;
    }

    this.generatingWallet = true;

    try {
      const wallet = Wallet.createRandom();
      const phrase = wallet.mnemonic?.phrase;

      if (!phrase) {
        throw new Error('The wallet did not contain a recovery phrase.');
      }

      const words = phrase.trim().toLowerCase().split(/\s+/);

      if (words.length !== 12) {
        throw new Error('Exactly 12 recovery words were expected.');
      }

      const encryptedWalletText = await wallet.encrypt(
        this.encryptionPassword
      );

      this.generatedWords = words;
      this.walletAddress = wallet.address;
      this.walletPublicKey = wallet.publicKey;
      this.derivationPath = wallet.path || "m/44'/60'/0'/0/0";
      this.encryptedWalletJson = JSON.parse(
        encryptedWalletText
      ) as Record<string, unknown>;

      this.confirmationWord3 = '';
      this.confirmationWord9 = '';
      this.recoveryConfirmed = false;
      this.encryptionPassword = '';
      this.confirmEncryptionPassword = '';

      this.successMessage =
        'Wallet generated locally. Save the 12 words, then confirm words 3 and 9.';
    } catch {
      this.resetGeneratedWallet();
      this.errorMessage =
        'Unable to generate and encrypt the wallet in this browser.';
    } finally {
      this.generatingWallet = false;
    }
  }

  confirmRecoveryWords(): void {
    this.errorMessage = '';

    if (!this.canConfirmWords) {
      this.errorMessage = 'Enter recovery words 3 and 9.';
      return;
    }

    const word3 = this.confirmationWord3.trim().toLowerCase();
    const word9 = this.confirmationWord9.trim().toLowerCase();

    if (
      word3 !== this.generatedWords[2] ||
      word9 !== this.generatedWords[8]
    ) {
      this.recoveryConfirmed = false;
      this.errorMessage = 'Recovery-word confirmation failed.';
      return;
    }

    this.recoveryConfirmed = true;
    this.successMessage =
      'Recovery phrase confirmed. The public wallet mapping is ready.';
  }

  async provisionWallet(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    this.result = null;

    if (!this.canProvisionWallet || !this.encryptedWalletJson) {
      this.errorMessage =
        'Generate the wallet and confirm the recovery words first.';
      return;
    }

    this.provisioningWallet = true;

    try {
      this.result = await firstValueFrom(
        this.licenseWalletService.provisionWallet({
          licenseId: this.selectedLicenseId,
          walletAddress: this.walletAddress,
          walletPublicKey: this.walletPublicKey,
          encryptedWalletJson: this.encryptedWalletJson,
          derivationPath: this.derivationPath,
          recoveryConfirmed: true
        })
      );

      this.generatedWords = [];
      this.encryptedWalletJson = null;
      this.confirmationWord3 = '';
      this.confirmationWord9 = '';
      this.recoveryConfirmed = false;

      this.successMessage =
        'License wallet provisioned. The recovery words were cleared from the page.';

      await this.loadAvailableLicenses();
    } catch (error: any) {
      this.errorMessage =
        error?.error?.message ||
        'Unable to provision the license wallet.';
    } finally {
      this.provisioningWallet = false;
    }
  }

  toggleWords(): void {
    this.showWords = !this.showWords;
  }

  clearSensitiveData(): void {
    this.resetGeneratedWallet();
    this.errorMessage = '';
    this.successMessage = '';
  }

  formatModules(value: unknown): string {
    return Array.isArray(value)
      ? value.join(', ')
      : String(value ?? '');
  }

  private resetGeneratedWallet(): void {
    this.generatedWords = [];
    this.walletAddress = '';
    this.walletPublicKey = '';
    this.encryptedWalletJson = null;
    this.confirmationWord3 = '';
    this.confirmationWord9 = '';
    this.recoveryConfirmed = false;
    this.encryptionPassword = '';
    this.confirmEncryptionPassword = '';
    this.result = null;
  }
}
