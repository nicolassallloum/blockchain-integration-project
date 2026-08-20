import {
  Component,
  ElementRef,
  QueryList,
  ViewChildren
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Wallet } from 'ethers';
import { CommonModule } from '@angular/common';
import {
  LicenseRecoveryResponse,
  LicenseRecoveryService
} from '../../services/license-recovery.service';

@Component({
  selector: 'app-license-recovery',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './license-recovery.component.html',
  styleUrls: ['./license-recovery.component.scss']
})
export class LicenseRecoveryComponent {
  @ViewChildren('wordInput')
  wordInputs!: QueryList<ElementRef<HTMLInputElement>>;

  recoveryWords: string[] = Array(12).fill('');

  showWords = false;
  loading = false;
  errorMessage = '';
  successMessage = '';

  result: LicenseRecoveryResponse | null = null;

  constructor(
    private readonly recoveryService: LicenseRecoveryService
  ) {}

  onWordInput(index: number, value: string): void {
    const normalizedValue = value
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .trim();

    this.recoveryWords[index] = normalizedValue;

    if (
      normalizedValue.length > 1 &&
      index < this.recoveryWords.length - 1
    ) {
      const inputs = this.wordInputs.toArray();
      inputs[index + 1]?.nativeElement.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    const pastedText =
      event.clipboardData?.getData('text') ?? '';

    const words = pastedText
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length !== 12) {
      this.errorMessage =
        `Exactly 12 recovery words are required. ` +
        `Received ${words.length}.`;

      return;
    }

    event.preventDefault();

    this.recoveryWords = words.map((word) =>
      word.replace(/[^a-z]/g, '')
    );

    this.errorMessage = '';
  }

  toggleWords(): void {
    this.showWords = !this.showWords;
  }

  clearWords(): void {
    this.recoveryWords = Array(12).fill('');
    this.result = null;
    this.errorMessage = '';
    this.successMessage = '';

    setTimeout(() => {
      this.wordInputs
        .first
        ?.nativeElement
        .focus();
    });
  }

  get canRecover(): boolean {
    return (
      !this.loading &&
      this.recoveryWords.length === 12 &&
      this.recoveryWords.every(
        (word) => /^[a-z]+$/.test(word)
      )
    );
  }

  async recoverLicense(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    this.result = null;

    if (!this.canRecover) {
      this.errorMessage =
        'Enter all 12 recovery words before continuing.';

      return;
    }

    this.loading = true;

    try {
      const recoveryPhrase = this.recoveryWords
        .join(' ')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

      /*
       * Recovery happens locally in the browser.
       * The recovery phrase is never sent to the backend.
       */
      const recoveredWallet =
        Wallet.fromPhrase(recoveryPhrase);

      const challengeResponse = await firstValueFrom(
        this.recoveryService.createChallenge(
          recoveredWallet.address
        )
      );

      const signature =
        await recoveredWallet.signMessage(
          challengeResponse.challenge
        );

      this.result = await firstValueFrom(
        this.recoveryService.recoverLicense({
          walletAddress: recoveredWallet.address,
          challengeId:
            challengeResponse.challengeId,
          signature
        })
      );

      this.successMessage =
        'License recovered and verified successfully.';

      /*
       * Remove the recovery phrase from the component
       * after successful verification.
       */
      this.recoveryWords = Array(12).fill('');
    } catch {
      this.errorMessage =
        'License recovery failed. Verify the 12 recovery ' +
        'words and try again.';
    } finally {
      this.loading = false;
    }
  }

  formatModules(value: unknown): string {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);

        return Array.isArray(parsed)
          ? parsed.join(', ')
          : value;
      } catch {
        return value;
      }
    }

    return JSON.stringify(value ?? []);
  }

  statusClass(status: string): string {
    return status
      .toLowerCase()
      .replaceAll('_', '-');
  }
}