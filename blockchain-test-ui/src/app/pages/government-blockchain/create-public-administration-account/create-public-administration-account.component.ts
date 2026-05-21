import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {
  AdministrationType,
  PublicAdministrationCsvRow,
  PublicAdministrationPayload,
  WalletCurrency,
  WalletStatus
} from '../../../models/public-administration.models';
import { PublicAdministrationApiService } from '../../../services/public-administration-api.service';

@Component({
  selector: 'app-create-public-administration-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-public-administration-account.component.html',
  styleUrl: './create-public-administration-account.component.scss'
})
export class CreatePublicAdministrationAccountComponent {
  activeMode = signal<'manual' | 'csv'>('manual');
  isSubmitting = signal(false);
  isUploading = signal(false);
  message = signal<string | null>(null);
  error = signal<string | null>(null);
  csvRows = signal<PublicAdministrationPayload[]>([]);

  readonly csvRowCount = computed(() => this.csvRows().length);

  administrationForm: FormGroup;

  ministries = [
    'Ministry of Interior and Municipalities',
    'Ministry of Finance',
    'Ministry of Public Health',
    'Ministry of Education and Higher Education',
    'Ministry of Justice',
    'Ministry of Public Works and Transport',
    'Ministry of Economy and Trade'
  ];

  administrationTypes: AdministrationType[] = [
    'DIRECTORATE',
    'DEPARTMENT',
    'PUBLIC_AUTHORITY',
    'PUBLIC_INSTITUTION',
    'MUNICIPAL_ADMINISTRATION',
    'GOVERNORATE_OFFICE',
    'OTHER'
  ];

  countries = ['Lebanon'];

  governorates = [
    'Beirut',
    'Mount Lebanon',
    'North Lebanon',
    'Akkar',
    'Baalbek-Hermel',
    'Bekaa',
    'Nabatieh',
    'South Lebanon'
  ];

  municipalities = [
    'Beirut Municipality',
    'Tripoli Municipality',
    'Sidon Municipality',
    'Zahle Municipality',
    'Jounieh Municipality',
    'Byblos Municipality',
    'Baalbek Municipality',
    'Tyre Municipality'
  ];

