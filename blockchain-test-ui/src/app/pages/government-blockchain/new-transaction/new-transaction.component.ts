import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

interface ResidentOption {
  residentId: string;
  residentName: string;
  walletAddress: string;
  nationalId: string;
}

interface MinistryOption {
  ministryCode: string;
  ministryName: string;
}

interface ServiceOption {
  serviceCode: string;
  serviceName: string;
  ministryCode: string;
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
export class NewTransactionComponent {
  transactionForm: FormGroup;

  readonly today = new Date();

  residents: ResidentOption[] = [
    {
      residentId: 'RES-000001',
      residentName: 'Nicolas Bernard Salloum',
      walletAddress: '0x9F12A8C77E22B91F44AA1010D88B2100A1B2C3D4',
      nationalId: '199506150001'
    },
    {
      residentId: 'RES-000002',
      residentName: 'Maya Georges Haddad',
      walletAddress: '0x7A81C9F03B55E22D00CD9898ABF44321EF109871',
      nationalId: '199204220144'
    },
    {
      residentId: 'RES-000003',
      residentName: 'Karim Joseph Khoury',
      walletAddress: '0x11AC44E55D889900BBAACCDDEEFF772299001122',
      nationalId: '198812120099'
    }
  ];

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

  services: ServiceOption[] = [
    {
      serviceCode: 'TAX-CERT-001',
      serviceName: 'Tax Clearance Certificate',
      ministryCode: 'MOF',
      feeAmount: 250000,
      currency: 'LBP',
      digitalStampRequired: true,
      processingTime: '2 Business Days'
    },
    {
      serviceCode: 'BIRTH-REG-001',
      serviceName: 'Birth Certificate Request',
      ministryCode: 'MOIM',
      feeAmount: 150000,
      currency: 'LBP',
      digitalStampRequired: true,
      processingTime: '1 Business Day'
    },
    {
      serviceCode: 'CRIM-REC-001',
      serviceName: 'Criminal Record Certificate',
      ministryCode: 'MOJ',
      feeAmount: 300000,
      currency: 'LBP',
      digitalStampRequired: true,
      processingTime: '3 Business Days'
    },
    {
      serviceCode: 'HEALTH-LIC-001',
      serviceName: 'Health License Request',
      ministryCode: 'MOPH',
      feeAmount: 500000,
      currency: 'LBP',
      digitalStampRequired: false,
      processingTime: '5 Business Days'
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

  filteredServices = computed(() => {
    const ministryCode = this.transactionForm?.get('ministry')?.value;

    if (!ministryCode) {
      return this.services;
    }

    return this.services.filter(service => service.ministryCode === ministryCode);
  });

  selectedServiceDetails = signal<ServiceOption | null>(null);

  constructor(private fb: FormBuilder) {
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
      walletAddress: selectedResident.walletAddress
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

    console.log('Draft transaction saved:', this.transactionForm.getRawValue());
  }

  submitTransaction(): void {
    if (this.transactionForm.invalid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    this.transactionForm.patchValue({
      transactionStatus: 'Submitted'
    });

    console.log('Transaction submitted:', this.transactionForm.getRawValue());
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

    console.log('Document uploaded:', newDocument);
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

    console.log('Document hashes generated:', documents);
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

  private generateTransactionId(): string {
    const timestamp = new Date().getTime().toString().slice(-8);
    return `GTRX-${timestamp}`;
  }

  private generateMockHash(): string {
    const randomValue = Math.random().toString(16).substring(2, 34);
    return `0x${randomValue.padEnd(40, '0')}`;
  }
}
