import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { GovernmentBlockchainResidentApiService } from '../../../services/government-blockchain-resident-api.service';

@Component({
  selector: 'app-resident-wallet-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './resident-wallet-login.component.html',
  styleUrl: './resident-wallet-login.component.scss',
})
export class ResidentWalletLoginComponent {
  loginForm: FormGroup;
  isLoggingIn = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  residentInfo = signal<any | null>(null);

  constructor(
    private fb: FormBuilder,
    private residentApi: GovernmentBlockchainResidentApiService
  ) {
    this.loginForm = this.fb.group({
      loginId: ['', [Validators.required, Validators.minLength(3)]],
      walletPassword: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  login(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.residentInfo.set(null);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage.set('Please enter Resident ID / Wallet Address and password.');
      return;
    }

    this.isLoggingIn.set(true);

    this.residentApi.walletLogin(this.loginForm.value).subscribe({
      next: (response) => {
        this.isLoggingIn.set(false);

        if (response?.success) {
          this.successMessage.set('Resident wallet login successful.');
          this.residentInfo.set(response.data?.resident || null);
        } else {
          this.errorMessage.set(response?.message || 'Login failed.');
        }
      },
      error: (error) => {
        this.isLoggingIn.set(false);
        this.errorMessage.set(error?.error?.message || 'Login failed.');
        console.error('[Resident Wallet Login Error]', error);
      },
    });
  }

  reset(): void {
    this.loginForm.reset();
    this.errorMessage.set('');
    this.successMessage.set('');
    this.residentInfo.set(null);
  }

  hasError(fieldName: string): boolean {
    const control = this.loginForm.get(fieldName);
    return !!control && control.invalid && control.touched;
  }
}
