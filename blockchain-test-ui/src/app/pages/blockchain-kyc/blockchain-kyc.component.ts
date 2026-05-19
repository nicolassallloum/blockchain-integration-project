import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface BlockchainKycForm {
  customerId: string;

  organizationType: string;
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  branch: string;

  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  countryOfResidence: string;

  mobileHash: string;
  emailHash: string;
  nationalIdHash: string;

  city: string;
  area: string;
  addressHash: string;
  proofOfAddressHash: string;

  kycReferenceId: string;
  kycStatus: string;
  kycRiskCategory: string;
  pepFlag: boolean;
  sanctionScreeningStatus: string;

  sourceOfFunds: string;
  occupation: string;
  employmentSector: string;
  monthlyIncome: number | null;
  expectedMonthlyTransactionVolume: number | null;
  expectedCashTransactions: number | null;

  walletType: string;
  walletStatus: string;
  initialBalance: number | null;
  currencyCode: string;
  dailyTransferLimit: number | null;
  monthlyTransferLimit: number | null;
  generatedPassword: string;

  legalDocumentType: string;
  legalIdNumberHash: string;
  documentFileHash: string;
  documentVerificationStatus: string;
  documentExpiryDate: string;
}

@Component({
  selector: 'app-blockchain-kyc',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './blockchain-kyc.component.html',
  styleUrls: ['./blockchain-kyc.component.scss']
})
export class BlockchainKycComponent {
  loading = false;
  successMessage = '';
  errorMessage = '';

  organizationTypes = [
    'BANK',
    'FINTECH',
    'GOVERNMENT',
    'MERCHANT',
    'EXCHANGE',
    'INTERNATIONAL_ORGANIZATION',
    'OTHER'
  ];

  genders = ['MALE', 'FEMALE'];
  kycStatuses = ['DRAFT'];
  riskCategories = ['LOW', 'MEDIUM', 'HIGH'];
  sanctionStatuses = ['CLEAR', 'PENDING', 'MATCH_FOUND', 'REVIEW_REQUIRED'];
  walletTypes = ['CUSTOMER', 'COMPANY', 'ORGANIZATION'];
  walletStatuses = ['ACTIVE'];
  currencies = ['USD', 'LBP', 'EUR'];
  documentTypes = ['NATIONAL_ID', 'PASSPORT', 'RESIDENCY_CARD', 'DRIVING_LICENSE'];
  documentStatuses = ['VERIFIED', 'PENDING', 'REJECTED', 'EXPIRED'];

  form: BlockchainKycForm = this.getEmptyForm();

  getEmptyForm(): BlockchainKycForm {
    return {
      customerId: '',

      organizationType: 'INTERNATIONAL_ORGANIZATION',
      organizationId: '',
      organizationCode: '',
      organizationName: '',
      branch: '',

      firstName: '',
      middleName: '',
      lastName: '',
      fullName: '',
      dateOfBirth: '',
      gender: 'MALE',
      nationality: 'LB',
      countryOfResidence: 'LB',

      mobileHash: '',
      emailHash: '',
      nationalIdHash: '',

      city: '',
      area: '',
      addressHash: '',
      proofOfAddressHash: '',

      kycReferenceId: '',
      kycStatus: 'DRAFT',
      kycRiskCategory: 'LOW',
      pepFlag: false,
      sanctionScreeningStatus: 'CLEAR',

      sourceOfFunds: 'SALARY',
      occupation: '',
      employmentSector: '',
      monthlyIncome: null,
      expectedMonthlyTransactionVolume: null,
      expectedCashTransactions: null,

      walletType: 'CUSTOMER',
      walletStatus: 'ACTIVE',
      initialBalance: 1000,
      currencyCode: 'USD',
      dailyTransferLimit: 5000,
      monthlyTransferLimit: 50000,
      generatedPassword: this.generatePassword(),

      legalDocumentType: 'NATIONAL_ID',
      legalIdNumberHash: '',
      documentFileHash: '',
      documentVerificationStatus: 'VERIFIED',
      documentExpiryDate: ''
    };
  }

  updateFullName(): void {
    this.form.fullName = [
      this.form.firstName,
      this.form.middleName,
      this.form.lastName
    ]
      .filter(Boolean)
      .join(' ')
      .toUpperCase();
  }

  generateCustomerId(): void {
    this.form.customerId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  }

  generateKycReference(): void {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(10000 + Math.random() * 90000);
    this.form.kycReferenceId = `KYC-${datePart}-${randomPart}`;
  }

  generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
    let password = '';

    for (let i = 0; i < 14; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return password;
  }

  regeneratePassword(): void {
    this.form.generatedPassword = this.generatePassword();
  }

