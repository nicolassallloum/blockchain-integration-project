import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
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

interface CreatedPublicAdministrationPopupData {
  administrationId: string;
  administrationCode: string;
  loginUsername: string;
  generatedPassword: string;
  walletAddress: string;
  walletCurrency: string;
  walletStatus: string;
  ledgerReference: string;
  blockchainTxId: string;
  postgresRecordId: string;
}

@Component({
  selector: 'app-create-public-administration-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-public-administration-account.component.html',
  styleUrl: './create-public-administration-account.component.scss'
})
export class CreatePublicAdministrationAccountComponent implements OnInit {
  activeMode = signal<'manual' | 'csv'>('manual');
  isSubmitting = signal(false);
  isUploading = signal(false);
  isLoadingCodes = signal(false);

  message = signal<string | null>(null);
  error = signal<string | null>(null);

  showCreatedPopup = signal(false);
  createdPopupData = signal<CreatedPublicAdministrationPopupData | null>(null);

  csvRows = signal<PublicAdministrationPayload[]>([]);
  filteredMunicipalities = signal<string[]>([]);

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

  governorateMunicipalityMap: Record<string, string[]> = {
    Beirut: ['Beirut Municipality'],
    'Mount Lebanon': [
      'Baabda Municipality',
      'Jounieh Municipality',
      'Byblos Municipality',
      'Aley Municipality',
      'Choueifat Municipality',
      'Dekwaneh Municipality',
      'Sin El Fil Municipality',
      'Bourj Hammoud Municipality'
    ],
    'North Lebanon': [
      'Tripoli Municipality',
      'Mina Municipality',
      'Zgharta Municipality',
      'Bcharre Municipality',
      'Batroun Municipality',
      'Koura Municipality'
    ],
    Akkar: [
      'Halba Municipality',
      'Bebnine Municipality',
      'Qobayat Municipality',
      'Berqayel Municipality',
      'Akkar El Atika Municipality'
    ],
    'Baalbek-Hermel': [
      'Baalbek Municipality',
      'Hermel Municipality',
      'Douris Municipality',
      'Ras Baalbek Municipality'
    ],
    Bekaa: [
      'Zahle Municipality',
      'Chtaura Municipality',
      'Rachaya Municipality',
      'West Bekaa Municipality',
      'Taalabaya Municipality'
    ],
    Nabatieh: [
      'Nabatieh Municipality',
      'Bint Jbeil Municipality',
      'Marjayoun Municipality',
      'Hasbaya Municipality',
      'Kfar Roummane Municipality'
    ],
    'South Lebanon': [
      'Sidon Municipality',
      'Tyre Municipality',
      'Jezzine Municipality',
      'Qana Municipality',
      'Sarafand Municipality'
    ]
  };

