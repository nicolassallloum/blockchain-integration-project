import {
  ChangeDetectorRef,
  Component
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  firstValueFrom,
  timeout
} from 'rxjs';

import {
  getAddress,
  randomBytes,
  Wallet,
  sha256,
  toUtf8Bytes
} from 'ethers';

import {
  LicenseAccessService,
  AccessedLicense,
  WordChallengeResponse
} from '../../services/license-access.service';

import {
  LicenseRecoveryService
} from '../../services/license-recovery.service';

@Component({
  selector: 'app-licenses',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl:
    './licenses.component.html',
  styleUrls: [
    './licenses.component.scss'
  ]
})
export class LicensesComponent {

  walletAddress = '';
  walletPassword = '';

  loading = false;
  errorMessage = '';

  showPassword = false;

  showRecoveryPopup = false;
  recoveryChallenge:
    WordChallengeResponse | null = null;

  recoveryWord1 = '';
  recoveryWord2 = '';

  showLicensePopup = false;
  showLicenseHash = false;

  license:
    AccessedLicense | null = null;

  licenseHash = '';

  recoveredByWords = false;
  passwordResetToken = '';

  showPasswordResetPopup = false;
  resettingPassword = false;

  resetRecoveryWords: string[] =
    Array(12).fill('');

  showPasswordResetSuccessPopup = false;

  newGeneratedPassword = '';
  showNewGeneratedPassword = false;

  passwordResetWalletAddress = '';

  constructor(
    private readonly accessService:
      LicenseAccessService,

    private readonly recoveryService:
      LicenseRecoveryService,

    private readonly changeDetector:
      ChangeDetectorRef
  ) {}

  get canAccess(): boolean {
    return (
      !this.loading &&
      Boolean(
        this.walletAddress.trim()
      ) &&
      Boolean(
        this.walletPassword
      )
    );
  }

  togglePassword(): void {
    this.showPassword =
      !this.showPassword;
  }

  async viewLicense(): Promise<void> {
    this.errorMessage = '';

    if (!this.canAccess) {
      return;
    }

    this.loading = true;

    try {
      const normalizedAddress =
        getAddress(
          this.walletAddress.trim()
        );

      /*
       * Fetch encrypted wallet only.
       * Password is never sent to Node.js.
       */
      const walletResponse =
        await firstValueFrom(
          this.accessService
            .getWallet(normalizedAddress)
            .pipe(
              timeout(30000)
            )
        );

      const encryptedJson =
        JSON.stringify(
          walletResponse
            .wallet
            .encryptedWalletJson
        );

      /*
       * Password verification happens here.
       */
      const decryptedWallet =
        await Wallet.fromEncryptedJson(
          encryptedJson,
          this.walletPassword
        );

      if (
        getAddress(
          decryptedWallet.address
        ) !== normalizedAddress
      ) {
        throw new Error(
          'Wallet address does not match.'
        );
      }

      /*
       * Prove wallet ownership.
       */
      const challenge =
        await firstValueFrom(
          this.recoveryService
            .createChallenge(
              normalizedAddress
            )
        );

      const signature =
        await decryptedWallet.signMessage(
          challenge.challenge
        );

      const recovery =
        await firstValueFrom(
          this.recoveryService
            .recoverLicense({
              walletAddress:
                normalizedAddress,

              challengeId:
                challenge.challengeId,

              signature
            })
        );

      const recoveredLicense =
        recovery.licenses?.[0];

      if (!recoveredLicense) {
        throw new Error(
          'No license was returned.'
        );
      }

      this.license = {
        ...recoveredLicense,
        walletAddress:
          normalizedAddress,
        walletStatus:
          recovery.wallet.walletStatus
      };

      this.licenseHash =
        recoveredLicense.signedJwt;

      this.walletPassword = '';

      this.showLicensePopup = true;
      this.showLicenseHash = false;

    } catch (error: any) {
      this.errorMessage =
        error?.error?.message ||
        'Wallet address or password is incorrect.';
    } finally {
      this.loading = false;
    }
  }

