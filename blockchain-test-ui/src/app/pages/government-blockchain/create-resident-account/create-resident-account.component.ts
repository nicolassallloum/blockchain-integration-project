import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { forkJoin } from 'rxjs';

import {
  GovernmentBlockchainResidentApiService,
} from '../../../services/government-blockchain-resident-api.service';

import {
  ResidentReferenceApiService,
  ResidentLookupItem,
} from '../../../services/resident-reference-api.service';

interface LookupItem {
  id: string;
  name: string;
}

interface ResidentCreatedPopupData {
  residentId: string;
  fullName: string;
  arabicFullName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  nationalIdNumber: string;
  passportNumber: string;
  residencyPermitNumber: string;
  taxNumber: string;
  mobileNumber: string;
  email: string;
  governorate: string;
  district: string;
  municipality: string;
  address: string;
  employmentStatus: string;
  occupation: string;
  monthlyIncome: number | null;
  kycStatus: string;
  riskCategory: string;
  walletAddress: string;
  walletCurrency: string;
  walletStatus: string;
  walletPassword: string;
  createdAt: string;
}

interface ResidentDraft {
  residentId: string;
  firstName: string;
  fatherName: string;
  motherName: string;
  lastName: string;
  fullName: string;
  arabicFullName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  nationalIdNumber: string;
  passportNumber: string;
  residencyPermitNumber: string;
  taxNumber: string;
  mobileNumber: string;
  email: string;
  governorate: string;
  district: string;
  municipality: string;
  address: string;
  employmentStatus: string;
  occupation: string;
  monthlyIncome: number | null;
  kycStatus: string;
  riskCategory: string;
  walletAddress: string;
  walletCurrency: string;
  walletStatus: string;
  walletPassword?: string;
  confirmWalletPassword?: string;
}

@Component({
  selector: 'app-create-resident-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-resident-account.component.html',
  styleUrl: './create-resident-account.component.scss',
})
export class CreateResidentAccountComponent implements OnInit {
  residentForm!: FormGroup;

  isSubmitting = signal(false);
  isWalletCreating = signal(false);
  isDraftSaving = signal(false);
  isKycSubmitting = signal(false);
  isReferenceLoading = signal(false);
  isResidentIdLoading = signal(false);

  submitted = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  showResidentCreatedPopup = signal(false);
  residentCreatedPopupData = signal<ResidentCreatedPopupData | null>(null);

  readonly pageTitle = 'Create Resident Account';
  readonly routePath = '/government-blockchain/create-resident-account';

  genders: LookupItem[] = [
    { id: 'Male', name: 'Male' },
    { id: 'Female', name: 'Female' },
    { id: 'Other', name: 'Other' },
  ];

  nationalities: LookupItem[] = [
    { id: 'Lebanese', name: 'Lebanese' },
    { id: 'Syrian', name: 'Syrian' },
    { id: 'Palestinian', name: 'Palestinian' },
    { id: 'Jordanian', name: 'Jordanian' },
    { id: 'Egyptian', name: 'Egyptian' },
    { id: 'Other', name: 'Other' },
  ];

  governorates: ResidentLookupItem[] = [];
  districts: ResidentLookupItem[] = [];
  municipalities: ResidentLookupItem[] = [];

  employmentStatuses: ResidentLookupItem[] = [];
  kycStatuses: ResidentLookupItem[] = [];
  riskCategories: ResidentLookupItem[] = [];

  walletCurrencies: LookupItem[] = [
    { id: 'LBP', name: 'LBP - Lebanese Pound' },
    { id: 'USD', name: 'USD - US Dollar' },
    { id: 'GOV', name: 'GOV - Government Digital Token' },
  ];

  walletStatuses: LookupItem[] = [
    { id: 'Not Created', name: 'Not Created' },
    { id: 'Pending', name: 'Pending' },
    { id: 'Active', name: 'Active' },
    { id: 'Suspended', name: 'Suspended' },
    { id: 'Blocked', name: 'Blocked' },
  ];

  formCompletion = computed(() => {
    if (!this.residentForm) return 0;

    const controls = Object.keys(this.residentForm.controls);
    const filledControls = controls.filter((key) => {
      const value = this.residentForm.get(key)?.value;
      return value !== null && value !== undefined && value !== '';
    });

    return Math.round((filledControls.length / controls.length) * 100);
  });

