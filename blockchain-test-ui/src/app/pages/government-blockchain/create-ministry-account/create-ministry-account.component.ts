import { CommonModule } from '@angular/common';

import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, ViewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

interface CsvMinistryRow {
  rowNumber: number;
  ministryId: string;
  ministryCode: string;
  ministryName: string;
  arabicName: string;
  ministryType: string;
  parentMinistry: string;
  ministerName: string;
  contactPerson: string;
  contactEmail: string;
  contactMobile: string;
  country: string;
  governorate: string;
  address: string;
  walletAddress: string;
  walletCurrency: string;
  walletStatus: string;
  blockchainStatus: string;
  errors: string[];
}

@Component({
  selector: 'app-create-ministry-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-ministry-account.component.html',
  styleUrl: './create-ministry-account.component.scss',
})
export class CreateMinistryAccountComponent {
  @ViewChild('csvFileInput') csvFileInput?: ElementRef<HTMLInputElement>;

  ministryAccountForm: FormGroup;

  isSubmitting = false;
  isDraftSaving = false;
  isWalletCreating = false;
  isBulkUploading = false;

  selectedCsvFileName = '';
  csvRows: CsvMinistryRow[] = [];
  validCsvRows: CsvMinistryRow[] = [];
  invalidCsvRows: CsvMinistryRow[] = [];

  createdMinistryId = '';
  createdWalletAddress = '';
  createdBlockchainStatus = '';
  createdWalletCurrency = '';

  ministryTypes: string[] = [
    'Central Government Ministry',
    'Public Administration',
    'Independent Authority',
    'Government Agency',
    'Municipality',
    'Governorate Office',
    'Public Institution',
  ];

  parentMinistries: string[] = [
    'None',
    'Prime Minister Office',
    'Ministry of Finance',
    'Ministry of Interior and Municipalities',
    'Ministry of Justice',
    'Ministry of Public Health',
    'Ministry of Education',
    'Ministry of Economy and Trade',
  ];

