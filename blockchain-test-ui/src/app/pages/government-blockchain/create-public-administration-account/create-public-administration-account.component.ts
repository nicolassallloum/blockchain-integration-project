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
      walletAddress: [
        '',
        [
          Validators.required,
          Validators.maxLength(120),
          Validators.pattern(/^WALLET-[A-Z0-9-_]+$/)
        ]
      ],
      walletCurrency: ['LBP', Validators.required],
      walletStatus: ['PENDING', Validators.required]
    });

    this.setupWalletAutoGeneration();
  }

  setMode(mode: 'manual' | 'csv'): void {
    this.activeMode.set(mode);
    this.clearMessages();
  }

  createAdministration(): void {
    this.clearMessages();
    this.ensureWalletAddress();

    if (this.administrationForm.invalid) {
      this.administrationForm.markAllAsTouched();
      this.error.set(
        'Please fill all required fields. Wallet Address must start with WALLET-, example: WALLET-TEST1.'
      );
      return;
    }

    this.isSubmitting.set(true);

    this.api.createAdministration(this.buildPayload()).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);

        this.message.set(
          response.message ||
            'Public administration saved successfully in Blockchain and PostgreSQL.'
        );
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error('[CREATE_PUBLIC_ADMINISTRATION_ERROR]', err);

        this.error.set(this.extractBackendError(err));
      }
    });
  }

  createWallet(): void {
    this.clearMessages();
    this.ensureWalletAddress();

    if (this.administrationForm.invalid) {
      this.administrationForm.markAllAsTouched();
      this.error.set(
        'Please complete the administration form before creating the wallet. Wallet Address must start with WALLET-.'
      );
      return;
    }

    this.isSubmitting.set(true);

    this.api.createAdministrationWallet(this.buildPayload()).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);

        this.message.set(
          response.message ||
            'Administration wallet created successfully in Blockchain and PostgreSQL.'
        );
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error('[CREATE_ADMINISTRATION_WALLET_ERROR]', err);

        this.error.set(this.extractBackendError(err));
      }
    });
  }

  saveDraft(): void {
    this.clearMessages();
    this.ensureWalletAddress();

    const payload = this.buildPayload();

    localStorage.setItem('publicAdministrationDraft', JSON.stringify(payload));

    this.message.set(
      'Draft saved locally. API draft endpoint is also prepared for backend integration.'
    );
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

        const successCount = (response as any).successCount || this.csvRows().length;
        const failedCount = (response as any).failedCount || 0;
        const failedRows = (response as any).data?.failedRows || [];

        if (failedCount > 0) {
          console.table(failedRows);

          this.error.set(
            `${successCount} record(s) saved. ${failedCount} record(s) failed. Check browser console for failed rows.`
          );

          return;
        }

        this.message.set(
          response.message ||
            `${successCount} public administration record(s) saved successfully in Blockchain and PostgreSQL.`
        );
      },
      error: (err) => {
        this.isUploading.set(false);
        console.error('[UPLOAD_PUBLIC_ADMINISTRATION_CSV_ERROR]', err);

        this.error.set(this.extractBackendError(err));
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
      '"Beirut, Lebanon"',
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

  private setupWalletAutoGeneration(): void {
    const administrationIdControl = this.administrationForm.get('administrationId');
    const walletAddressControl = this.administrationForm.get('walletAddress');

    if (!administrationIdControl || !walletAddressControl) {
      return;
    }

    administrationIdControl.valueChanges.subscribe((value) => {
      const currentWalletAddress = String(walletAddressControl.value || '').trim();

      if (!currentWalletAddress || !currentWalletAddress.startsWith('WALLET-')) {
        walletAddressControl.setValue(this.generateWalletAddress(value), {
          emitEvent: false
        });
      }
    });
  }

  private ensureWalletAddress(): void {
    const administrationId = this.administrationForm.get('administrationId')?.value;
    const walletAddressControl = this.administrationForm.get('walletAddress');
    const currentWalletAddress = String(walletAddressControl?.value || '').trim();

    if (
      !currentWalletAddress ||
      !currentWalletAddress.startsWith('WALLET-') ||
      currentWalletAddress.includes('Street') ||
      currentWalletAddress.includes('Center') ||
      currentWalletAddress.includes('Road')
    ) {
      walletAddressControl?.setValue(this.generateWalletAddress(administrationId));
    }
  }

  private generateWalletAddress(administrationId: string): string {
    const cleanAdministrationId = String(administrationId || 'PUBLIC-ADMIN')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-_]/g, '-');

    return `WALLET-${cleanAdministrationId}`;
  }

  private buildPayload(): PublicAdministrationPayload {
    const value = this.administrationForm.getRawValue();

    return {
      administrationId: this.clean(value.administrationId),
      administrationCode: this.clean(value.administrationCode),
      administrationName: this.clean(value.administrationName),
      arabicName: this.clean(value.arabicName),
      parentMinistry: this.clean(value.parentMinistry),
      administrationType: this.clean(value.administrationType) as AdministrationType,
      directorName: this.clean(value.directorName),
      contactPerson: this.clean(value.contactPerson),
      contactEmail: this.clean(value.contactEmail),
      contactMobile: this.clean(value.contactMobile),
      country: this.clean(value.country),
      governorate: this.clean(value.governorate),
      municipality: this.clean(value.municipality),
      address: this.clean(value.address),
      walletAddress: this.clean(value.walletAddress),
      walletCurrency: this.clean(value.walletCurrency) as WalletCurrency,
      walletStatus: this.clean(value.walletStatus) as WalletStatus,
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

    const headers = this.splitCsvLine(lines[0]).map((header) =>
      header.replace(/^\uFEFF/, '').trim()
    );

    return lines.slice(1).map((line) => {
      const values = this.splitCsvLine(line);

      const row = headers.reduce((acc, header, index) => {
        acc[header as keyof PublicAdministrationCsvRow] = values[index] || '';
        return acc;
      }, {} as PublicAdministrationCsvRow);

      const administrationId = this.clean(row.administrationId);

      return {
        administrationId,
        administrationCode: this.clean(row.administrationCode),
        administrationName: this.clean(row.administrationName),
        arabicName: this.clean(row.arabicName),
        parentMinistry: this.clean(row.parentMinistry),
        administrationType: this.clean(row.administrationType) as AdministrationType,
        directorName: this.clean(row.directorName),
        contactPerson: this.clean(row.contactPerson),
        contactEmail: this.clean(row.contactEmail),
        contactMobile: this.clean(row.contactMobile),
        country: this.clean(row.country),
        governorate: this.clean(row.governorate),
        municipality: this.clean(row.municipality),
        address: this.clean(row.address),
        walletAddress:
          this.clean(row.walletAddress) || this.generateWalletAddress(administrationId),
        walletCurrency: (this.clean(row.walletCurrency) || 'LBP') as WalletCurrency,
        walletStatus: (this.clean(row.walletStatus) || 'PENDING') as WalletStatus,
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
      const nextChar = line[i + 1];

      if (char === '"' && insideQuotes && nextChar === '"') {
        current += '"';
        i++;
        continue;
      }

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

  private clean(value: unknown): string {
    return String(value ?? '').trim();
  }

  private extractBackendError(err: any): string {
    return (
      err?.error?.error ||
      err?.error?.message ||
      err?.message ||
      'Failed to save public administration on Blockchain and PostgreSQL.'
    );
  }

  private clearMessages(): void {
    this.message.set(null);
    this.error.set(null);
  }
}