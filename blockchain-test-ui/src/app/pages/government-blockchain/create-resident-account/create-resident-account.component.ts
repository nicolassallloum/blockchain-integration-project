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

interface LookupItem {
  id: string;
  name: string;
}
import {
  GovernmentBlockchainResidentApiService,
  CreateResidentPayload,
} from '../../../services/government-blockchain-resident-api.service';
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

  submitted = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

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

  governorates: LookupItem[] = [
    { id: 'Beirut', name: 'Beirut' },
    { id: 'Mount Lebanon', name: 'Mount Lebanon' },
    { id: 'North Lebanon', name: 'North Lebanon' },
    { id: 'South Lebanon', name: 'South Lebanon' },
    { id: 'Bekaa', name: 'Bekaa' },
    { id: 'Nabatieh', name: 'Nabatieh' },
    { id: 'Baalbek-Hermel', name: 'Baalbek-Hermel' },
    { id: 'Akkar', name: 'Akkar' },
  ];

  districts: LookupItem[] = [
    { id: 'Beirut', name: 'Beirut' },
    { id: 'Baabda', name: 'Baabda' },
    { id: 'Metn', name: 'Metn' },
    { id: 'Keserwan', name: 'Keserwan' },
    { id: 'Tripoli', name: 'Tripoli' },
    { id: 'Zahle', name: 'Zahle' },
    { id: 'Saida', name: 'Saida' },
    { id: 'Tyre', name: 'Tyre' },
    { id: 'Nabatieh', name: 'Nabatieh' },
  ];

  municipalities: LookupItem[] = [
    { id: 'Beirut Municipality', name: 'Beirut Municipality' },
    { id: 'Baabda Municipality', name: 'Baabda Municipality' },
    { id: 'Jdeideh Municipality', name: 'Jdeideh Municipality' },
    { id: 'Jounieh Municipality', name: 'Jounieh Municipality' },
    { id: 'Tripoli Municipality', name: 'Tripoli Municipality' },
    { id: 'Zahle Municipality', name: 'Zahle Municipality' },
    { id: 'Saida Municipality', name: 'Saida Municipality' },
    { id: 'Tyre Municipality', name: 'Tyre Municipality' },
  ];

  employmentStatuses: LookupItem[] = [
    { id: 'Employed', name: 'Employed' },
    { id: 'Self-Employed', name: 'Self-Employed' },
    { id: 'Unemployed', name: 'Unemployed' },
    { id: 'Student', name: 'Student' },
    { id: 'Retired', name: 'Retired' },
  ];

  kycStatuses: LookupItem[] = [
    { id: 'Draft', name: 'Draft' },
    { id: 'Pending Review', name: 'Pending Review' },
    { id: 'Verified', name: 'Verified' },
    { id: 'Rejected', name: 'Rejected' },
  ];

  riskCategories: LookupItem[] = [
    { id: 'Low', name: 'Low Risk' },
    { id: 'Medium', name: 'Medium Risk' },
    { id: 'High', name: 'High Risk' },
  ];

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
    private residentApi: GovernmentBlockchainResidentApiService
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadStaticSampleData();
    this.registerNameAutoBuild();
  }

  private buildForm(): void {
    this.residentForm = this.fb.group(
      {
        residentId: ['', [Validators.required, Validators.maxLength(50)]],

        firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
        fatherName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
        motherName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
        lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
        fullName: [{ value: '', disabled: false }, [Validators.required, Validators.maxLength(250)]],
        arabicFullName: ['', [Validators.required, Validators.maxLength(250)]],
        dateOfBirth: ['', [Validators.required, this.minimumAgeValidator(18)]],
        gender: ['', Validators.required],
        nationality: ['', Validators.required],

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

        kycStatus: ['Draft', Validators.required],
        riskCategory: ['Low', Validators.required],

        walletAddress: [{ value: '', disabled: false }, [Validators.maxLength(150)]],
        walletCurrency: ['LBP', Validators.required],
        walletStatus: ['Not Created', Validators.required],
      },
      {
        validators: [this.identityDocumentValidator],
      }
    );
  }

  private loadStaticSampleData(): void {
    const generatedResidentId = this.generateResidentId();

    this.residentForm.patchValue({
      residentId: generatedResidentId,
      firstName: 'Nicolas',
      fatherName: 'Joseph',
      motherName: 'Mariam',
      lastName: 'Salloum',
      fullName: 'Nicolas Joseph Salloum',
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
      governorate: 'Beirut',
      district: 'Beirut',
      municipality: 'Beirut Municipality',
      address: 'Beirut Central District, Lebanon',
      employmentStatus: 'Employed',
      occupation: 'Data Engineer',
      monthlyIncome: 25000000,
      kycStatus: 'Draft',
      riskCategory: 'Low',
      walletAddress: '',
      walletCurrency: 'LBP',
      walletStatus: 'Not Created',
    });
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
          this.successMessage.set('Resident account saved successfully to PostgreSQL.');
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
            response?.data?.resident?.wallet_address;

          this.residentForm.patchValue({
            walletAddress,
            walletStatus: 'Active',
          });

          this.successMessage.set('Resident wallet saved successfully to PostgreSQL.');
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
      kycStatus: 'Pending Review',
      riskCategory: this.residentForm.get('riskCategory')?.value || 'Low',
    };

    this.residentApi.submitKyc(residentId, payload).subscribe({
      next: (response) => {
        this.isKycSubmitting.set(false);

        if (response?.success) {
          this.residentForm.patchValue({
            kycStatus: 'Pending Review',
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
    this.residentForm.patchValue({
      residentId: this.generateResidentId(),
      kycStatus: 'Draft',
      riskCategory: 'Low',
      walletCurrency: 'LBP',
      walletStatus: 'Not Created',
    });
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

  private preparePayload(): ResidentDraft {
    const rawValue = this.residentForm.getRawValue();

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
      governorate: rawValue.governorate,
      district: rawValue.district,
      municipality: rawValue.municipality,
      address: rawValue.address,
      employmentStatus: rawValue.employmentStatus,
      occupation: rawValue.occupation,
      monthlyIncome: rawValue.monthlyIncome,
      kycStatus: rawValue.kycStatus,
      riskCategory: rawValue.riskCategory,
      walletAddress: rawValue.walletAddress,
      walletCurrency: rawValue.walletCurrency,
      walletStatus: rawValue.walletStatus,
    };
  }

  private generateResidentId(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `RES-${datePart}-${randomPart}`;
  }

  private generateWalletAddress(): string {
    const randomOne = Math.random().toString(16).substring(2, 10);
    const randomTwo = Math.random().toString(16).substring(2, 10);
    const randomThree = Math.random().toString(16).substring(2, 10);
    return `0xRES${randomOne}${randomTwo}${randomThree}`.toUpperCase();
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