  fillSample(): void {
    this.form = {
      customerId: '3273944209',

      organizationType: 'INTERNATIONAL_ORGANIZATION',
      organizationId: '5c4beb22-cfcd-4473-9966-3e8ddcd7a304',
      organizationCode: '149',
      organizationName: 'UNDP Lebanon',
      branch: 'Beirut Main Branch',

      firstName: 'NICOLAS',
      middleName: '',
      lastName: 'SALLOUM',
      fullName: 'NICOLAS SALLOUM',
      dateOfBirth: '1996-01-01',
      gender: 'MALE',
      nationality: 'LB',
      countryOfResidence: 'LB',

      mobileHash: 'HASHED_MOBILE_71970430',
      emailHash: 'HASHED_EMAIL_NSALLOUM95_GMAIL',
      nationalIdHash: 'HASHED_NATIONAL_ID_123456789',

      city: 'Beirut',
      area: 'Achrafieh',
      addressHash: 'HASHED_ADDRESS_BEIRUT_ACHRAFIEH',
      proofOfAddressHash: 'HASHED_PROOF_OF_ADDRESS_FILE',

      kycReferenceId: 'KYC-20260519-00001',
      kycStatus: 'DRAFT',
      kycRiskCategory: 'LOW',
      pepFlag: false,
      sanctionScreeningStatus: 'CLEAR',

      sourceOfFunds: 'SALARY',
      occupation: 'DATA ENGINEER',
      employmentSector: 'TECHNOLOGY',
      monthlyIncome: 1500,
      expectedMonthlyTransactionVolume: 5000,
      expectedCashTransactions: 500,

      walletType: 'CUSTOMER',
      walletStatus: 'ACTIVE',
      initialBalance: 1000,
      currencyCode: 'USD',
      dailyTransferLimit: 5000,
      monthlyTransferLimit: 50000,
      generatedPassword: this.generatePassword(),

      legalDocumentType: 'NATIONAL_ID',
      legalIdNumberHash: 'HASHED_LEGAL_ID_123456789',
      documentFileHash: 'HASHED_DOCUMENT_FILE_SHA256',
      documentVerificationStatus: 'VERIFIED',
      documentExpiryDate: '2030-12-31'
    };
  }

  resetForm(): void {
    this.form = this.getEmptyForm();
    this.successMessage = '';
    this.errorMessage = '';
  }

  buildPayload(): any {
    return {
      customerId: this.form.customerId,
      organizationType: this.form.organizationType,
      organizationId: this.form.organizationId,
      organizationCode: this.form.organizationCode,
      organizationName: this.form.organizationName,
      branch: this.form.branch,

      firstName: this.form.firstName,
      middleName: this.form.middleName,
      lastName: this.form.lastName,
      fullName: this.form.fullName,
      dateOfBirth: this.form.dateOfBirth,
      gender: this.form.gender,
      nationality: this.form.nationality,
      countryOfResidence: this.form.countryOfResidence,

      mobileHash: this.form.mobileHash,
      emailHash: this.form.emailHash,
      nationalIdHash: this.form.nationalIdHash,

      city: this.form.city,
      area: this.form.area,
      addressHash: this.form.addressHash,
      proofOfAddressHash: this.form.proofOfAddressHash,

      kycReferenceId: this.form.kycReferenceId,
      kycStatus: this.form.kycStatus,
      kycRiskCategory: this.form.kycRiskCategory,
      pepFlag: this.form.pepFlag,
      sanctionScreeningStatus: this.form.sanctionScreeningStatus,

      sourceOfFunds: this.form.sourceOfFunds,
      occupation: this.form.occupation,
      employmentSector: this.form.employmentSector,
      monthlyIncome: this.form.monthlyIncome,
      expectedMonthlyTransactionVolume: this.form.expectedMonthlyTransactionVolume,
      expectedCashTransactions: this.form.expectedCashTransactions,

      walletType: this.form.walletType,
      walletStatus: this.form.walletStatus,
      initialBalance: this.form.initialBalance,
      currencyCode: this.form.currencyCode,
      dailyTransferLimit: this.form.dailyTransferLimit,
      monthlyTransferLimit: this.form.monthlyTransferLimit,
      password: this.form.generatedPassword,

      legalDocumentType: this.form.legalDocumentType,
      legalIdNumberHash: this.form.legalIdNumberHash,
      documentFileHash: this.form.documentFileHash,
      documentVerificationStatus: this.form.documentVerificationStatus,
      documentExpiryDate: this.form.documentExpiryDate
    };
  }

  submitKycWallet(): void {
    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    const payload = this.buildPayload();

    console.log('Blockchain KYC Wallet Payload:', payload);

    setTimeout(() => {
      this.loading = false;
      this.successMessage = 'Blockchain KYC wallet payload generated successfully. Connect this screen to the backend API when ready.';
    }, 600);
  }
}