  walletCurrencies: WalletCurrency[] = ['GOV'];
  walletStatuses: WalletStatus[] = ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'];

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: PublicAdministrationApiService
  ) {
    this.administrationForm = this.fb.group({
      administrationId: [
        '',
        [
          Validators.required,
          Validators.maxLength(80),
          Validators.pattern(/^ADM-BLOCKCHAIN-[0-9]+$/)
        ]
      ],
      administrationCode: [
        '',
        [
          Validators.required,
          Validators.maxLength(80),
          Validators.pattern(/^ADM-BLOCKCHAIN-[0-9]+$/)
        ]
      ],
      administrationName: ['', [Validators.required, Validators.maxLength(200)]],
      arabicName: ['', [Validators.required, Validators.maxLength(200)]],
      parentMinistry: ['', Validators.required],
      administrationType: ['DIRECTORATE', Validators.required],
      directorName: ['', [Validators.required, Validators.maxLength(150)]],
      contactPerson: ['', [Validators.required, Validators.maxLength(150)]],
      contactEmail: ['', [Validators.required, Validators.email]],
      contactMobile: ['', [Validators.required, Validators.maxLength(50)]],
      country: ['Lebanon', Validators.required],
      governorate: ['', Validators.required],
      municipality: ['', Validators.required],
      address: ['', [Validators.required, Validators.maxLength(500)]],
      walletAddress: [
        '',
        [
          Validators.required,
          Validators.maxLength(120),
          Validators.pattern(/^GOV-ADM-[0-9]+$/)
        ]
      ],
      walletCurrency: ['GOV', Validators.required],
      walletStatus: ['PENDING', Validators.required]
    });
  }

  ngOnInit(): void {
    this.setupGovernorateMunicipalityLink();
    this.loadNextCodes();
  }

  setMode(mode: 'manual' | 'csv'): void {
    this.activeMode.set(mode);
    this.clearMessages();

    if (mode === 'manual') {
      this.loadNextCodes();
    }
  }

  createAdministration(): void {
    this.clearMessages();

    if (this.administrationForm.invalid) {
      this.administrationForm.markAllAsTouched();
      this.error.set(
        'Please fill all required fields. Administration ID must be ADM-BLOCKCHAIN-1 and Wallet Address must be GOV-ADM-1 format.'
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

        this.openCreatedPopup(response);
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

    if (this.administrationForm.invalid) {
      this.administrationForm.markAllAsTouched();
      this.error.set(
        'Please complete the administration form before creating the wallet. Wallet Address must be GOV-ADM-1 format.'
      );
      return;
    }

    this.isSubmitting.set(true);

    this.api.createAdministrationWallet(this.buildPayload()).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);

        this.message.set(
          response.message ||
            'Public administration wallet updated successfully in PostgreSQL.'
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

    const payload = this.buildPayload();
    localStorage.setItem('publicAdministrationDraft', JSON.stringify(payload));

    this.message.set('Draft saved locally.');
  }

  resetForm(): void {
    this.administrationForm.reset({
      country: 'Lebanon',
      administrationType: 'DIRECTORATE',
      walletCurrency: 'GOV',
      walletStatus: 'PENDING'
    });

    this.csvRows.set([]);
    this.filteredMunicipalities.set([]);
    this.clearMessages();
    this.loadNextCodes();
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
      'ADM-BLOCKCHAIN-1',
      'ADM-BLOCKCHAIN-1',
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
      'GOV-ADM-1',
      'GOV',
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

  closeCreatedPopup(): void {
    this.showCreatedPopup.set(false);
  }

  createAnotherAdministration(): void {
    this.showCreatedPopup.set(false);
    this.resetForm();
  }

  copyValue(value: string | null | undefined): void {
    if (!value) {
      return;
    }

    navigator.clipboard.writeText(value).then(() => {
      this.message.set('Value copied successfully.');
    });
  }

  private loadNextCodes(): void {
    this.isLoadingCodes.set(true);

    this.api.getNextCodes().subscribe({
      next: (response) => {
        this.isLoadingCodes.set(false);

        const data = response?.data;

        if (!data) {
          this.error.set('Next sequence response is empty.');
          return;
        }

        this.administrationForm.patchValue({
          administrationId: data.administrationId,
          administrationCode: data.administrationCode,
          walletAddress: data.walletAddress,
          walletCurrency: 'GOV'
        });
      },
      error: (err) => {
        this.isLoadingCodes.set(false);
        console.error('[GET_NEXT_PUBLIC_ADMINISTRATION_CODES_ERROR]', err);
        this.error.set(this.extractBackendError(err));
      }
    });
  }

  private setupGovernorateMunicipalityLink(): void {
    const governorateControl = this.administrationForm.get('governorate');
    const municipalityControl = this.administrationForm.get('municipality');

    governorateControl?.valueChanges.subscribe((governorate: string) => {
      const municipalities = this.governorateMunicipalityMap[governorate] || [];

      this.filteredMunicipalities.set(municipalities);
      municipalityControl?.setValue('');
    });
  }

  private openCreatedPopup(response: any): void {
    const formValue = this.administrationForm.getRawValue();
    const data = response?.data || {};

    const administrationId =
      data.administration_id ||
      data.administrationId ||
      formValue.administrationId;

    const administrationCode =
      data.administration_code ||
      data.administrationCode ||
      formValue.administrationCode;

    const walletAddress =
      data.wallet_address ||
      data.walletAddress ||
      formValue.walletAddress;

    const blockchainTxId =
      response?.blockchainTxId ||
      data.blockchain_tx_id ||
      data.createdTxId ||
      data.blockchainTxId ||
      '';

    const postgresRecordId =
      response?.postgresRecordId ||
      data.id ||
      '';

    this.createdPopupData.set({
      administrationId,
      administrationCode,
      loginUsername:
        data.login_username ||
        data.loginUsername ||
        formValue.contactEmail ||
        administrationCode,
      generatedPassword:
        data.generated_password ||
        data.generatedPassword ||
        response?.generatedPassword ||
        'Not returned by backend',
      walletAddress,
      walletCurrency:
        data.wallet_currency ||
        data.walletCurrency ||
        'GOV',
      walletStatus:
        data.wallet_status ||
        data.walletStatus ||
        formValue.walletStatus ||
        'PENDING',
      ledgerReference:
        data.ledger_reference ||
        data.ledgerReference ||
        `PUBLIC_ADMINISTRATION_${administrationId}`,
      blockchainTxId,
      postgresRecordId
    });

    this.showCreatedPopup.set(true);
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
      walletCurrency: 'GOV' as WalletCurrency,
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

      return {
        administrationId: this.clean(row.administrationId),
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
        walletAddress: this.clean(row.walletAddress),
        walletCurrency: 'GOV' as WalletCurrency,
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