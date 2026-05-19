import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { finalize } from 'rxjs';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: any;
  requestId?: string;
}

interface CountryRef {
  couId: string;
  couName: string;
  isoCode: string;
}

interface OrganizationRef {
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  organizationType: string;
  registrationNumber?: string;
  countryCode?: string;
  status?: string;
}

interface SimpleRef {
  code: string;
  name: string;
  raw?: any;
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
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './blockchain-kyc.component.html',
  styleUrls: ['./blockchain-kyc.component.scss']
})
export class BlockchainKycComponent implements OnInit {
  private readonly API_BASE_URL = 'http://172.31.13.90:3001/api/v1';

  private readonly API_KEY =
    '20bd6a16f56de09bba960ebf3994fc2354c0a3f91fb2bd5743ad82cdeece29b5ff69cea9b3c85f56c187abc46de4491a';

  loading = false;
  referenceLoading = false;
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

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadReferenceData();
    this.generateCustomerId();
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'x-api-key': this.API_KEY,
      'x-request-source': 'BLOCKCHAIN_TEST_UI',
      'x-source-system': 'BLOCKCHAIN_TEST_UI'
    });
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
    this.referenceLoading = true;
    this.errorMessage = '';

    this.loadCountries();
    this.loadOrganizationTypes();
    this.loadOrganizations();
    this.loadSourceOfFunds();
    this.loadOccupations();
    this.loadEconomicSectors();

    setTimeout(() => {
      this.referenceLoading = false;
    }, 800);
  }

  generateCustomerId(): void {
    this.http
      .get<ApiResponse<any>>(`${this.API_BASE_URL}/reference/next-customer-id`, {
        headers: this.headers
      })
      .subscribe({
        next: (response) => {
          const customerId =
            response?.data?.customerId ||
            response?.data?.customer_id ||
            response?.data?.customerid ||
            '';

          this.form.customerId = String(customerId);
        },
        error: (error) => {
          console.error('[NEXT_CUSTOMER_ID_ERROR]', error);
          this.errorMessage = 'Failed to generate Customer ID from database sequence.';
        }
      });
  }

  loadCountries(): void {
    this.http
      .get<ApiResponse<any[]>>(`${this.API_BASE_URL}/reference/countries`, {
        headers: this.headers
      })
      .subscribe({
        next: (response) => {
          this.countries = (response.data || [])
            .map((row: any) => ({
              couId: String(row.couId || row.cou_id || row.id || ''),
              couName: String(row.couName || row.cou_name || row.name || '').trim(),
              isoCode: String(row.isoCode || row.iso_cou_code_alpha || row.iso_code || '').trim()
            }))
            .filter((item) => item.couName);
        },
        error: (error) => {
          console.error('[COUNTRIES_ERROR]', error);
          this.errorMessage = 'Failed to load Nationality and Country Of Residence.';
        }
      });
  }

  loadOrganizationTypes(): void {
    this.http
      .get<ApiResponse<any[]>>(`${this.API_BASE_URL}/reference/blockchain-organization-types`, {
        headers: this.headers
      })
      .subscribe({
        next: (response) => {
          this.organizationTypes = (response.data || [])
            .map((row: any) => row.organizationType || row.organization_type || row.type || row)
            .filter((value: any) => !!value)
            .map((value: any) => String(value).trim());
        },
        error: (error) => {
          console.error('[ORGANIZATION_TYPES_ERROR]', error);
          this.errorMessage = 'Failed to load Organization Types.';
        }
      });
  }

  loadOrganizations(): void {
    this.http
      .get<ApiResponse<any[]>>(`${this.API_BASE_URL}/reference/blockchain-organizations`, {
        headers: this.headers
      })
      .subscribe({
        next: (response) => {
          this.organizations = (response.data || [])
            .map((row: any) => ({
              organizationId: String(row.organizationId || row.organization_id || '').trim(),
              organizationCode: String(row.organizationCode || row.organization_code || '').trim(),
              organizationName: String(row.organizationName || row.organization_name || '').trim(),
              organizationType: String(row.organizationType || row.organization_type || '').trim(),
              registrationNumber: row.registration_number || row.registrationNumber || '',
              countryCode: row.country_code || row.countryCode || '',
              status: row.status || ''
            }))
            .filter((item) => item.organizationName);

          if (!this.organizationTypes.length) {
            this.organizationTypes = [
              ...new Set(this.organizations.map((item) => item.organizationType).filter(Boolean))
            ];
          }
        },
        error: (error) => {
          console.error('[ORGANIZATIONS_ERROR]', error);
          this.errorMessage = 'Failed to load Organizations.';
        }
      });
  }

  loadSourceOfFunds(): void {
    this.http
      .get<ApiResponse<any[]>>(`${this.API_BASE_URL}/reference/source-of-funds`, {
        headers: this.headers
      })
      .subscribe({
        next: (response) => {
          this.sourceOfFundsList = (response.data || [])
            .map((row: any) => this.normalizeSourceOfFunds(row))
            .filter((item) => item.name);
        },
        error: (error) => {
          console.error('[SOURCE_OF_FUNDS_ERROR]', error);
          this.errorMessage = 'Failed to load Source Of Funds.';
        }
      });
  }

  loadOccupations(): void {
    this.http
      .get<ApiResponse<any[]>>(`${this.API_BASE_URL}/reference/occupations`, {
        headers: this.headers
      })
      .subscribe({
        next: (response) => {
          this.occupations = (response.data || [])
            .map((row: any) => this.normalizeOccupation(row))
            .filter((item) => item.name);
        },
        error: (error) => {
          console.error('[OCCUPATIONS_ERROR]', error);
          this.errorMessage = 'Failed to load Occupations.';
        }
      });
  }

  loadEconomicSectors(): void {
    this.http
      .get<ApiResponse<any[]>>(`${this.API_BASE_URL}/reference/economic-sectors`, {
        headers: this.headers
      })
      .subscribe({
        next: (response) => {
          this.employmentSectors = (response.data || [])
            .map((row: any) => this.normalizeEconomicSector(row))
            .filter((item) => item.name);
        },
        error: (error) => {
          console.error('[ECONOMIC_SECTORS_ERROR]', error);
          this.errorMessage = 'Failed to load Employment Sectors.';
        }
      });
  }

  normalizeSourceOfFunds(row: any): SimpleRef {
    return {
      code: String(row.lin_code || row.code || row.id || '').trim(),
      name: String(row.lin_name || row.name || row.description || '').trim(),
      raw: row
    };
  }

  normalizeOccupation(row: any): SimpleRef {
    const values = Object.values(row || {}).filter(
      (value) => value !== null && value !== undefined && String(value).trim() !== ''
    );

    return {
      code: String(
        row.activity_sector_code ||
          row.occupation_code ||
          row.code ||
          row.id ||
          values[0] ||
          ''
      ).trim(),
      name: String(
        row.activity_sector_name ||
          row.occupation_name ||
          row.activity_sector_desc ||
          row.description ||
          row.name ||
          values.find((value) => typeof value === 'string' && String(value).length > 2) ||
          ''
      ).trim(),
      raw: row
    };
  }

  normalizeEconomicSector(row: any): SimpleRef {
    return {
      code: String(
        row.economic_sector_id ||
          row.economic_sector_internal_code ||
          row.lgcy_economic_sector_code ||
          row.code ||
          row.id ||
          ''
      ).trim(),
      name: String(
        row.economic_sector_desc ||
          row.central_bank_risk_center_desc ||
          row.lgcy_industry_level1_desc ||
          row.description ||
          row.name ||
          ''
      ).trim(),
      raw: row
    };
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
      (item) => item.organizationType === this.form.organizationType
    );
  }

  onOrganizationChange(): void {
    const selectedOrg = this.organizations.find(
      (item) => item.organizationName === this.form.organization
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
    this.form.nationality = 'Lebanon';
    this.form.countryOfResidence = 'Lebanon';

    this.form.mobileHash = 'HASHED_MOBILE_71970430';
    this.form.emailHash = 'HASHED_EMAIL_NSALLOUM95_GMAIL';
    this.form.nationalIdHash = 'HASHED_NATIONAL_ID_123456789';

    this.form.organizationType = 'INTERNATIONAL_ORGANIZATION';
    this.form.organization = 'UNDP Lebanon';
    this.form.organizationId = '5c4beb22-cfcd-4473-9966-3e8ddcd7a304';
    this.form.organizationCode = '149';

    this.form.city = 'Beirut';
    this.form.area = 'Achrafieh';
    this.form.addressHash = 'HASHED_ADDRESS_BEIRUT_ACHRAFIEH';

    this.form.sourceOfFunds = 'Business/ Trading';
    this.form.occupation = this.occupations[0]?.name || '';
    this.form.employmentSector = this.employmentSectors[0]?.name || '';
    this.form.monthlyIncome = 1500;
    this.form.expectedMonthlyTransactionVolume = 5000;
    this.form.expectedCashTransactions = 500;

    this.form.walletType = 'CUSTOMER';
    this.form.partyTypeCode = 7;
    this.form.walletStatus = 'ACTIVE';
    this.form.initialBalance = 1000;
    this.form.currencyCode = 'USD';
    this.form.dailyTransferLimit = 5000;
    this.form.monthlyTransferLimit = 50000;

    this.form.legalDocumentType = 'NATIONAL_ID';
    this.form.legalIdNumberHash = 'HASHED_LEGAL_ID_123456789';
    this.form.documentExpiryDate = '2030-12-31';
  }

  resetForm(): void {
    this.form = this.getEmptyForm();
    this.successMessage = '';
    this.errorMessage = '';
    this.generateCustomerId();
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
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, String(value));
      }
    });

    if (this.form.proofOfAddressFile) {
      formData.append('proofOfAddressFile', this.form.proofOfAddressFile);
    }

    if (this.form.documentFile) {
      formData.append('documentFile', this.form.documentFile);
    }

    this.http
      .post<ApiResponse<any>>(`${this.API_BASE_URL}/kyc/blockchain-wallet`, formData, {
        headers: this.headers
      })
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (response) => {
          this.successMessage =
            response.message || 'Blockchain KYC wallet request created successfully.';

          console.log('[BLOCKCHAIN_KYC_SUCCESS]', response);
        },
        error: (error) => {
          console.error('[BLOCKCHAIN_KYC_SUBMIT_ERROR]', error);

          this.errorMessage =
            error?.error?.message ||
            error?.error?.error?.message ||
            'Failed to create Blockchain KYC wallet request.';
        }
      });
  }
}