  countries: string[] = ['Lebanon', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Jordan'];

  governorates: string[] = [
    'Beirut',
    'Mount Lebanon',
    'North Lebanon',
    'Akkar',
    'Baalbek-Hermel',
    'Bekaa',
    'Nabatieh',
    'South Lebanon',
  ];

  walletCurrencies: string[] = ['LBP', 'USD', 'GOV'];

  walletStatuses: string[] = ['PENDING_CREATION', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'CLOSED'];

  blockchainStatuses: string[] = ['NOT_SUBMITTED', 'PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED'];

  blockchainNetworks: string[] = ['Hyperledger Fabric'];

  fabricChannels: string[] = ['kycchannelnix1', 'government-channel'];

  chaincodes: string[] = ['kyc-wallet-chaincode-js', 'government-services-chaincode'];

    constructor(
    private fb: FormBuilder,
    private http: HttpClient
    ) {
    this.ministryAccountForm = this.fb.group({
        ministryId: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
        ministryCode: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30)]],
        ministryName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
        arabicName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
        ministryType: ['', Validators.required],
        parentMinistry: ['None'],
        ministerName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
        contactPerson: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
        contactEmail: ['', [Validators.required, Validators.email]],
        contactMobile: ['', Validators.required],
        country: ['Lebanon', Validators.required],
        governorate: ['', Validators.required],
        address: ['', Validators.required],
        walletAddress: [''],
        walletCurrency: ['LBP', Validators.required],
        walletStatus: ['PENDING_CREATION', Validators.required],
        blockchainNetwork: ['Hyperledger Fabric', Validators.required],
        blockchainChannel: ['kycchannelnix1', Validators.required],
        chaincodeName: ['kyc-wallet-chaincode-js', Validators.required],
        blockchainStatus: ['NOT_SUBMITTED', Validators.required],
        blockchainProofHash: [''],
    });
    }
  createMinistry(): void {
    if (this.ministryAccountForm.invalid) {
      this.ministryAccountForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const payload = this.buildMinistryPayload();

    console.log('CREATE MINISTRY PAYLOAD READY FOR API:', payload);

    /*
      TODO Backend API:
      POST /api/v1/government-blockchain/ministries
      Body: payload
    */

    setTimeout(() => {
      this.createdMinistryId = payload.ministry.ministryId;
      this.createdWalletCurrency = payload.wallet.walletCurrency;
      this.createdBlockchainStatus = payload.blockchain.blockchainStatus;
      this.isSubmitting = false;
      alert('Ministry account payload prepared successfully.');
    }, 600);
  }

  createWallet(): void {
    const ministryId = this.ministryAccountForm.get('ministryId')?.value;
    const ministryCode = this.ministryAccountForm.get('ministryCode')?.value;

    if (!ministryId || !ministryCode) {
      this.ministryAccountForm.get('ministryId')?.markAsTouched();
      this.ministryAccountForm.get('ministryCode')?.markAsTouched();
      alert('Please enter Ministry ID and Ministry Code before creating wallet.');
      return;
    }

    this.isWalletCreating = true;

    const walletAddress = `GOV-MIN-${ministryCode}-${Date.now()}`.toUpperCase();

    /*
      TODO Backend API:
      POST /api/v1/government-blockchain/wallets/ministry
      Body:
      {
        ministryId,
        ministryCode,
        walletCurrency,
        walletStatus
      }
    */

    setTimeout(() => {
      this.ministryAccountForm.patchValue({
        walletAddress,
        walletStatus: 'ACTIVE',
        blockchainStatus: 'PENDING',
      });

      this.createdWalletAddress = walletAddress;
      this.createdWalletCurrency = this.ministryAccountForm.get('walletCurrency')?.value;
      this.isWalletCreating = false;
    }, 600);
  }

  saveDraft(): void {
    this.isDraftSaving = true;

    const draftPayload = {
      draftType: 'CREATE_MINISTRY_ACCOUNT',
      savedAt: new Date().toISOString(),
      formData: this.ministryAccountForm.getRawValue(),
    };

    console.log('SAVE DRAFT PAYLOAD READY FOR API:', draftPayload);

    /*
      TODO Backend API:
      POST /api/v1/government-blockchain/drafts/ministry
      Body: draftPayload
    */

    this.http.post('/api/v1/government-blockchain/drafts/ministry', draftPayload).subscribe({
      next: () => {
        this.isDraftSaving = false;
        alert('Draft saved locally / payload prepared.');
      },
      error: (error) => {
        console.error('Error saving draft:', error);
        this.isDraftSaving = false;
        alert('Error occurred while saving draft.');
      }
    });
  }

  resetForm(): void {
    this.ministryAccountForm.reset({
      parentMinistry: 'None',
      country: 'Lebanon',
      walletCurrency: 'LBP',
      walletStatus: 'PENDING_CREATION',
      blockchainNetwork: 'Hyperledger Fabric',
      blockchainChannel: 'kycchannelnix1',
      chaincodeName: 'kyc-wallet-chaincode-js',
      blockchainStatus: 'NOT_SUBMITTED',
    });

    this.createdMinistryId = '';
    this.createdWalletAddress = '';
    this.createdBlockchainStatus = '';
    this.createdWalletCurrency = '';
  }

  onCsvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please upload a valid CSV file.');
      this.clearCsvFile();
      return;
    }

    this.selectedCsvFileName = file.name;

    const reader = new FileReader();

    reader.onload = () => {
      const csvText = String(reader.result || '');
      this.parseCsv(csvText);
    };

    reader.readAsText(file);
  }

  parseCsv(csvText: string): void {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      alert('CSV file must include a header row and at least one data row.');
      this.clearCsvFile();
      return;
    }

    const headers = this.splitCsvLine(lines[0]).map((h) => h.trim());

    const requiredHeaders = [
      'ministryId',
      'ministryCode',
      'ministryName',
      'arabicName',
      'ministryType',
      'parentMinistry',
      'ministerName',
      'contactPerson',
      'contactEmail',
      'contactMobile',
      'country',
      'governorate',
      'address',
      'walletAddress',
      'walletCurrency',
      'walletStatus',
      'blockchainStatus',
    ];

    const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

    if (missingHeaders.length > 0) {
      alert(`CSV is missing required columns: ${missingHeaders.join(', ')}`);
      this.clearCsvFile();
      return;
    }

    const parsedRows: CsvMinistryRow[] = lines.slice(1).map((line, index) => {
      const values = this.splitCsvLine(line);
      const rowObject: Record<string, string> = {};

      headers.forEach((header, headerIndex) => {
        rowObject[header] = values[headerIndex]?.trim() || '';
      });

      const row: CsvMinistryRow = {
        rowNumber: index + 2,
        ministryId: rowObject['ministryId'],
        ministryCode: rowObject['ministryCode'],
        ministryName: rowObject['ministryName'],
        arabicName: rowObject['arabicName'],
        ministryType: rowObject['ministryType'],
        parentMinistry: rowObject['parentMinistry'] || 'None',
        ministerName: rowObject['ministerName'],
        contactPerson: rowObject['contactPerson'],
        contactEmail: rowObject['contactEmail'],
        contactMobile: rowObject['contactMobile'],
        country: rowObject['country'],
        governorate: rowObject['governorate'],
        address: rowObject['address'],
        walletAddress: rowObject['walletAddress'],
        walletCurrency: rowObject['walletCurrency'] || 'LBP',
        walletStatus: rowObject['walletStatus'] || 'PENDING_CREATION',
        blockchainStatus: rowObject['blockchainStatus'] || 'NOT_SUBMITTED',
        errors: [],
      };

      row.errors = this.validateCsvRow(row);

      return row;
    });

    this.csvRows = parsedRows;
    this.validCsvRows = parsedRows.filter((row) => row.errors.length === 0);
    this.invalidCsvRows = parsedRows.filter((row) => row.errors.length > 0);
  }