  walletCurrencies: WalletCurrency[] = ['LBP', 'USD', 'EUR'];
  walletStatuses: WalletStatus[] = ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'];

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: PublicAdministrationApiService
  ) {
    this.administrationForm = this.fb.group({
      administrationId: ['', [Validators.required, Validators.maxLength(50)]],
      administrationCode: ['', [Validators.required, Validators.maxLength(50)]],
      administrationName: ['', [Validators.required, Validators.maxLength(150)]],
      arabicName: ['', [Validators.required, Validators.maxLength(150)]],
      parentMinistry: ['', Validators.required],
      administrationType: ['DIRECTORATE', Validators.required],
      directorName: ['', [Validators.required, Validators.maxLength(120)]],
      contactPerson: ['', [Validators.required, Validators.maxLength(120)]],
      contactEmail: ['', [Validators.required, Validators.email]],
      contactMobile: ['', [Validators.required, Validators.maxLength(30)]],
      country: ['Lebanon', Validators.required],
      governorate: ['', Validators.required],
      municipality: ['', Validators.required],
      address: ['', [Validators.required, Validators.maxLength(250)]],
      walletAddress: ['', [Validators.required, Validators.maxLength(120)]],
      walletCurrency: ['LBP', Validators.required],
      walletStatus: ['PENDING', Validators.required]
    });
  }

  setMode(mode: 'manual' | 'csv'): void {
    this.activeMode.set(mode);
    this.clearMessages();
  }

  createAdministration(): void {
    this.clearMessages();

    if (this.administrationForm.invalid) {
      this.administrationForm.markAllAsTouched();
      this.error.set('Please fill all required fields before creating the administration.');
      return;
    }

    this.isSubmitting.set(true);

    this.api.createAdministration(this.buildPayload()).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.message.set(
          response.message ||
            'Public administration saved successfully on Blockchain and PostgreSQL.'
        );
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.error.set(
          err?.error?.message ||
            'Failed to save public administration on Blockchain and PostgreSQL.'
        );
      }
    });
  }

  createWallet(): void {
    this.clearMessages();

    if (this.administrationForm.invalid) {
      this.administrationForm.markAllAsTouched();
      this.error.set('Please complete the administration form before creating the wallet.');
      return;
    }

    this.isSubmitting.set(true);

    this.api.createAdministrationWallet(this.buildPayload()).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.message.set(
          response.message ||
            'Administration wallet created successfully on Blockchain and PostgreSQL.'
        );
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.error.set(
          err?.error?.message ||
            'Failed to create administration wallet on Blockchain and PostgreSQL.'
        );
      }
    });
  }

  saveDraft(): void {
    this.clearMessages();

    const payload = this.buildPayload();

    localStorage.setItem('publicAdministrationDraft', JSON.stringify(payload));

    this.message.set('Draft saved locally. API draft endpoint is also prepared for backend integration.');

    /*
    this.api.saveDraft(payload).subscribe({
      next: () => this.message.set('Draft saved successfully.'),
      error: () => this.error.set('Failed to save draft.')
    });
    */
  }

  resetForm(): void {
    this.administrationForm.reset({
      country: 'Lebanon',
      administrationType: 'DIRECTORATE',
      walletCurrency: 'LBP',
      walletStatus: 'PENDING'
    });

    this.csvRows.set([]);
    this.clearMessages();
  }

  onCsvSelected(event: Event): void {
    this.clearMessages();

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.error.set('Please upload a valid CSV file.');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const csvText = String(reader.result || '');
      const parsedRows = this.parseCsv(csvText);

      if (!parsedRows.length) {
        this.error.set('CSV file is empty or invalid.');
        return;
      }

      this.csvRows.set(parsedRows);
      this.message.set(`${parsedRows.length} administration record(s) loaded from CSV.`);
    };

    reader.onerror = () => {
      this.error.set('Failed to read CSV file.');
    };

    reader.readAsText(file);
  }

  uploadCsvData(): void {
    this.clearMessages();

    if (!this.csvRows().length) {
      this.error.set('Please select a CSV file before uploading.');
      return;
    }

    this.isUploading.set(true);

    this.api.bulkUploadAdministrations(this.csvRows()).subscribe({
      next: (response) => {
        this.isUploading.set(false);
        this.message.set(
          response.message ||
            `${this.csvRows().length} public administration record(s) saved successfully on Blockchain and PostgreSQL.`
        );
      },
      error: (err) => {
        this.isUploading.set(false);
        this.error.set(
          err?.error?.message ||
            'Failed to upload CSV data to Blockchain and PostgreSQL.'
        );
      }
    });
  }

  downloadCsvTemplate(): void {
    const header = [
      'administrationId',
      'administrationCode',
      'administrationName',
      'arabicName',
      'parentMinistry',
      'administrationType',
      'directorName',
      'contactPerson',
      'contactEmail',
      'contactMobile',
      'country',
      'governorate',
      'municipality',
      'address',
      'walletAddress',
      'walletCurrency',
      'walletStatus'
    ].join(',');

    const sample = [
      'ADM-001',
      'ADM-MOI-001',
      'General Directorate of Personal Status',
      'المديرية العامة للأحوال الشخصية',
      'Ministry of Interior and Municipalities',
      'DIRECTORATE',
      'Director Name',
      'Contact Person',
      'admin001@gov.lb',
      '+96170123456',
      'Lebanon',
      'Beirut',
      'Beirut Municipality',
      'Beirut, Lebanon',
      'WALLET-ADM-001',
      'LBP',
      'PENDING'
    ].join(',');

    const blob = new Blob([`${header}\n${sample}\n`], {
      type: 'text/csv;charset=utf-8;'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'public-administration-bulk-upload-template.csv';
    link.click();

    window.URL.revokeObjectURL(url);
  }

  isInvalid(controlName: string): boolean {
    const control = this.administrationForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private buildPayload(): PublicAdministrationPayload {
    const value = this.administrationForm.getRawValue();

    return {
      administrationId: value.administrationId,
      administrationCode: value.administrationCode,
      administrationName: value.administrationName,
      arabicName: value.arabicName,
      parentMinistry: value.parentMinistry,
      administrationType: value.administrationType,
      directorName: value.directorName,
      contactPerson: value.contactPerson,
      contactEmail: value.contactEmail,
      contactMobile: value.contactMobile,
      country: value.country,
      governorate: value.governorate,
      municipality: value.municipality,
      address: value.address,
      walletAddress: value.walletAddress,
      walletCurrency: value.walletCurrency,
      walletStatus: value.walletStatus,
      saveToBlockchain: true,
      saveToPostgresql: true
    };
  }

  private parseCsv(csvText: string): PublicAdministrationPayload[] {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const headers = this.splitCsvLine(lines[0]);

    return lines.slice(1).map((line) => {
      const values = this.splitCsvLine(line);
      const row = headers.reduce((acc, header, index) => {
        acc[header as keyof PublicAdministrationCsvRow] = values[index] || '';
        return acc;
      }, {} as PublicAdministrationCsvRow);

      return {
        administrationId: row.administrationId,
        administrationCode: row.administrationCode,
        administrationName: row.administrationName,
        arabicName: row.arabicName,
        parentMinistry: row.parentMinistry,
        administrationType: row.administrationType as AdministrationType,
        directorName: row.directorName,
        contactPerson: row.contactPerson,
        contactEmail: row.contactEmail,
        contactMobile: row.contactMobile,
        country: row.country,
        governorate: row.governorate,
        municipality: row.municipality,
        address: row.address,
        walletAddress: row.walletAddress,
        walletCurrency: row.walletCurrency as WalletCurrency,
        walletStatus: row.walletStatus as WalletStatus,
        saveToBlockchain: true,
        saveToPostgresql: true
      };
    });
  }

  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === ',' && !insideQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current.trim());

    return result;
  }

  private clearMessages(): void {
    this.message.set(null);
    this.error.set(null);
  }
}
