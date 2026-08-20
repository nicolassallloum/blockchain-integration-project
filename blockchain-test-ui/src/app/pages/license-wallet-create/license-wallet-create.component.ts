import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  firstValueFrom,
  timeout
} from 'rxjs';

import {
  Wallet,
  sha256,
  toUtf8Bytes
} from 'ethers';

import {
  AvailableLicense,
  LicenseWalletService,
  ProvisionLicenseWalletResponse
} from '../../services/license-wallet.service';

@Component({
  selector: 'app-license-wallet-create',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl:
    './license-wallet-create.component.html',
  styleUrls: [
    './license-wallet-create.component.scss'
  ]
})
export class LicenseWalletCreateComponent
implements OnInit {

  availableLicenses: AvailableLicense[] = [];

  selectedLicenseId = '';

  loadingLicenses = false;
  creatingWallet = false;

  errorMessage = '';
  successMessage = '';

  showCredentialPopup = false;
  showPassword = false;
  showWords = true;

  generatedWalletAddress = '';
  generatedPassword = '';
  generatedRecoveryWords: string[] = [];

  result:
    ProvisionLicenseWalletResponse | null = null;

  constructor(
    private readonly licenseWalletService:
      LicenseWalletService,

    private readonly changeDetector:
      ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    void this.loadAvailableLicenses();
  }

  get selectedLicense():
    AvailableLicense | undefined {

    return this.availableLicenses.find(
      (license) =>
        license.licenseId ===
        this.selectedLicenseId
    );
  }

  get canCreateWallet(): boolean {
    return (
      Boolean(this.selectedLicenseId) &&
      !this.loadingLicenses &&
      !this.creatingWallet
    );
  }

  async loadAvailableLicenses(): Promise<void> {
    this.loadingLicenses = true;
    this.errorMessage = '';

    try {
      const response =
        await firstValueFrom(
          this.licenseWalletService
            .getAvailableLicenses()
            .pipe(
              timeout(15000)
            )
        );

      this.availableLicenses =
        Array.isArray(response?.licenses)
          ? response.licenses
          : [];

      console.log(
        '[LICENSE_WALLET_UI] Available licenses:',
        this.availableLicenses.length
      );

      if (
        this.availableLicenses.length === 0
      ) {
        this.errorMessage =
          'No application licenses are currently available.';
      }

    } catch (error: any) {
      console.error(
        '[LICENSE_WALLET_UI] Failed to load licenses:',
        error
      );

      this.availableLicenses = [];

      this.errorMessage =
        error?.error?.message ||
        'Unable to load application licenses.';
    } finally {
      this.loadingLicenses = false;

      /*
       * This application uses asynchronous state updates.
       * Force the component template to refresh after the
       * HTTP Promise resolves.
       */
      this.changeDetector.detectChanges();
    }
  }

  onLicenseSelected(value: string): void {
    this.selectedLicenseId = value;

    this.errorMessage = '';
    this.successMessage = '';
    this.result = null;
  }

  async createWallet(): Promise<void> {
    if (!this.canCreateWallet) {
      return;
    }

    this.creatingWallet = true;

    this.errorMessage = '';
    this.successMessage = '';

    this.clearGeneratedCredentials();

    try {
      /*
       * Everything sensitive is generated
       * locally inside the browser.
       */
      const wallet =
        Wallet.createRandom();

      const recoveryPhrase =
        wallet.mnemonic?.phrase;

      if (!recoveryPhrase) {
        throw new Error(
          'Unable to generate recovery phrase.'
        );
      }

      const recoveryWords =
        recoveryPhrase
          .trim()
          .toLowerCase()
          .split(/\s+/);

      if (recoveryWords.length !== 12) {
        throw new Error(
          'Exactly 12 recovery words were expected.'
        );
      }

      const generatedPassword =
        this.generateSecurePassword();

      const encryptedWalletText =
        await wallet.encrypt(
          generatedPassword
        );

      const encryptedWalletJson =
        JSON.parse(
          encryptedWalletText
        ) as Record<string, unknown>;

      /*
       * Only SHA-256 digests are sent.
       * Recovery words never leave Angular.
       */
      const recoveryWordDigests =
        await Promise.all(
          recoveryWords.map(
            (word) =>
              this.sha256Hex(word)
          )
        );

      const response =
        await firstValueFrom(
          this.licenseWalletService
            .provisionWallet({
              licenseId:
                this.selectedLicenseId,

              walletAddress:
                wallet.address,

              walletPublicKey:
                wallet.publicKey,

              encryptedWalletJson,

              derivationPath:
                wallet.path ||
                "m/44'/60'/0'/0/0",

              recoveryConfirmed: true,

              recoveryWordDigests
            })
            .pipe(
              timeout(30000)
            )
        );

      /*
       * Only after PostgreSQL provisioning
       * succeeds do we expose the credentials.
       */
      this.result = response;

      this.generatedWalletAddress =
        wallet.address;

      this.generatedPassword =
        generatedPassword;

      this.generatedRecoveryWords =
        recoveryWords;

      this.showPassword = false;
      this.showWords = true;
      this.showCredentialPopup = true;

      this.successMessage =
        'License wallet created successfully.';

      void this.loadAvailableLicenses();

    } catch (error: any) {
      this.clearGeneratedCredentials();

      this.errorMessage =
        error?.error?.message ||
        error?.message ||
        'Unable to create license wallet.';
    } finally {
      this.creatingWallet = false;
    }
  }

  togglePassword(): void {
    this.showPassword =
      !this.showPassword;
  }

  toggleWords(): void {
    this.showWords =
      !this.showWords;
  }

  async copyValue(
    value: string
  ): Promise<void> {
    try {
      await navigator.clipboard
        .writeText(value);
    } catch {
      // Clipboard may be unavailable over HTTP.
    }
  }

  async copyRecoveryWords(): Promise<void> {
    await this.copyValue(
      this.generatedRecoveryWords.join(' ')
    );
  }

  confirmSavedCredentials(): void {
    /*
     * Destroy sensitive values from
     * Angular component memory.
     */
    this.showCredentialPopup = false;

    this.clearGeneratedCredentials();

    this.successMessage =
      'Wallet credentials confirmed as saved.';
  }

  formatModules(value: unknown): string {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    return String(value ?? '');
  }

  private clearGeneratedCredentials(): void {
    this.generatedWalletAddress = '';
    this.generatedPassword = '';
    this.generatedRecoveryWords = [];
    this.showPassword = false;
    this.showWords = false;
  }

  private generateSecurePassword(): string {
    /*
     * 192 bits of browser CSPRNG entropy.
     */
    const bytes =
      new Uint8Array(24);

    crypto.getRandomValues(bytes);

    const randomHex =
      Array.from(bytes)
        .map(
          (byte) =>
            byte
              .toString(16)
              .padStart(2, '0')
        )
        .join('');

    return `VAL-${randomHex}`;
  }

  private sha256Hex(
    value: string
  ): string {

    return sha256(
      toUtf8Bytes(
        value
          .trim()
          .toLowerCase()
      )
    ).slice(2);
  }
}