private readonly apiBaseUrl = 'http://172.31.13.90:3001/api/v1';
  uploadBulkMinistries(): void {
    if (this.validCsvRows.length === 0) {
        alert('No valid CSV rows available for upload.');
        return;
    }

    this.isBulkUploading = true;

    const bulkPayload = {
        source: 'CSV_UPLOAD',
        uploadedAt: new Date().toISOString(),
        totalRows: this.csvRows.length,
        validRows: this.validCsvRows.length,
        invalidRows: this.invalidCsvRows.length,
        ministries: this.validCsvRows.map((row) => ({
        ministryReferenceId: row.ministryId,
        ministryCode: row.ministryCode,
        ministryName: row.ministryName,
        arabicName: row.arabicName,
        ministryType: row.ministryType,
        parentMinistry: row.parentMinistry || null,
        ministerName: row.ministerName,
        contactPerson: row.contactPerson,
        contactEmail: row.contactEmail,
        contactMobile: row.contactMobile,
        country: row.country,
        governorate: row.governorate,
        address: row.address,
        walletAddress: row.walletAddress || null,
        walletCurrency: row.walletCurrency || 'LBP',
        walletStatus: row.walletStatus || 'PENDING_CREATION',
        blockchainStatus: row.blockchainStatus || 'NOT_SUBMITTED',
        })),
    };

    this.http
        .post<any>(
            `${this.apiBaseUrl}/government-blockchain/ministries/bulk`,
            bulkPayload
        )
        .subscribe({
            next: (response) => {
            console.log('Bulk upload response:', response);
            this.isBulkUploading = false;

            alert(
                `Bulk upload completed successfully.\nInserted: ${response.insertedCount || 0}\nSkipped: ${response.skippedCount || 0}`
            );
            },
            error: (error) => {
            console.error('Bulk upload failed:', error);
            this.isBulkUploading = false;

            alert(
                error?.error?.message ||
                error?.message ||
                'Bulk upload failed. Check backend logs.'
            );
            },
        });
    }

  downloadCsvTemplate(): void {
    const headers = [
      'ministryId',
      'ministryCode',
      'ministryName',
      'arabicName',
      'ministryType',
      'parentMinistry',
      'ministerName',
      'contactPerson',
      'contactEmail',
      'contactMobile',
      'country',
      'governorate',
      'address',
      'walletAddress',
      'walletCurrency',
      'walletStatus',
      'blockchainStatus',
    ];

    const sampleRow = [
      'MIN-001',
      'MOF',
      'Ministry of Finance',
      'وزارة المالية',
      'Central Government Ministry',
      'None',
      'Minister Name',
      'Nix Admin',
      'contact@finance.gov.lb',
      '+961 70 123 456',
      'Lebanon',
      'Beirut',
      'Beirut Central District',
      '',
      'LBP',
      'PENDING_CREATION',
      'NOT_SUBMITTED',
    ];

    const csvContent = `${headers.join(',')}\n${sampleRow.map((value) => `"${value}"`).join(',')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ministry-bulk-upload-template.csv';
    anchor.click();

    window.URL.revokeObjectURL(url);
  }

  clearCsvFile(): void {
    this.selectedCsvFileName = '';
    this.csvRows = [];
    this.validCsvRows = [];
    this.invalidCsvRows = [];

    if (this.csvFileInput?.nativeElement) {
      this.csvFileInput.nativeElement.value = '';
    }
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

    if (control.errors['minlength']) {
      return `Minimum length is ${control.errors['minlength'].requiredLength} characters.`;
    }

    if (control.errors['maxlength']) {
      return `Maximum length is ${control.errors['maxlength'].requiredLength} characters.`;
    }

    if (control.errors['pattern']) {
      return 'Invalid format.';
    }

    return 'Invalid value.';
  }

  private buildMinistryPayload(): any {
    const formValue = this.ministryAccountForm.getRawValue();

    return {
      ministry: {
        ministryId: formValue.ministryId,
        ministryCode: formValue.ministryCode,
        ministryName: formValue.ministryName,
        arabicName: formValue.arabicName,
        ministryType: formValue.ministryType,
        parentMinistry: formValue.parentMinistry,
        ministerName: formValue.ministerName,
        contactPerson: formValue.contactPerson,
        contactEmail: formValue.contactEmail,
        contactMobile: formValue.contactMobile,
        country: formValue.country,
        governorate: formValue.governorate,
        address: formValue.address,
      },
      wallet: {
        walletAddress: formValue.walletAddress,
        walletCurrency: formValue.walletCurrency,
        walletStatus: formValue.walletStatus,
      },
      blockchain: {
        blockchainNetwork: formValue.blockchainNetwork,
        blockchainChannel: formValue.blockchainChannel,
        chaincodeName: formValue.chaincodeName,
        blockchainStatus: formValue.blockchainStatus,
        blockchainProofHash: formValue.blockchainProofHash,
      },
    };
  }

  private validateCsvRow(row: CsvMinistryRow): string[] {
    const errors: string[] = [];

    if (!row.ministryId) errors.push('Ministry ID is required');
    if (!row.ministryCode) errors.push('Ministry Code is required');
    if (!row.ministryName) errors.push('Ministry Name is required');
    if (!row.arabicName) errors.push('Arabic Name is required');
    if (!row.ministryType) errors.push('Ministry Type is required');
    if (!row.ministerName) errors.push('Minister Name is required');
    if (!row.contactPerson) errors.push('Contact Person is required');
    if (!row.contactEmail) errors.push('Contact Email is required');
    if (!row.contactMobile) errors.push('Contact Mobile is required');
    if (!row.country) errors.push('Country is required');
    if (!row.governorate) errors.push('Governorate is required');
    if (!row.address) errors.push('Address is required');

    if (row.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.contactEmail)) {
      errors.push('Invalid email format');
    }

    if (row.walletCurrency && !this.walletCurrencies.includes(row.walletCurrency)) {
      errors.push(`Invalid wallet currency: ${row.walletCurrency}`);
    }

    if (row.walletStatus && !this.walletStatuses.includes(row.walletStatus)) {
      errors.push(`Invalid wallet status: ${row.walletStatus}`);
    }

    if (row.blockchainStatus && !this.blockchainStatuses.includes(row.blockchainStatus)) {
      errors.push(`Invalid blockchain status: ${row.blockchainStatus}`);
    }

    return errors;
  }

  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"' && insideQuotes && nextChar === '"') {
        current += '"';
        index++;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);

    return result;
  }
}