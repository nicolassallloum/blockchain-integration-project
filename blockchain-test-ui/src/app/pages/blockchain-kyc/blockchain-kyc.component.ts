import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface CountryRef {
  couName: string;
}

interface OrganizationRef {
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  organizationType: string;
}

interface SimpleRef {
  code?: string;
  name: string;
}

interface BlockchainKycForm {
  customerId: string;

  nationality: string;
  countryOfResidence: string;

  mobileHash: string;
  emailHash: string;
  nationalIdHash: string;

  organizationType: string;
  organization: string;
  organizationId: string;
  organizationCode: string;

  city: string;
  area: string;
  addressHash: string;
  proofOfAddressFile: File | null;

  sourceOfFunds: string;
  occupation: string;
  employmentSector: string;
  monthlyIncome: number | null;
  expectedMonthlyTransactionVolume: number | null;
  expectedCashTransactions: number | null;

  walletType: string;
  partyTypeCode: number | null;
  walletStatus: string;
  initialBalance: number | null;
  currencyCode: string;
  dailyTransferLimit: number | null;
  monthlyTransferLimit: number | null;
  generatedPassword: string;

  legalDocumentType: string;
  legalIdNumberHash: string;
  documentFile: File | null;
  documentExpiryDate: string;
}

@Component({
  selector: 'app-blockchain-kyc',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './blockchain-kyc.component.html',
  styleUrls: ['./blockchain-kyc.component.scss']
})
export class BlockchainKycComponent implements OnInit {
  loading = false;
  successMessage = '';
  errorMessage = '';

  countries: CountryRef[] = [];
  organizations: OrganizationRef[] = [];
  organizationTypes: string[] = [];

  sourceOfFundsList: SimpleRef[] = [];
  occupations: SimpleRef[] = [];
  employmentSectors: SimpleRef[] = [];

  walletTypes = ['CUSTOMER', 'ORGANIZATION'];
  walletStatuses = ['ACTIVE'];
  currencies = ['USD', 'LBP', 'EUR'];
  documentTypes = ['NATIONAL_ID', 'PASSPORT', 'RESIDENCY_CARD', 'DRIVING_LICENSE'];

  form: BlockchainKycForm = this.getEmptyForm();

  ngOnInit(): void {
    this.loadReferenceData();
    this.generateCustomerId();
  }

  getEmptyForm(): BlockchainKycForm {
    return {
      customerId: '',

      nationality: '',
      countryOfResidence: '',

      mobileHash: '',
      emailHash: '',
      nationalIdHash: '',

      organizationType: '',
      organization: '',
      organizationId: '',
      organizationCode: '',

      city: '',
      area: '',
      addressHash: '',
      proofOfAddressFile: null,

      sourceOfFunds: '',
      occupation: '',
      employmentSector: '',
      monthlyIncome: null,
      expectedMonthlyTransactionVolume: null,
      expectedCashTransactions: null,

      walletType: 'CUSTOMER',
      partyTypeCode: 7,
      walletStatus: 'ACTIVE',
      initialBalance: 0,
      currencyCode: 'USD',
      dailyTransferLimit: 5000,
      monthlyTransferLimit: 50000,
      generatedPassword: this.generatePassword(),

      legalDocumentType: 'NATIONAL_ID',
      legalIdNumberHash: '',
      documentFile: null,
      documentExpiryDate: ''
    };
  }

  loadReferenceData(): void {
    /**
     * Replace this sample data later with backend API calls:
     *
     * GET /api/v1/reference/countries
     * GET /api/v1/reference/blockchain-organization-types
     * GET /api/v1/reference/blockchain-organizations
     * GET /api/v1/reference/source-of-funds
     * GET /api/v1/reference/occupations
     * GET /api/v1/reference/economic-sectors
     */

    this.countries = [
      { couName: 'Lebanon' },
      { couName: 'United Arab Emirates' },
      { couName: 'Saudi Arabia' },
      { couName: 'France' },
      { couName: 'United States' }
    ];

    this.organizations = [
      {
        organizationId: '5c4beb22-cfcd-4473-9966-3e8ddcd7a304',
        organizationCode: '149',
        organizationName: 'UNDP Lebanon',
        organizationType: 'INTERNATIONAL_ORGANIZATION'
      },
      {
        organizationId: '11111111-1111-1111-1111-111111111111',
        organizationCode: '001',
        organizationName: 'Bank A',
        organizationType: 'BANK'
      },
      {
        organizationId: '22222222-2222-2222-2222-222222222222',
        organizationCode: '002',
        organizationName: 'Fintech X',
        organizationType: 'FINTECH'
      }
    ];

    this.organizationTypes = [
      ...new Set(this.organizations.map(item => item.organizationType))
    ];

    this.sourceOfFundsList = [
      { code: 'SALARY', name: 'Salary' },
      { code: 'BUSINESS', name: 'Business Income' },
      { code: 'SAVINGS', name: 'Savings' },
      { code: 'REMITTANCE', name: 'Remittance' }
    ];

    this.occupations = [
      { code: 'DATA_ENGINEER', name: 'Data Engineer' },
      { code: 'EMPLOYEE', name: 'Employee' },
      { code: 'BUSINESS_OWNER', name: 'Business Owner' },
      { code: 'STUDENT', name: 'Student' }
    ];

    this.employmentSectors = [
      { code: 'TECHNOLOGY', name: 'Technology' },
      { code: 'BANKING', name: 'Banking' },
      { code: 'GOVERNMENT', name: 'Government' },
      { code: 'RETAIL', name: 'Retail' }
    ];
  }

