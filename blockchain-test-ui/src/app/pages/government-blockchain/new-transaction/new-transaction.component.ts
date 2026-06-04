import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { GovernmentTransactionApiService } from '../../../services/government-transaction-api.service';

interface ResidentOption {
  dbId: number;
  residentId: string;
  residentName: string;
  walletAddress: string;
  nationalId: string;
  mobile: string;
  email: string;
  walletCurrency: string;
  walletStatus: string;
}

interface MinistryOption {
  ministryCode: string;
  ministryName: string;
}

interface ServiceOption {
  serviceId: number;
  servicePublicId: string;
  serviceCode: string;
  serviceName: string;
  arabicName: string;
  ministryCode: string;
  ministryId: string;
  administrationId: string;
  categoryId: string;
  feeAmount: number;
  currency: string;
  digitalStampRequired: boolean;
  processingTime: string;
}

interface UploadedDocument {
  id: string;
  fileName: string;
  documentType: string;
  size: string;
  hash: string;
  status: 'Uploaded' | 'Pending Hash' | 'Verified';
}

@Component({
  selector: 'app-new-transaction',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './new-transaction.component.html',
  styleUrl: './new-transaction.component.scss'
})
export class NewTransactionComponent implements OnInit {
  transactionForm: FormGroup;

  readonly today = new Date();

  residents: ResidentOption[] = [];
  services: ServiceOption[] = [];

  ministries: MinistryOption[] = [
    {
      ministryCode: 'MOF',
      ministryName: 'Ministry of Finance'
    },
    {
      ministryCode: 'MOIM',
      ministryName: 'Ministry of Interior and Municipalities'
    },
    {
      ministryCode: 'MOJ',
      ministryName: 'Ministry of Justice'
    },
    {
      ministryCode: 'MOPH',
      ministryName: 'Ministry of Public Health'
    }
  ];

  paymentMethods: string[] = [
    'Resident Wallet',
    'Digital Stamp Wallet',
    'Bank Card',
    'Cash Office Payment',
    'Government Payment Gateway'
  ];

  transactionStatuses: string[] = [
    'Draft',
    'Submitted',
    'Pending Payment',
    'Pending Approval',
    'Approved',
    'Rejected'
  ];

  uploadedDocuments = signal<UploadedDocument[]>([
    {
      id: 'DOC-001',
      fileName: 'national-id-front.pdf',
      documentType: 'National ID',
      size: '420 KB',
      hash: '0x8d7f9e3a1c22b7f9c6a1001b8f9d22e77456aa11',
      status: 'Verified'
    },
    {
      id: 'DOC-002',
      fileName: 'application-form.pdf',
      documentType: 'Application Form',
      size: '810 KB',
      hash: 'Pending generation',
      status: 'Pending Hash'
    }
  ]);

  getFilteredServices(): ServiceOption[] {
    const ministryCode = this.transactionForm?.get('ministry')?.value;

    if (!ministryCode) {
      return this.services;
    }

    return this.services.filter(service =>
      String(service.ministryCode || '') === String(ministryCode)
    );
  }
  selectedServiceDetails = signal<ServiceOption | null>(null);

  constructor(
    private fb: FormBuilder,
    private governmentTransactionApi: GovernmentTransactionApiService
  ) {
    this.transactionForm = this.fb.group({
      transactionId: [
        this.generateTransactionId(),
        [Validators.required]
      ],
      residentId: [
        '',
        [Validators.required]
      ],
      walletAddress: [
        '',
        [Validators.required]
      ],
      residentName: [
        '',
        [Validators.required]
      ],
      ministry: [
        '',
        [Validators.required]
      ],
      service: [
        '',
        [Validators.required]
      ],
      feeAmount: [
        '',
        [Validators.required, Validators.min(0)]
      ],
      currency: [
        'LBP',
        [Validators.required]
      ],
      transactionStatus: [
        'Draft',
        [Validators.required]
      ],
      paymentMethod: [
        '',
        [Validators.required]
      ],
      digitalStampRequired: [
        false
      ],
      notes: [
        ''
      ]
    });
  }

  ngOnInit(): void {
    this.loadResidents();
    this.loadServices();
  }

