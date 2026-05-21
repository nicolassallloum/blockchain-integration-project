import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import {
  GovernmentBlockchainReferenceApiService,
  GovernmentCountry,
  GovernmentGovernorate,
  WalletStatus,
  WalletType
} from '../../../services/government-blockchain-reference-api.service';

import {
  GovernmentMinistryApiService,
  CreateMinistryAccountPayload,
  CreateMinistryWalletPayload
} from '../../../services/government-ministry-api.service';

@Component({
  selector: 'app-create-ministry-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './create-ministry-account.component.html',
  styleUrls: ['./create-ministry-account.component.scss']
})
export class CreateMinistryAccountComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly referenceApi = inject(GovernmentBlockchainReferenceApiService);
  private readonly ministryApi = inject(GovernmentMinistryApiService);

  ministryAccountForm!: FormGroup;

  isSubmitting = false;
  isWalletCreating = false;
  isDraftSaving = false;

  isCountriesLoading = false;
  isGovernoratesLoading = false;
  isWalletTypesLoading = false;
  isWalletStatusesLoading = false;

  countries: GovernmentCountry[] = [];
  governorates: GovernmentGovernorate[] = [];
  walletTypes: WalletType[] = [];
  walletStatuses: WalletStatus[] = [];

  lastCreatedMinistryId: string | null = null;
  lastCreatedMinistryReferenceId: string | null = null;
  lastCreatedWalletAddress: string | null = null;

  createdLoginUsername: string | null = null;
  createdTemporaryPassword: string | null = null;
  createdWalletAddress: string | null = null;
  createdWalletCurrency: string | null = null;
  createdWalletBalance: string | null = null;

  ministryTypes = [
    'Central Government Ministry',
    'Public Administration',
    'Government Authority',
    'Regulatory Body',
    'Public Institution',
    'Municipality',
    'Independent Agency'
  ];

  institutionStatuses = [
    'ACTIVE',
    'INACTIVE',
    'PENDING_APPROVAL',
    'SUSPENDED'
  ];

  walletCurrencies = ['LBP', 'USD', 'EUR'];

  ngOnInit(): void {
    this.buildForm();
    this.loadReferenceData();
    this.listenForCountryChanges();
    this.listenForMinistryCodeChanges();
  }

  private buildForm(): void {
    this.ministryAccountForm = this.fb.group({
      ministryId: ['', [Validators.required, Validators.maxLength(50)]],
      ministryCode: ['', [Validators.required, Validators.maxLength(30)]],
      ministryName: ['', [Validators.required, Validators.maxLength(150)]],
      arabicName: ['', [Validators.required, Validators.maxLength(150)]],
      ministryType: ['', Validators.required],
      parentMinistry: ['', Validators.maxLength(150)],
      ministerName: ['', [Validators.required, Validators.maxLength(120)]],
      contactPerson: ['', [Validators.required, Validators.maxLength(120)]],
      contactEmail: [
        '',
        [Validators.required, Validators.email, Validators.maxLength(150)]
      ],
      contactMobile: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[+0-9\s-]{8,20}$/)
        ]
      ],
      address: ['', [Validators.required, Validators.maxLength(250)]],
      country: ['LB', Validators.required],
      governorate: ['', Validators.required],
      website: [
        '',
        [
          Validators.pattern(
            /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/
          )
        ]
      ],
      walletStatus: ['PENDING', Validators.required],
      institutionStatus: ['PENDING_APPROVAL', Validators.required],

      loginUsername: ['', [Validators.required, Validators.maxLength(100)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(100)
        ]
      ],
      confirmPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(100)
        ]
      ],

      walletAddress: ['', Validators.maxLength(150)],
      walletCurrency: ['LBP', Validators.required],
      walletInitialBalance: [0, [Validators.required, Validators.min(0)]],
      walletType: ['MINISTRY_WALLET', Validators.required],
      walletOperationalStatus: ['ACTIVE', Validators.required]
    });
  }

  private loadReferenceData(): void {
    this.loadCountries();
    this.loadGovernorates('LB');
    this.loadWalletTypes();
    this.loadWalletStatuses();
  }

  private loadCountries(): void {
    this.isCountriesLoading = true;

    this.referenceApi.getCountries().subscribe({
      next: (response) => {
        this.countries = response.data || [];
        this.isCountriesLoading = false;
      },
      error: (error) => {
        console.error('Failed to load countries:', error);
        this.countries = [];
        this.isCountriesLoading = false;
      }
    });
  }

  private loadGovernorates(countryCode: string): void {
    if (!countryCode) {
      this.governorates = [];
      return;
    }

    this.isGovernoratesLoading = true;

    this.referenceApi.getGovernorates(countryCode).subscribe({
      next: (response) => {
        this.governorates = response.data || [];
        this.isGovernoratesLoading = false;
      },
      error: (error) => {
        console.error('Failed to load governorates:', error);
        this.governorates = [];
        this.isGovernoratesLoading = false;
      }
    });
  }

  private loadWalletTypes(): void {
    this.isWalletTypesLoading = true;

    this.referenceApi.getWalletTypes().subscribe({
      next: (response) => {
        this.walletTypes = response.data || [];
        this.isWalletTypesLoading = false;
      },
      error: (error) => {
        console.error('Failed to load wallet types:', error);
        this.walletTypes = [];
        this.isWalletTypesLoading = false;
      }
    });
  }

  private loadWalletStatuses(): void {
    this.isWalletStatusesLoading = true;

    this.referenceApi.getWalletStatuses().subscribe({
      next: (response) => {
        this.walletStatuses = response.data || [];
        this.isWalletStatusesLoading = false;
      },
      error: (error) => {
        console.error('Failed to load wallet statuses:', error);
        this.walletStatuses = [];
        this.isWalletStatusesLoading = false;
      }
    });
  }

  private listenForCountryChanges(): void {
    this.ministryAccountForm.get('country')?.valueChanges.subscribe((countryCode: string) => {
      this.ministryAccountForm.patchValue(
        { governorate: '' },
        { emitEvent: false }
      );

      this.loadGovernorates(countryCode);
    });
  }

  private listenForMinistryCodeChanges(): void {
    this.ministryAccountForm.get('ministryCode')?.valueChanges.subscribe((ministryCode: string) => {
      const currentLoginUsername = this.ministryAccountForm.get('loginUsername')?.value;

      if (!currentLoginUsername && ministryCode) {
        this.ministryAccountForm.patchValue(
          {
            loginUsername: String(ministryCode).toUpperCase()
          },
          { emitEvent: false }
        );
      }
    });
  }

  get f() {
    return this.ministryAccountForm.controls;
  }

  isInvalid(controlName: string): boolean {
    const control = this.ministryAccountForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  getErrorMessage(controlName: string): string {
    const control = this.ministryAccountForm.get(controlName);

    if (!control || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'This field is required.';
    }

    if (control.errors['email']) {
      return 'Please enter a valid email address.';
    }

    if (control.errors['maxlength']) {
      return `Maximum allowed characters: ${control.errors['maxlength'].requiredLength}.`;
    }

    if (control.errors['minlength']) {
      return `Minimum required characters: ${control.errors['minlength'].requiredLength}.`;
    }

    if (control.errors['min']) {
      return 'Value cannot be negative.';
    }

    if (control.errors['pattern']) {
      return 'Invalid format.';
    }

    return 'Invalid value.';
  }

  createMinistryAccount(): void {
    this.ministryAccountForm.markAllAsTouched();

    if (this.ministryAccountForm.invalid) {
      alert('Please fill all required fields correctly.');
      return;
    }

    const password = this.ministryAccountForm.get('password')?.value;
    const confirmPassword = this.ministryAccountForm.get('confirmPassword')?.value;

    if (password !== confirmPassword) {
      alert('Password and Confirm Password do not match.');
      return;
    }

    this.isSubmitting = true;

    const payload = this.buildPayload();

    console.log('Sending Create Ministry Account Payload:', payload);

    this.ministryApi.createMinistryAccount(payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;

        const savedMinistry = response.data?.ministry;
        const savedWallet = response.data?.wallet;
        const login = response.data?.login;

        this.createdLoginUsername =
          login?.username ||
          savedMinistry?.login_username ||
          payload.ministry.loginUsername ||
          null;

        this.createdTemporaryPassword =
          login?.temporaryPassword ||
          this.ministryAccountForm.get('password')?.value ||
          null;

        this.createdWalletAddress = savedWallet?.wallet_address || null;
        this.createdWalletCurrency = savedWallet?.wallet_currency || null;
        this.createdWalletBalance = savedWallet?.wallet_current_balance || null;

        this.lastCreatedMinistryId = savedMinistry?.ministry_id || null;
        this.lastCreatedMinistryReferenceId =
          savedMinistry?.ministry_reference_id || payload.ministry.ministryId;

        this.lastCreatedWalletAddress = savedWallet?.wallet_address || null;

        if (savedWallet?.wallet_address) {
          this.ministryAccountForm.patchValue({
            walletAddress: savedWallet.wallet_address,
            walletStatus: savedWallet.wallet_status || 'ACTIVE',
            walletOperationalStatus: savedWallet.wallet_status || 'ACTIVE'
          });
        }

        alert(response.message || 'Ministry account created successfully.');
      },
      error: (error) => {
        this.isSubmitting = false;

        console.error('Create ministry account failed:', error);

        const message =
          error?.error?.message ||
          'Failed to create ministry account. Please check backend logs.';

        alert(message);
      }
    });
  }

  createWallet(): void {
    const ministryReferenceId =
      this.lastCreatedMinistryReferenceId ||
      this.ministryAccountForm.get('ministryId')?.value;

    if (!ministryReferenceId) {
      alert('Please enter Ministry ID first.');
      return;
    }

    const requiredWalletFields = [
      'walletCurrency',
      'walletInitialBalance',
      'walletType',
      'walletOperationalStatus'
    ];

    requiredWalletFields.forEach((field) => {
      this.ministryAccountForm.get(field)?.markAsTouched();
    });

    const hasInvalidWalletData = requiredWalletFields.some((field) => {
      const control = this.ministryAccountForm.get(field);
      return control?.invalid;
    });

    if (hasInvalidWalletData) {
      alert('Please complete wallet fields correctly.');
      return;
    }

    this.isWalletCreating = true;

    const walletPayload: CreateMinistryWalletPayload = {
      walletAddress: this.ministryAccountForm.get('walletAddress')?.value || null,
      walletCurrency: this.ministryAccountForm.get('walletCurrency')?.value,
      walletInitialBalance: Number(
        this.ministryAccountForm.get('walletInitialBalance')?.value || 0
      ),
      walletType: this.ministryAccountForm.get('walletType')?.value,
      walletStatus:
        this.ministryAccountForm.get('walletOperationalStatus')?.value || 'ACTIVE'
    };

    console.log('Sending Create Ministry Wallet Payload:', walletPayload);

    this.ministryApi.createMinistryWallet(ministryReferenceId, walletPayload).subscribe({
      next: (response) => {
        this.isWalletCreating = false;

        const savedWallet = response.data;

        this.lastCreatedWalletAddress = savedWallet?.wallet_address || null;

        this.createdWalletAddress = savedWallet?.wallet_address || null;
        this.createdWalletCurrency = savedWallet?.wallet_currency || null;
        this.createdWalletBalance = savedWallet?.wallet_current_balance || null;

        this.ministryAccountForm.patchValue({
          walletAddress: savedWallet?.wallet_address || walletPayload.walletAddress,
          walletStatus: savedWallet?.wallet_status || 'ACTIVE',
          walletOperationalStatus: savedWallet?.wallet_status || 'ACTIVE'
        });

        alert(response.message || 'Ministry wallet created successfully.');
      },
      error: (error) => {
        this.isWalletCreating = false;

        console.error('Create ministry wallet failed:', error);

        const message =
          error?.error?.message ||
          'Failed to create wallet. Make sure the ministry account is already saved.';

        alert(message);
      }
    });
  }

  saveDraft(): void {
    this.isDraftSaving = true;

    const draftPayload = {
      draftStatus: 'DRAFT',
      data: this.ministryAccountForm.getRawValue()
    };

    console.log('Sending Save Ministry Draft Payload:', draftPayload);

    this.ministryApi.saveDraft(draftPayload).subscribe({
      next: (response) => {
        this.isDraftSaving = false;
        alert(response.message || 'Draft saved successfully.');
      },
      error: (error) => {
        this.isDraftSaving = false;

        console.error('Save ministry draft failed:', error);

        const message =
          error?.error?.message ||
          'Failed to save draft. Please check backend logs.';

        alert(message);
      }
    });
  }

  resetForm(): void {
    this.ministryAccountForm.reset({
      country: 'LB',
      governorate: '',
      walletCurrency: 'LBP',
      walletInitialBalance: 0,
      walletType: 'MINISTRY_WALLET',
      walletStatus: 'PENDING',
      walletOperationalStatus: 'ACTIVE',
      institutionStatus: 'PENDING_APPROVAL',
      loginUsername: '',
      password: '',
      confirmPassword: ''
    });

    this.lastCreatedMinistryId = null;
    this.lastCreatedMinistryReferenceId = null;
    this.lastCreatedWalletAddress = null;

    this.createdLoginUsername = null;
    this.createdTemporaryPassword = null;
    this.createdWalletAddress = null;
    this.createdWalletCurrency = null;
    this.createdWalletBalance = null;

    this.loadGovernorates('LB');
  }

  private buildPayload(): CreateMinistryAccountPayload {
    const raw = this.ministryAccountForm.getRawValue();

    const selectedCountry = this.countries.find(
      (country) => country.countryCode === raw.country
    );

    const selectedGovernorate = this.governorates.find(
      (governorate) => governorate.governorateCode === raw.governorate
    );

    return {
      ministry: {
        ministryId: raw.ministryId,
        ministryCode: raw.ministryCode,
        ministryName: raw.ministryName,
        arabicName: raw.arabicName,
        ministryType: raw.ministryType,
        parentMinistry: raw.parentMinistry || null,
        ministerName: raw.ministerName,
        contactPerson: raw.contactPerson,
        contactEmail: raw.contactEmail,
        contactMobile: raw.contactMobile,
        address: raw.address,

        countryCode: raw.country,
        countryId: selectedCountry?.countryId || null,
        countryName: selectedCountry?.countryName || null,

        governorateCode: raw.governorate,
        governorateId: selectedGovernorate?.governorateId || null,
        governorateName: selectedGovernorate?.governorateName || null,
        governorateNameAr: selectedGovernorate?.governorateNameAr || null,

        website: raw.website || null,
        walletStatus: raw.walletStatus,
        institutionStatus: raw.institutionStatus,

        loginUsername: raw.loginUsername || raw.ministryCode,
        password: raw.password
      },
      wallet: {
        walletAddress: raw.walletAddress || null,
        walletCurrency: raw.walletCurrency,
        walletInitialBalance: Number(raw.walletInitialBalance || 0),
        walletType: raw.walletType,
        walletStatus: raw.walletOperationalStatus
      },
      blockchain: {
        sourceSystem: 'GOVERNMENT_BLOCKCHAIN_SERVICES_PLATFORM',
        module: 'CREATE_MINISTRY_ACCOUNT',
        ledgerAction: 'CREATE_MINISTRY_ACCOUNT_AND_WALLET',
        preparedForFabricSubmission: true
      }
    };
  }
}