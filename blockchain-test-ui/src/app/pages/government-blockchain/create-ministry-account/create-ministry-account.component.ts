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

      walletAddress: ['', Validators.maxLength(120)],
      walletCurrency: ['LBP', Validators.required],
      walletInitialBalance: [
        0,
        [Validators.required, Validators.min(0)]
      ],
      walletType: ['MINISTRY_WALLET', Validators.required],
      walletOperationalStatus: ['PENDING', Validators.required]
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
      return;
    }

    this.isSubmitting = true;

    const payload = this.buildPayload();

    console.log('Create Ministry Account Payload:', payload);

    /*
      Backend integration example:

      this.governmentBlockchainApiService
        .createMinistryAccount(payload)
        .subscribe({
          next: () => {
            this.isSubmitting = false;
          },
          error: () => {
            this.isSubmitting = false;
          }
        });
    */

    setTimeout(() => {
      this.isSubmitting = false;
      alert('Ministry account created successfully.');
    }, 700);
  }

  createWallet(): void {
    this.ministryAccountForm.markAllAsTouched();

    const requiredWalletFields = [
      'ministryId',
      'ministryCode',
      'ministryName',
      'walletCurrency',
      'walletInitialBalance',
      'walletType',
      'walletOperationalStatus'
    ];

    const hasInvalidWalletData = requiredWalletFields.some((field) => {
      const control = this.ministryAccountForm.get(field);
      return control?.invalid;
    });

    if (hasInvalidWalletData) {
      return;
    }

    this.isWalletCreating = true;

    const generatedWalletAddress = this.generateWalletAddress();

    this.ministryAccountForm.patchValue({
      walletAddress: generatedWalletAddress,
      walletStatus: 'ACTIVE',
      walletOperationalStatus: 'ACTIVE'
    });

    const walletPayload = {
      ministryId: this.f['ministryId'].value,
      ministryCode: this.f['ministryCode'].value,
      ministryName: this.f['ministryName'].value,
      walletAddress: generatedWalletAddress,
      walletCurrency: this.f['walletCurrency'].value,
      walletInitialBalance: this.f['walletInitialBalance'].value,
      walletType: this.f['walletType'].value,
      walletStatus: 'ACTIVE'
    };

    console.log('Create Ministry Wallet Payload:', walletPayload);

    setTimeout(() => {
      this.isWalletCreating = false;
      alert('Wallet created successfully.');
    }, 700);
  }

  saveDraft(): void {
    this.isDraftSaving = true;

    const draftPayload = {
      draftStatus: 'DRAFT',
      data: this.ministryAccountForm.getRawValue()
    };

    console.log('Save Ministry Draft Payload:', draftPayload);

    setTimeout(() => {
      this.isDraftSaving = false;
      alert('Draft saved successfully.');
    }, 500);
  }

  resetForm(): void {
    this.ministryAccountForm.reset({
      country: 'LB',
      governorate: '',
      walletCurrency: 'LBP',
      walletInitialBalance: 0,
      walletType: 'MINISTRY_WALLET',
      walletStatus: 'PENDING',
      walletOperationalStatus: 'PENDING',
      institutionStatus: 'PENDING_APPROVAL'
    });

    this.loadGovernorates('LB');
  }

  private buildPayload() {
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
        parentMinistry: raw.parentMinistry,
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

        website: raw.website,
        walletStatus: raw.walletStatus,
        institutionStatus: raw.institutionStatus
      },
      wallet: {
        walletAddress: raw.walletAddress,
        walletCurrency: raw.walletCurrency,
        walletInitialBalance: Number(raw.walletInitialBalance),
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

  private generateWalletAddress(): string {
    const prefix = 'GOV-MIN';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();

    return `${prefix}-${timestamp}-${random}`;
  }
}