  loadResidents(): void {
    this.governmentTransactionApi.getResidentsDropdown().subscribe({
      next: (response) => {
        const rows = response?.data || [];

        this.residents = rows.map((row: any) => ({
          dbId: Number(row.id || row.value),
          residentId: row.resident_id,
          residentName: row.full_name,
          walletAddress: row.wallet_address,
          nationalId: row.national_id_number,
          mobile: row.mobile_number,
          email: row.email,
          walletCurrency: row.wallet_currency || 'LBP',
          walletStatus: row.wallet_status
        }));
      },
      error: (error) => {
        console.error('Failed to load residents dropdown', error);
        this.residents = [];
      }
    });
  }

  loadServices(): void {
    this.governmentTransactionApi.getServices().subscribe({
      next: (response) => {
        const rows = response?.data || [];

        this.services = rows.map((row: any) => {
          const ministryCode =
            row.ministry_id ||
            row.ministry_code ||
            row.ministry_name ||
            'UNKNOWN';

          return {
            serviceId: Number(row.service_id || 0),
            servicePublicId: row.service_public_id,
            serviceCode: row.service_code,
            serviceName: row.service_name,
            arabicName: row.arabic_name,
            ministryCode,
            ministryId: row.ministry_id,
            administrationId: row.administration_id,
            categoryId: row.category_id,
            feeAmount: Number(row.fee_amount || row.service_fee || 0),
            currency: row.currency_code || row.currency || 'LBP',
            digitalStampRequired:
              row.digital_stamp_required === true ||
              row.digital_stamp_required === 'true',
            processingTime: row.processing_time || ''
          };
        });

        if (this.services.length > 0) {
          this.ministries = this.buildMinistriesFromServices(this.services);
        }
      },
      error: (error) => {
        console.error('Failed to load services', error);
        this.services = [];
      }
    });
  }

  buildMinistriesFromServices(services: ServiceOption[]): MinistryOption[] {
    const map = new Map<string, MinistryOption>();

    for (const service of services) {
      const ministryCode =
        service.ministryCode ||
        service.ministryId ||
        'UNKNOWN';

      if (!map.has(ministryCode)) {
        map.set(ministryCode, {
          ministryCode,
          ministryName:
            ministryCode === 'UNKNOWN'
              ? 'Unknown Ministry'
              : `Ministry ${ministryCode}`
        });
      }
    }

    return Array.from(map.values());
  }

  onResidentChange(): void {
    const residentId = this.transactionForm.get('residentId')?.value;
    const selectedResident = this.residents.find(
      resident => resident.residentId === residentId
    );

    if (!selectedResident) {
      return;
    }

    this.transactionForm.patchValue({
      residentName: selectedResident.residentName,
      walletAddress: selectedResident.walletAddress,
      currency: selectedResident.walletCurrency || 'LBP'
    });
  }

  onMinistryChange(): void {
    this.transactionForm.patchValue({
      service: '',
      feeAmount: '',
      currency: 'LBP',
      digitalStampRequired: false
    });

    this.selectedServiceDetails.set(null);
  }

  onServiceChange(): void {
    const serviceCode = this.transactionForm.get('service')?.value;
    const selectedService = this.services.find(
      service => service.serviceCode === serviceCode
    );

    if (!selectedService) {
      this.selectedServiceDetails.set(null);
      return;
    }

    this.selectedServiceDetails.set(selectedService);

    this.transactionForm.patchValue({
      feeAmount: selectedService.feeAmount,
      currency: selectedService.currency,
      digitalStampRequired: selectedService.digitalStampRequired
    });
  }