  generateCustomerId(): void {
    /**
     * Later this should call backend:
     *
     * GET /api/v1/reference/next-customer-id
     *
     * Backend SQL example:
     * SELECT nextval('sdedba.s_customer') AS customer_id;
     */
    this.form.customerId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  }

  onOrganizationTypeChange(): void {
    this.form.organization = '';
    this.form.organizationId = '';
    this.form.organizationCode = '';
  }

  get filteredOrganizations(): OrganizationRef[] {
    if (!this.form.organizationType) {
      return this.organizations;
    }

    return this.organizations.filter(
      item => item.organizationType === this.form.organizationType
    );
  }

  onOrganizationChange(): void {
    const selectedOrg = this.organizations.find(
      item => item.organizationName === this.form.organization
    );

    if (!selectedOrg) {
      this.form.organizationId = '';
      this.form.organizationCode = '';
      return;
    }

    this.form.organizationId = selectedOrg.organizationId;
    this.form.organizationCode = selectedOrg.organizationCode;
    this.form.organizationType = selectedOrg.organizationType;
  }

  onWalletTypeChange(): void {
    if (this.form.walletType === 'CUSTOMER') {
      this.form.partyTypeCode = 7;
    } else if (this.form.walletType === 'ORGANIZATION') {
      this.form.partyTypeCode = 8;
    } else {
      this.form.partyTypeCode = null;
    }
  }

  onProofOfAddressFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.proofOfAddressFile = input.files?.[0] || null;
  }

  onDocumentFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.documentFile = input.files?.[0] || null;
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

      nationality: 'Lebanon',
      countryOfResidence: 'Lebanon',

      mobileHash: 'HASHED_MOBILE_71970430',
      emailHash: 'HASHED_EMAIL_NSALLOUM95_GMAIL',
      nationalIdHash: 'HASHED_NATIONAL_ID_123456789',

      organizationType: 'INTERNATIONAL_ORGANIZATION',
      organization: 'UNDP Lebanon',
      organizationId: '5c4beb22-cfcd-4473-9966-3e8ddcd7a304',
      organizationCode: '149',

      city: 'Beirut',
      area: 'Achrafieh',
      addressHash: 'HASHED_ADDRESS_BEIRUT_ACHRAFIEH',
      proofOfAddressFile: null,

      sourceOfFunds: 'Salary',
      occupation: 'Data Engineer',
      employmentSector: 'Technology',
      monthlyIncome: 1500,
      expectedMonthlyTransactionVolume: 5000,
      expectedCashTransactions: 500,

      walletType: 'CUSTOMER',
      partyTypeCode: 7,
      walletStatus: 'ACTIVE',
      initialBalance: 1000,
      currencyCode: 'USD',
      dailyTransferLimit: 5000,
      monthlyTransferLimit: 50000,
      generatedPassword: this.generatePassword(),

      legalDocumentType: 'NATIONAL_ID',
      legalIdNumberHash: 'HASHED_LEGAL_ID_123456789',
      documentFile: null,
      documentExpiryDate: '2030-12-31'
    };
  }

  resetForm(): void {
    this.form = this.getEmptyForm();
    this.generateCustomerId();
    this.successMessage = '';
    this.errorMessage = '';
  }

  buildPayload(): any {
    return {
      customerId: this.form.customerId,

      nationality: this.form.nationality,
      countryOfResidence: this.form.countryOfResidence,

      mobileHash: this.form.mobileHash,
      emailHash: this.form.emailHash,
      nationalIdHash: this.form.nationalIdHash,

      organizationType: this.form.organizationType,
      organizationId: this.form.organizationId,
      organizationCode: this.form.organizationCode,
      organization: this.form.organization,

      city: this.form.city,
      area: this.form.area,
      addressHash: this.form.addressHash,
      proofOfAddressFileName: this.form.proofOfAddressFile?.name || null,

      sourceOfFunds: this.form.sourceOfFunds,
      occupation: this.form.occupation,
      employmentSector: this.form.employmentSector,
      monthlyIncome: this.form.monthlyIncome,
      expectedMonthlyTransactionVolume: this.form.expectedMonthlyTransactionVolume,
      expectedCashTransactions: this.form.expectedCashTransactions,

      walletType: this.form.walletType,
      partyTypeCode: this.form.partyTypeCode,
      walletStatus: this.form.walletStatus,
      initialBalance: this.form.initialBalance,
      currencyCode: this.form.currencyCode,
      dailyTransferLimit: this.form.dailyTransferLimit,
      monthlyTransferLimit: this.form.monthlyTransferLimit,
      password: this.form.generatedPassword,

      legalDocumentType: this.form.legalDocumentType,
      legalIdNumberHash: this.form.legalIdNumberHash,
      documentFileName: this.form.documentFile?.name || null,
      documentExpiryDate: this.form.documentExpiryDate
    };
  }

  submitKycWallet(): void {
    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    const formData = new FormData();

    const payload = this.buildPayload();

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

    if (this.form.proofOfAddressFile) {
      formData.append('proofOfAddressFile', this.form.proofOfAddressFile);
    }

    if (this.form.documentFile) {
      formData.append('documentFile', this.form.documentFile);
    }

    console.log('Blockchain KYC Payload:', payload);
    console.log('Blockchain KYC FormData:', formData);

    /**
     * Later connect to backend:
     *
     * POST /api/v1/kyc/blockchain-wallet
     *
     * Because this screen includes file uploads,
     * request content type should be multipart/form-data.
     */

    setTimeout(() => {
      this.loading = false;
      this.successMessage = 'Blockchain KYC payload generated successfully.';
    }, 600);
  }
}