  constructor(
    private fb: FormBuilder,
    private residentApi: GovernmentBlockchainResidentApiService,
    private residentReferenceApi: ResidentReferenceApiService
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.registerNameAutoBuild();
    this.registerLocationDropdownEvents();
    this.loadReferenceData();
    this.loadNextResidentId();
  }

  private buildForm(): void {
    this.residentForm = this.fb.group(
      {
        residentId: [{ value: '', disabled: false }, [Validators.required, Validators.maxLength(50)]],

        firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
        fatherName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
        motherName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
        lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
        fullName: [{ value: '', disabled: false }, [Validators.required, Validators.maxLength(250)]],
        arabicFullName: ['', [Validators.required, Validators.maxLength(250)]],
        dateOfBirth: ['', [Validators.required, this.minimumAgeValidator(18)]],
        gender: ['', Validators.required],
        nationality: ['Lebanese', Validators.required],

        nationalIdNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{6,20}$/)]],
        passportNumber: ['', [Validators.maxLength(50)]],
        residencyPermitNumber: ['', [Validators.maxLength(50)]],
        taxNumber: ['', [Validators.maxLength(50)]],

        mobileNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s-]{8,20}$/)]],
        email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],

        governorate: ['', Validators.required],
        district: ['', Validators.required],
        municipality: ['', Validators.required],
        address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],

        employmentStatus: ['', Validators.required],
        occupation: ['', [Validators.maxLength(150)]],
        monthlyIncome: [null, [Validators.min(0), Validators.max(1000000000)]],

        kycStatus: ['DRAFT', Validators.required],
        riskCategory: ['LOW', Validators.required],

        walletAddress: [{ value: '', disabled: false }, [Validators.maxLength(150)]],
        walletCurrency: ['LBP', Validators.required],
        walletStatus: ['Not Created', Validators.required],

        /*
         * Wallet password is generated by backend after wallet/account creation.
         * It is displayed here only if backend returns it.
         */
        walletPassword: [{ value: '', disabled: false }],
        confirmWalletPassword: [{ value: '', disabled: false }],
      },
      {
        validators: [this.identityDocumentValidator],
      }
    );
  }

  private loadReferenceData(): void {
    this.isReferenceLoading.set(true);

    forkJoin({
      governorates: this.residentReferenceApi.getGovernorates(),
      kycStatuses: this.residentReferenceApi.getKycStatuses(),
      riskCategories: this.residentReferenceApi.getRiskCategories(),
      employmentStatuses: this.residentReferenceApi.getEmploymentStatuses(),
    }).subscribe({
      next: (response) => {
        this.isReferenceLoading.set(false);

        this.governorates = response.governorates?.data || [];
        this.kycStatuses = response.kycStatuses?.data || [];
        this.riskCategories = response.riskCategories?.data || [];
        this.employmentStatuses = response.employmentStatuses?.data || [];

        this.setDefaultValueIfEmpty('kycStatus', this.kycStatuses, 'DRAFT');
        this.setDefaultValueIfEmpty('riskCategory', this.riskCategories, 'LOW');
      },
      error: (error) => {
        this.isReferenceLoading.set(false);
        this.errorMessage.set(error?.error?.message || 'Failed to load resident reference dropdowns.');
        console.error('[Resident Reference API Error]', error);
      },
    });
  }

  private loadNextResidentId(): void {
    this.isResidentIdLoading.set(true);

    this.residentReferenceApi.getNextResidentId().subscribe({
      next: (response) => {
        this.isResidentIdLoading.set(false);

        if (response?.success && response?.data?.residentId) {
          this.residentForm.patchValue({
            residentId: response.data.residentId,
          });
        }
      },
      error: (error) => {
        this.isResidentIdLoading.set(false);
        this.errorMessage.set(error?.error?.message || 'Failed to generate resident ID from PostgreSQL sequence.');
        console.error('[Next Resident ID API Error]', error);
      },
    });
  }

  private registerLocationDropdownEvents(): void {
    this.residentForm.get('governorate')?.valueChanges.subscribe((governorateId: string) => {
      this.districts = [];
      this.municipalities = [];

      this.residentForm.patchValue(
        {
          district: '',
          municipality: '',
        },
        { emitEvent: false }
      );

      if (governorateId) {
        this.loadDistricts(governorateId);
      }
    });

    this.residentForm.get('district')?.valueChanges.subscribe((districtId: string) => {
      this.municipalities = [];

      this.residentForm.patchValue(
        {
          municipality: '',
        },
        { emitEvent: false }
      );

      if (districtId) {
        this.loadMunicipalities(districtId);
      }
    });
  }

  private loadDistricts(governorateId: string): void {
    this.residentReferenceApi.getDistricts(governorateId).subscribe({
      next: (response) => {
        this.districts = response?.data || [];
      },
      error: (error) => {
        this.districts = [];
        this.errorMessage.set(error?.error?.message || 'Failed to load districts.');
        console.error('[Districts API Error]', error);
      },
    });
  }

  private loadMunicipalities(districtId: string): void {
    this.residentReferenceApi.getMunicipalities(districtId).subscribe({
      next: (response) => {
        this.municipalities = response?.data || [];
      },
      error: (error) => {
        this.municipalities = [];
        this.errorMessage.set(error?.error?.message || 'Failed to load municipalities.');
        console.error('[Municipalities API Error]', error);
      },
    });
  }

  fillSampleData(): void {
    const beirutGovernorate = this.governorates.find((item) => item.code === 'BEIRUT');

    this.residentForm.patchValue({
      firstName: 'Nicolas',
      fatherName: 'Joseph',
      motherName: 'Mariam',
      lastName: 'Salloum',
      fullName: 'Nicolas Bernard Salloum',
      arabicFullName: 'نيكولا جوزيف سلوم',
      dateOfBirth: '1995-06-15',
      gender: 'Male',
      nationality: 'Lebanese',
      nationalIdNumber: '1234567890',
      passportNumber: 'RL1234567',
      residencyPermitNumber: '',
      taxNumber: 'TX-987654',
      mobileNumber: '+961 70 123 456',
      email: 'resident.demo@gov.lb',
      governorate: beirutGovernorate?.id || '',
      address: 'Beirut Central District, Lebanon',
      employmentStatus: 'EMPLOYED',
      occupation: 'Data Engineer',
      monthlyIncome: 25000000,
      kycStatus: 'DRAFT',
      riskCategory: 'LOW',
      walletAddress: '',
      walletCurrency: 'LBP',
      walletStatus: 'Not Created',
      walletPassword: '',
      confirmWalletPassword: '',
    });

    if (beirutGovernorate?.id) {
      this.loadDistricts(beirutGovernorate.id);

      setTimeout(() => {
        const beirutDistrict = this.districts.find((item) => item.code === 'BEIRUT');
        if (beirutDistrict?.id) {
          this.residentForm.patchValue({ district: beirutDistrict.id });
          this.loadMunicipalities(beirutDistrict.id);

          setTimeout(() => {
            const beirutMunicipality = this.municipalities.find(
              (item) => item.code === 'BEIRUT_MUNICIPALITY'
            );
            if (beirutMunicipality?.id) {
              this.residentForm.patchValue({ municipality: beirutMunicipality.id });
            }
          }, 300);
        }
      }, 300);
    }
  }

  private registerNameAutoBuild(): void {
    const nameFields = ['firstName', 'fatherName', 'lastName'];

    nameFields.forEach((field) => {
      this.residentForm.get(field)?.valueChanges.subscribe(() => {
        const firstName = this.residentForm.get('firstName')?.value || '';
        const fatherName = this.residentForm.get('fatherName')?.value || '';
        const lastName = this.residentForm.get('lastName')?.value || '';

        const fullName = [firstName, fatherName, lastName]
          .filter((value) => value && value.trim() !== '')
          .join(' ');

        this.residentForm.get('fullName')?.setValue(fullName, { emitEvent: false });
      });
    });
  }

  createResident(): void {
    this.submitted.set(true);
    this.clearMessages();

    if (this.residentForm.invalid) {
      this.residentForm.markAllAsTouched();
      this.errorMessage.set('Please complete all required resident information before creating the account.');
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.preparePayload();

    this.residentApi.createResident(payload).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);

        if (response?.success) {
          this.captureWalletPasswordFromResponse(response);
          this.openResidentCreatedPopup();
          this.successMessage.set('Resident account saved successfully to PostgreSQL and ready for blockchain wallet creation.');
        } else {
          this.errorMessage.set(response?.message || 'Resident save failed.');
        }
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(error?.error?.message || 'Resident save failed.');
        console.error('[Create Resident API Error]', error);
      },
    });
  }

  createWallet(): void {
    this.clearMessages();

    const residentId = this.residentForm.get('residentId')?.value;

    if (!residentId) {
      this.errorMessage.set('Resident ID is required before wallet creation.');
      return;
    }

    const requiredFields = [
      'residentId',
      'fullName',
      'nationalIdNumber',
      'mobileNumber',
      'email',
      'walletCurrency',
    ];

    const hasMissingRequiredWalletData = requiredFields.some((field) => {
      const control = this.residentForm.get(field);
      control?.markAsTouched();
      return control?.invalid;
    });

    if (hasMissingRequiredWalletData) {
      this.errorMessage.set('Please complete resident identity and contact information before wallet creation.');
      return;
    }

    this.isWalletCreating.set(true);

    const payload = {
      walletCurrency: this.residentForm.get('walletCurrency')?.value || 'LBP',
    };

    this.residentApi.createWallet(residentId, payload).subscribe({
      next: (response) => {
        this.isWalletCreating.set(false);

        if (response?.success) {
          const walletAddress =
            response?.data?.wallet?.wallet_address ||
            response?.data?.wallet?.walletAddress ||
            response?.data?.resident?.wallet_address ||
            response?.data?.resident?.walletAddress;

          const generatedPassword =
            response?.data?.temporaryPassword ||
            response?.data?.walletPassword ||
            response?.data?.generatedWalletPassword ||
            response?.data?.wallet_password ||
            response?.data?.accessCode ||
            response?.data?.wallet?.walletPassword ||
            response?.data?.wallet?.generatedPassword ||
            response?.data?.wallet?.accessCode ||
            response?.data?.resident?.walletPassword ||
            response?.data?.resident?.generatedPassword ||
            '';

          this.residentForm.patchValue({
            walletAddress: walletAddress || 'Created on Blockchain',
            walletStatus: 'Active',
            walletPassword: generatedPassword,
            confirmWalletPassword: generatedPassword,
          });

          this.captureWalletPasswordFromResponse(response);

          this.openResidentCreatedPopup();

          this.successMessage.set('Resident wallet created successfully. Wallet address and generated password are displayed if returned by backend.');
        } else {
          this.errorMessage.set(response?.message || 'Wallet creation failed.');
        }
      },
      error: (error) => {
        this.isWalletCreating.set(false);
        this.errorMessage.set(error?.error?.message || 'Wallet creation failed.');
        console.error('[Create Wallet API Error]', error);
      },
    });
  }

  saveDraft(): void {
    this.clearMessages();
    this.isDraftSaving.set(true);

    const payload = this.preparePayload();

    this.residentApi.saveDraft(payload).subscribe({
      next: (response) => {
        this.isDraftSaving.set(false);

        if (response?.success) {
          this.successMessage.set('Resident draft saved successfully to PostgreSQL.');
        } else {
          this.errorMessage.set(response?.message || 'Draft save failed.');
        }
      },
      error: (error) => {
        this.isDraftSaving.set(false);
        this.errorMessage.set(error?.error?.message || 'Draft save failed.');
        console.error('[Save Draft API Error]', error);
      },
    });
  }

  submitKyc(): void {
    this.submitted.set(true);
    this.clearMessages();

    if (this.residentForm.invalid) {
      this.residentForm.markAllAsTouched();
      this.errorMessage.set('Please complete the resident KYC information before submission.');
      return;
    }

    const residentId = this.residentForm.get('residentId')?.value;

    if (!residentId) {
      this.errorMessage.set('Resident ID is required before submitting KYC.');
      return;
    }

    this.isKycSubmitting.set(true);

    const payload = {
      kycStatus: 'PENDING_REVIEW',
      riskCategory: this.residentForm.get('riskCategory')?.value || 'LOW',
    };

    this.residentApi.submitKyc(residentId, payload).subscribe({
      next: (response) => {
        this.isKycSubmitting.set(false);

        if (response?.success) {
          this.residentForm.patchValue({
            kycStatus: 'PENDING_REVIEW',
          });

          this.successMessage.set('Resident KYC submitted successfully to PostgreSQL.');
        } else {
          this.errorMessage.set(response?.message || 'KYC submission failed.');
        }
      },
      error: (error) => {
        this.isKycSubmitting.set(false);
        this.errorMessage.set(error?.error?.message || 'KYC submission failed.');
        console.error('[Submit KYC API Error]', error);
      },
    });
  }

  resetForm(): void {
    this.submitted.set(false);
    this.clearMessages();
    this.residentForm.reset();

    this.districts = [];
    this.municipalities = [];

    this.residentForm.patchValue({
      kycStatus: 'DRAFT',
      riskCategory: 'LOW',
      nationality: 'Lebanese',
      walletCurrency: 'LBP',
      walletStatus: 'Not Created',
      walletPassword: '',
      confirmWalletPassword: '',
    });

    this.loadNextResidentId();
  }

  getFieldError(fieldName: string): string {
    const control = this.residentForm.get(fieldName);

    if (!control || !control.errors || (!control.touched && !this.submitted())) {
      return '';
    }

    if (control.errors['required']) return 'This field is required.';
    if (control.errors['email']) return 'Please enter a valid email address.';
    if (control.errors['minlength']) {
      return `Minimum length is ${control.errors['minlength'].requiredLength} characters.`;
    }
    if (control.errors['maxlength']) {
      return `Maximum length is ${control.errors['maxlength'].requiredLength} characters.`;
    }
    if (control.errors['pattern']) return 'Invalid format.';
    if (control.errors['min']) return 'Value cannot be negative.';
    if (control.errors['max']) return 'Value is too large.';
    if (control.errors['minimumAge']) return 'Resident must be at least 18 years old.';

    return 'Invalid value.';
  }

  hasFieldError(fieldName: string): boolean {
    const control = this.residentForm.get(fieldName);
    return !!control && control.invalid && (control.touched || this.submitted());
  }

  hasIdentityDocumentError(): boolean {
    return (
      !!this.residentForm.errors?.['identityDocumentRequired'] &&
      (this.submitted() ||
        !!this.residentForm.get('nationalIdNumber')?.touched ||
        !!this.residentForm.get('passportNumber')?.touched ||
        !!this.residentForm.get('residencyPermitNumber')?.touched)
    );
  }


  openResidentCreatedPopup(): void {
    const rawValue = this.residentForm.getRawValue();

    const selectedGovernorate = this.findLookupItem(this.governorates, rawValue.governorate);
    const selectedDistrict = this.findLookupItem(this.districts, rawValue.district);
    const selectedMunicipality = this.findLookupItem(this.municipalities, rawValue.municipality);
    const selectedEmploymentStatus = this.findLookupItem(this.employmentStatuses, rawValue.employmentStatus);
    const selectedKycStatus = this.findLookupItem(this.kycStatuses, rawValue.kycStatus);
    const selectedRiskCategory = this.findLookupItem(this.riskCategories, rawValue.riskCategory);

    this.residentCreatedPopupData.set({
      residentId: rawValue.residentId || '-',
      fullName: rawValue.fullName || '-',
      arabicFullName: rawValue.arabicFullName || '-',
      dateOfBirth: rawValue.dateOfBirth || '-',
      gender: rawValue.gender || '-',
      nationality: rawValue.nationality || '-',
      nationalIdNumber: rawValue.nationalIdNumber || '-',
      passportNumber: rawValue.passportNumber || '-',
      residencyPermitNumber: rawValue.residencyPermitNumber || '-',
      taxNumber: rawValue.taxNumber || '-',
      mobileNumber: rawValue.mobileNumber || '-',
      email: rawValue.email || '-',
      governorate: selectedGovernorate?.name || rawValue.governorate || '-',
      district: selectedDistrict?.name || rawValue.district || '-',
      municipality: selectedMunicipality?.name || rawValue.municipality || '-',
      address: rawValue.address || '-',
      employmentStatus: selectedEmploymentStatus?.name || rawValue.employmentStatus || '-',
      occupation: rawValue.occupation || '-',
      monthlyIncome: rawValue.monthlyIncome,
      kycStatus: selectedKycStatus?.name || rawValue.kycStatus || '-',
      riskCategory: selectedRiskCategory?.name || rawValue.riskCategory || '-',
      walletAddress: rawValue.walletAddress || 'Not Created Yet',
      walletCurrency: rawValue.walletCurrency || '-',
      walletStatus: rawValue.walletStatus || '-',
      walletPassword: rawValue.walletPassword || 'Generated password not returned by backend',
      createdAt: new Date().toLocaleString(),
    });

    this.showResidentCreatedPopup.set(true);
  }

  closeResidentCreatedPopup(): void {
    this.showResidentCreatedPopup.set(false);
  }

  printResidentCreatedPopup(): void {
    window.print();
  }

  private preparePayload(): ResidentDraft {
    const rawValue = this.residentForm.getRawValue();

    const selectedGovernorate = this.findLookupItem(this.governorates, rawValue.governorate);
    const selectedDistrict = this.findLookupItem(this.districts, rawValue.district);
    const selectedMunicipality = this.findLookupItem(this.municipalities, rawValue.municipality);
    const selectedEmploymentStatus = this.findLookupItem(this.employmentStatuses, rawValue.employmentStatus);
    const selectedKycStatus = this.findLookupItem(this.kycStatuses, rawValue.kycStatus);
    const selectedRiskCategory = this.findLookupItem(this.riskCategories, rawValue.riskCategory);

    return {
      residentId: rawValue.residentId,
      firstName: rawValue.firstName,
      fatherName: rawValue.fatherName,
      motherName: rawValue.motherName,
      lastName: rawValue.lastName,
      fullName: rawValue.fullName,
      arabicFullName: rawValue.arabicFullName,
      dateOfBirth: rawValue.dateOfBirth,
      gender: rawValue.gender,
      nationality: rawValue.nationality,
      nationalIdNumber: rawValue.nationalIdNumber,
      passportNumber: rawValue.passportNumber,
      residencyPermitNumber: rawValue.residencyPermitNumber,
      taxNumber: rawValue.taxNumber,
      mobileNumber: rawValue.mobileNumber,
      email: rawValue.email,

      /*
       * Form stores dropdown IDs for cascading.
       * Payload sends stable codes to PostgreSQL/backend.
       */
      governorate: selectedGovernorate?.code || rawValue.governorate,
      district: selectedDistrict?.code || rawValue.district,
      municipality: selectedMunicipality?.code || rawValue.municipality,

      address: rawValue.address,
      employmentStatus: selectedEmploymentStatus?.code || rawValue.employmentStatus,
      occupation: rawValue.occupation,
      monthlyIncome: rawValue.monthlyIncome,
      kycStatus: selectedKycStatus?.code || rawValue.kycStatus,
      riskCategory: selectedRiskCategory?.code || rawValue.riskCategory,
      walletAddress: rawValue.walletAddress,
      walletCurrency: rawValue.walletCurrency,
      walletStatus: rawValue.walletStatus,
      walletPassword: rawValue.walletPassword,
      confirmWalletPassword: rawValue.confirmWalletPassword,
    };
  }

  private findLookupItem(items: ResidentLookupItem[], idOrCode: string): ResidentLookupItem | undefined {
    return items.find((item) => item.id === idOrCode || item.code === idOrCode);
  }

  private setDefaultValueIfEmpty(
    controlName: string,
    items: ResidentLookupItem[],
    preferredCode: string
  ): void {
    const control = this.residentForm.get(controlName);

    if (!control || control.value) return;

    const preferredItem = items.find((item) => item.code === preferredCode);
    control.setValue(preferredItem?.id || preferredCode);
  }

  private captureWalletPasswordFromResponse(response: any): void {
    const generatedPassword =
      response?.data?.temporaryPassword ||
      response?.data?.walletPassword ||
      response?.data?.generatedWalletPassword ||
      response?.data?.wallet_password ||
      response?.data?.accessCode ||
      response?.data?.wallet?.walletPassword ||
      response?.data?.wallet?.generatedPassword ||
      response?.data?.wallet?.accessCode ||
      response?.data?.resident?.walletPassword ||
      response?.data?.resident?.generatedPassword ||
      '';

    if (generatedPassword) {
      this.residentForm.patchValue({
        walletPassword: generatedPassword,
        confirmWalletPassword: generatedPassword,
      });
    }
  }

  private clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  private minimumAgeValidator(minAge: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const birthDate = new Date(control.value);
      const today = new Date();

      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDifference = today.getMonth() - birthDate.getMonth();

      if (
        monthDifference < 0 ||
        (monthDifference === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }

      return age >= minAge ? null : { minimumAge: true };
    };
  }

  private identityDocumentValidator(group: AbstractControl): ValidationErrors | null {
    const nationalIdNumber = group.get('nationalIdNumber')?.value;
    const passportNumber = group.get('passportNumber')?.value;
    const residencyPermitNumber = group.get('residencyPermitNumber')?.value;

    if (nationalIdNumber || passportNumber || residencyPermitNumber) {
      return null;
    }

    return { identityDocumentRequired: true };
  }
}