  saveDraft(): void {
    this.transactionForm.patchValue({
      transactionStatus: 'Draft'
    });

    if (this.transactionForm.invalid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    this.submitToApi('Draft');
  }

  submitTransaction(): void {
    this.transactionForm.patchValue({
      transactionStatus: 'Submitted'
    });

    if (this.transactionForm.invalid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    this.submitToApi('Submitted');
  }

  submitToApi(status: string): void {
    const formValue = this.transactionForm.getRawValue();

    const selectedResident = this.residents.find(
      resident => resident.residentId === formValue.residentId
    );

    const selectedService = this.services.find(
      service => service.serviceCode === formValue.service
    );

    if (!selectedResident || !selectedService) {
      console.error('Resident or service not selected');
      return;
    }

    const payload = {
      resident: {
        residentId: selectedResident.residentId,
        walletAddress: selectedResident.walletAddress,
        fullName: selectedResident.residentName,
        nationalId: selectedResident.nationalId,
        mobile: selectedResident.mobile,
        email: selectedResident.email
      },
      service: {
        serviceId: selectedService.serviceId,
        servicePublicId: selectedService.servicePublicId,
        serviceCode: selectedService.serviceCode,
        serviceName: selectedService.serviceName,
        arabicName: selectedService.arabicName,
        ministryId: selectedService.ministryId,
        administrationId: selectedService.administrationId,
        categoryId: selectedService.categoryId,
        fee_amount: selectedService.feeAmount,
        currency_code: selectedService.currency
      },
      transaction: {
        clientTransactionId: formValue.transactionId,
        amount: formValue.feeAmount,
        currencyCode: formValue.currency,
        paymentMethod: formValue.paymentMethod,
        transactionType: 'GOVERNMENT_SERVICE',
        transactionStatus: status,
        notes: formValue.notes,
        documentHash: this.getFirstDocumentHash()
      },
      documents: this.uploadedDocuments(),
      createdBy: {
        accountType: 'PUBLIC_ADMINISTRATION',
        loginUsername: 'system',
        walletAddress: null
      }
    };

    this.governmentTransactionApi.createTransaction(payload).subscribe({
      next: (response) => {
        console.log('Government transaction saved:', response);

        if (response?.transactionReference) {
          this.transactionForm.patchValue({
            transactionId: response.transactionReference,
            transactionStatus: response.blockchainStatus === 'SYNCED'
              ? 'Submitted'
              : status
          });
        }

        alert(
          `Transaction saved successfully.\nReference: ${response?.transactionReference}\nBlockchain Status: ${response?.blockchainStatus}`
        );
      },
      error: (error) => {
        console.error('Failed to submit transaction', error);
        alert(error?.error?.message || 'Failed to submit transaction.');
      }
    });
  }

  uploadDocuments(): void {
    const newDocument: UploadedDocument = {
      id: `DOC-${String(this.uploadedDocuments().length + 1).padStart(3, '0')}`,
      fileName: 'supporting-document.pdf',
      documentType: 'Supporting Document',
      size: '560 KB',
      hash: 'Pending generation',
      status: 'Pending Hash'
    };

    this.uploadedDocuments.update(documents => [
      ...documents,
      newDocument
    ]);
  }

  generateHash(): void {
    const documents = this.uploadedDocuments().map(document => {
      if (document.status === 'Pending Hash') {
        return {
          ...document,
          hash: this.generateMockHash(),
          status: 'Verified' as const
        };
      }

      return document;
    });

    this.uploadedDocuments.set(documents);
  }

  isInvalid(controlName: string): boolean {
    const control = this.transactionForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Draft':
        return 'status-draft';
      case 'Submitted':
        return 'status-submitted';
      case 'Pending Payment':
      case 'Pending Approval':
        return 'status-pending';
      case 'Approved':
        return 'status-approved';
      case 'Rejected':
        return 'status-rejected';
      default:
        return 'status-default';
    }
  }

  getDocumentStatusClass(status: string): string {
    switch (status) {
      case 'Verified':
        return 'status-approved';
      case 'Pending Hash':
        return 'status-pending';
      case 'Uploaded':
        return 'status-submitted';
      default:
        return 'status-default';
    }
  }

  private getFirstDocumentHash(): string | null {
    const document = this.uploadedDocuments().find(
      item => item.hash && item.hash !== 'Pending generation'
    );

    return document?.hash || null;
  }

  private generateTransactionId(): string {
    const timestamp = new Date().getTime().toString().slice(-8);
    return `GTRX-${timestamp}`;
  }

  private generateMockHash(): string {
    const randomValue = Math.random().toString(16).substring(2, 34);
    return `0x${randomValue.padEnd(40, '0')}`;
  }
}