  async forgotPassword(): Promise<void> {
    this.errorMessage = '';

    try {
      const normalizedAddress =
        getAddress(
          this.walletAddress.trim()
        );

      this.recoveryChallenge =
        await firstValueFrom(
          this.accessService
            .createForgotPasswordChallenge(
              normalizedAddress
            )
        );

      this.recoveryWord1 = '';
      this.recoveryWord2 = '';

      this.showRecoveryPopup = true;

    } catch (error: any) {
      this.errorMessage =
        error?.error?.message ||
        'Unable to start password recovery.';
    }
  }

  async verifyRecoveryWords():
    Promise<void> {

    if (!this.recoveryChallenge) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const digest1 =
        await this.sha256Hex(
          this.recoveryWord1
        );

      const digest2 =
        await this.sha256Hex(
          this.recoveryWord2
        );

      const result =
        await firstValueFrom(
          this.accessService
            .verifyRecoveryWords({
              challengeId:
                this.recoveryChallenge
                  .challengeId,

              wordDigest1:
                digest1,

              wordDigest2:
                digest2
            })
            .pipe(
              timeout(30000)
            )
        );

      if (
        !result?.success ||
        !result?.license ||
        !result?.licenseHash
      ) {
        throw new Error(
          'License information was not returned.'
        );
      }

      /*
       * Recovery succeeded.
       */
      this.license =
        result.license;

      this.licenseHash =
        result.licenseHash;

      this.recoveredByWords = true;

      this.passwordResetToken =
        result.passwordReset?.allowed
          ? result.passwordReset.resetToken
          : '';

      /*
       * Destroy entered recovery words.
       */
      this.recoveryWord1 = '';
      this.recoveryWord2 = '';

      /*
       * Close recovery popup.
       */
      this.showRecoveryPopup = false;
      this.recoveryChallenge = null;

      /*
       * Open Wallet / License Information popup.
       */
      this.showLicensePopup = true;

      /*
       * Forgot-password recovery should immediately
       * display the recovered license hash.
       */
      this.showLicenseHash = true;

      console.log(
        '[LICENSE_RECOVERY_UI_SUCCESS]',
        {
          contractRef:
            result.license.contractRef,

          walletAddress:
            result.license.walletAddress
        }
      );

      this.changeDetector.detectChanges();

    } catch (error: any) {

      console.error(
        '[LICENSE_RECOVERY_UI_ERROR]',
        error
      );

      this.errorMessage =
        error?.error?.message ||
        error?.message ||
        'Recovery words are incorrect.';

      /*
       * Keep recovery popup open,
       * but show the error inside it.
       */
      this.showRecoveryPopup = true;

      this.changeDetector.detectChanges();

    } finally {
      this.loading = false;

      this.changeDetector.detectChanges();
    }
  }

  closeRecoveryPopup(): void {
    this.recoveryWord1 = '';
    this.recoveryWord2 = '';
    this.showRecoveryPopup = false;
  }

  closeLicensePopup(): void {
    this.showLicensePopup = false;
    this.showLicenseHash = false;
    this.license = null;
    this.licenseHash = '';
  }

  toggleLicenseHash(): void {
    this.showLicenseHash =
      !this.showLicenseHash;
  }

  openPasswordReset(): void {
    if (
      !this.recoveredByWords ||
      !this.passwordResetToken ||
      !this.license
    ) {
      this.errorMessage =
        'Password reset authorization is unavailable. Please perform Forgot Password again.';
      return;
    }

    this.resetRecoveryWords =
      Array(12).fill('');

    this.errorMessage = '';

    this.showLicensePopup = false;
    this.showPasswordResetPopup = true;

    this.changeDetector.detectChanges();
  }

  updateResetRecoveryWord(
    index: number,
    value: string
  ): void {
    this.resetRecoveryWords[index] =
      String(value || '');
  }

  get canResetWalletPassword(): boolean {
    return (
      !this.resettingPassword &&
      this.resetRecoveryWords.length === 12 &&
      this.resetRecoveryWords.every(
        (word) =>
          Boolean(
            String(word || '').trim()
          )
      )
    );
  }

  async completeWalletPasswordReset():
    Promise<void> {

    if (
      !this.canResetWalletPassword ||
      !this.license ||
      !this.passwordResetToken
    ) {
      return;
    }

    this.resettingPassword = true;
    this.errorMessage = '';

    try {
      const phrase =
        this.resetRecoveryWords
          .map(
            (word) =>
              String(word || '')
                .trim()
                .toLowerCase()
          )
          .join(' ');

      /*
       * Reconstruct the wallet locally.
       * The 12 words never go to Node/PostgreSQL.
       */
      const recoveredWallet =
        Wallet.fromPhrase(phrase);

      const expectedAddress =
        getAddress(
          this.license.walletAddress ||
          this.walletAddress.trim()
        );

      if (
        getAddress(
          recoveredWallet.address
        ) !== expectedAddress
      ) {
        throw new Error(
          'The 12 recovery words do not belong to this wallet.'
        );
      }

      /*
       * Generate NEW password locally.
       */
      const newPassword =
        this.generateSecurePassword();

      /*
       * Re-encrypt SAME wallet/private key.
       */
      const encryptedWalletText =
        await recoveredWallet.encrypt(
          newPassword
        );

      const encryptedWalletJson =
        JSON.parse(
          encryptedWalletText
        ) as Record<string, unknown>;

      /*
       * Prove to backend that the reconstructed wallet
       * owns the SAME wallet address.
       */
      const resetMessage =
        `VALOORES_LICENSE_PASSWORD_RESET:` +
        `${expectedAddress}:` +
        `${this.passwordResetToken}`;

      const signature =
        await recoveredWallet.signMessage(
          resetMessage
        );

      const response =
        await firstValueFrom(
          this.accessService
            .completePasswordReset({
              walletAddress:
                expectedAddress,

              resetToken:
                this.passwordResetToken,

              signature,

              encryptedWalletJson
            })
            .pipe(
              timeout(30000)
            )
        );

      if (!response?.success) {
        throw new Error(
          'Password reset was not completed.'
        );
      }

      /*
       * Save new password only long enough to show
       * it once in the success popup.
       */
      this.passwordResetWalletAddress =
        expectedAddress;

      this.newGeneratedPassword =
        newPassword;

      this.showNewGeneratedPassword = true;

      /*
       * Destroy recovery words immediately.
       */
      this.resetRecoveryWords =
        Array(12).fill('');

      this.passwordResetToken = '';
      this.recoveredByWords = false;

      this.showPasswordResetPopup = false;

      this.showPasswordResetSuccessPopup =
        true;

      console.log(
        '[LICENSE_PASSWORD_RESET_UI_SUCCESS]',
        {
          walletAddress:
            expectedAddress,

          walletVersion:
            response.wallet.walletVersion
        }
      );

    } catch (error: any) {

      console.error(
        '[LICENSE_PASSWORD_RESET_UI_ERROR]',
        error
      );

      this.errorMessage =
        error?.error?.message ||
        error?.message ||
        'Unable to change wallet password.';

    } finally {
      this.resettingPassword = false;

      this.changeDetector.detectChanges();
    }
  }

  closePasswordResetPopup(): void {
    this.resetRecoveryWords =
      Array(12).fill('');

    this.showPasswordResetPopup = false;

    /*
     * Return to the license information.
     */
    this.showLicensePopup = true;

    this.changeDetector.detectChanges();
  }

  toggleNewGeneratedPassword(): void {
    this.showNewGeneratedPassword =
      !this.showNewGeneratedPassword;
  }

  async copyNewGeneratedPassword():
    Promise<void> {

    if (!this.newGeneratedPassword) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        this.newGeneratedPassword
      );
    } catch {}
  }

  confirmNewPasswordSaved(): void {
    /*
     * Remove plaintext password from Angular state.
     */
    this.newGeneratedPassword = '';
    this.passwordResetWalletAddress = '';

    this.showNewGeneratedPassword = false;
    this.showPasswordResetSuccessPopup = false;

    this.license = null;
    this.licenseHash = '';

    this.walletPassword = '';

    this.changeDetector.detectChanges();
  }

  private generateSecurePassword(): string {
    const bytes =
      randomBytes(24);

    const value =
      Array.from(bytes)
        .map(
          (byte) =>
            byte
              .toString(16)
              .padStart(2, '0')
        )
        .join('');

    return `VAL-${value}`;
  }

  formatModules(value: unknown): string {
    return Array.isArray(value)
      ? value.join(', ')
      : String(value ?? '');
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
