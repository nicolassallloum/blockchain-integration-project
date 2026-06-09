import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
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
  walletBalance: number;
}

interface ServiceOption {
  serviceId: number;
  servicePublicId: string;
  serviceCode: string;
  serviceName: string;
  arabicName: string;
  ministryId: string;
  administrationId: string;
  categoryId: string;
  feeAmount: number;
  currency: string;
  digitalStampRequired: boolean;
  processingTime: string;
}

interface LookupOption {
  value: string;
  label: string;
  description?: string;
  display_order?: number;
}

interface UploadedDocument {
  id: string;
  fileName: string;
  documentType: string;
  size: string;
  hash: string;
  status: 'Uploaded' | 'Pending Hash' | 'Verified';
}

interface FeeBreakdown {
  baseFee: number;
  feePercentage: number;
  feeExtraAmount: number;
  totalFee: number;
  currency: 'GOV';
}

@Component({
  selector: 'app-new-transaction',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './new-transaction.component.html',
  styleUrl: './new-transaction.component.scss'
})
export class NewTransactionComponent implements OnInit {
  @ViewChild('documentFileInput') documentFileInput?: ElementRef<HTMLInputElement>;

  transactionForm: FormGroup;
  uploadForm: FormGroup;

  residents: ResidentOption[] = [];
  services: ServiceOption[] = [];
  paymentMethods: LookupOption[] = [];
  transactionStatuses: LookupOption[] = [];

  selectedServiceDetails = signal<ServiceOption | null>(null);
  uploadedDocuments = signal<UploadedDocument[]>([]);

  isSubmitting = false;
  isUploadingDocument = false;
  showUploadModal = false;
  showReceiptPopup = false;

  receiptData: any = null;

  successMessage = '';
  errorMessage = '';
  uploadMessage = '';

  selectedUploadFile: File | null = null;

  constructor(
    private fb: FormBuilder,
    private governmentTransactionApi: GovernmentTransactionApiService
  ) {
    this.transactionForm = this.fb.group({
      transactionId: [this.generateTransactionId(), [Validators.required]],

      residentId: ['', [Validators.required]],
      residentName: ['', [Validators.required]],
      walletAddress: ['', [Validators.required]],
      walletBalance: [0],
      walletStatus: [''],

      serviceId: ['', [Validators.required]],
      serviceName: ['', [Validators.required]],
      feeAmount: [0, [Validators.required, Validators.min(0)]],
      currency: ['GOV', [Validators.required]],

      transactionStatus: ['PENDING_REVIEW', [Validators.required]],
      paymentMethod: ['', [Validators.required]],

      paymentCode: [''],

      cardholderName: [''],
      cardNumber: [''],
      expiryDate: [''],
      cvv: [''],
      billingReference: [''],

      digitalStampRequired: [false],
      notes: ['']
    });

    this.uploadForm = this.fb.group({
      residentId: ['', [Validators.required]],
      residentName: ['', [Validators.required]],
      totalFees: [0, [Validators.required]],
      currency: ['GOV', [Validators.required]],
      documentType: ['', [Validators.required]],
      documentNumber: [''],
      expiryDate: [''],
      uploadedBy: ['Officer']
    });
  }

  ngOnInit(): void {
    this.loadResidents();
    this.loadServices();
    this.loadTransactionStatuses();
    this.loadPaymentMethods();

    this.transactionForm.get('paymentMethod')?.valueChanges.subscribe(() => {
      this.onPaymentMethodChange();
    });
  }

  loadResidents(): void {
    this.governmentTransactionApi.getResidentsDropdown().subscribe({
      next: (response) => {
        const rows = response?.data || [];

        this.residents = rows.map((row: any) => ({
          dbId: Number(row.id || row.value || 0),
          residentId: row.resident_id || '',
          residentName: row.full_name || row.name || '',
          walletAddress: row.wallet_address || '',
          nationalId: row.national_id_number || '',
          mobile: row.mobile_number || '',
          email: row.email || '',
          walletCurrency: 'GOV',
          walletStatus: row.wallet_status || 'ACTIVE',
          walletBalance: Number(row.wallet_balance || 0)
        }));
      },
      error: (error) => {
        console.error('[RESIDENTS DROPDOWN ERROR]', error);
        this.residents = [];
      }
    });
  }

  loadServices(): void {
    this.governmentTransactionApi.getServices().subscribe({
      next: (response) => {
        const rows = response?.data || [];

        this.services = rows.map((row: any) => ({
          serviceId: Number(row.service_id || row.id || 0),
          servicePublicId: row.service_public_id || '',
          serviceCode: row.service_code || '',
          serviceName: row.service_name || row.name || '',
          arabicName: row.arabic_name || '',
          ministryId: row.ministry_id || '',
          administrationId: row.administration_id || '',
          categoryId: row.category_id || '',
          feeAmount: Number(row.fee_amount || row.fees || 0),
          currency: 'GOV',
          digitalStampRequired:
            row.digital_stamp_required === true ||
            row.digital_stamp_required === 'true',
          processingTime: row.processing_time || ''
        }));
      },
      error: (error) => {
        console.error('[SERVICES DROPDOWN ERROR]', error);
        this.services = [];
      }
    });
  }

  loadTransactionStatuses(): void {
    this.governmentTransactionApi.getTransactionStatuses().subscribe({
      next: (response) => {
        this.transactionStatuses = response?.data || [];
      },
      error: (error) => {
        console.error('[TRANSACTION STATUS ERROR]', error);
        this.transactionStatuses = [];
      }
    });
  }

  loadPaymentMethods(): void {
    this.governmentTransactionApi.getPaymentMethods().subscribe({
      next: (response) => {
        this.paymentMethods = response?.data || [];
      },
      error: (error) => {
        console.error('[PAYMENT METHODS ERROR]', error);
        this.paymentMethods = [];
      }
    });
  }

  onResidentChange(): void {
    const residentId = this.transactionForm.get('residentId')?.value;

    const selectedResident = this.residents.find(
      resident => String(resident.residentId) === String(residentId)
    );

    if (!selectedResident) {
      return;
    }

    this.transactionForm.patchValue({
      residentName: selectedResident.residentName,
      walletAddress: selectedResident.walletAddress,
      walletBalance: selectedResident.walletBalance,
      walletStatus: selectedResident.walletStatus,
      currency: 'GOV'
    });
  }

  onServiceChange(): void {
    const serviceId = this.transactionForm.get('serviceId')?.value;

    const selectedService = this.services.find(
      service => String(service.serviceId) === String(serviceId)
    );

    if (!selectedService) {
      this.selectedServiceDetails.set(null);
      this.transactionForm.patchValue({
        serviceName: '',
        feeAmount: 0,
        currency: 'GOV',
        digitalStampRequired: false
      });
      return;
    }

    this.selectedServiceDetails.set(selectedService);

    this.transactionForm.patchValue({
      serviceName: selectedService.serviceName,
      feeAmount: selectedService.feeAmount,
      currency: 'GOV',
      digitalStampRequired: selectedService.digitalStampRequired
    });
  }

  onPaymentMethodChange(): void {
    const paymentMethod = this.getPaymentMethod();

    const paymentCodeControl = this.transactionForm.get('paymentCode');

    const cardholderControl = this.transactionForm.get('cardholderName');
    const cardNumberControl = this.transactionForm.get('cardNumber');
    const expiryControl = this.transactionForm.get('expiryDate');
    const cvvControl = this.transactionForm.get('cvv');
    const billingControl = this.transactionForm.get('billingReference');

    paymentCodeControl?.clearValidators();

    cardholderControl?.clearValidators();
    cardNumberControl?.clearValidators();
    expiryControl?.clearValidators();
    cvvControl?.clearValidators();
    billingControl?.clearValidators();

    if (paymentMethod === 'DIGITAL_STAMP_WALLET') {
      paymentCodeControl?.setValidators([Validators.required]);
    }

    if (paymentMethod === 'BANK_CARD') {
      cardholderControl?.setValidators([Validators.required]);
      cardNumberControl?.setValidators([
        Validators.required,
        Validators.minLength(12)
      ]);
      expiryControl?.setValidators([Validators.required]);
      cvvControl?.setValidators([
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(4)
      ]);
      billingControl?.setValidators([Validators.required]);
    }

    paymentCodeControl?.updateValueAndValidity();

    cardholderControl?.updateValueAndValidity();
    cardNumberControl?.updateValueAndValidity();
    expiryControl?.updateValueAndValidity();
    cvvControl?.updateValueAndValidity();
    billingControl?.updateValueAndValidity();

    this.transactionForm.patchValue({
      currency: 'GOV'
    });
  }

  getSelectedResident(): ResidentOption | null {
    const residentId = this.transactionForm.get('residentId')?.value;

    return this.residents.find(
      resident => String(resident.residentId) === String(residentId)
    ) || null;
  }

  getSelectedService(): ServiceOption | null {
    const serviceId = this.transactionForm.get('serviceId')?.value;

    return this.services.find(
      service => String(service.serviceId) === String(serviceId)
    ) || null;
  }

  getPaymentMethod(): string {
    return String(this.transactionForm.get('paymentMethod')?.value || '').toUpperCase();
  }

  getFeeBreakdown(): FeeBreakdown {
    const baseFee = Number(this.transactionForm.get('feeAmount')?.value || 0);
    const paymentMethod = this.getPaymentMethod();

    let feePercentage = 0;

    if (paymentMethod === 'CASH_OFFICE_PAYMENT') {
      feePercentage = 5;
    }

    if (paymentMethod === 'GOVERNMENT_PAYMENT_GATEWAY') {
      feePercentage = 10;
    }

    const feeExtraAmount = Math.round((baseFee * feePercentage / 100) * 100) / 100;
    const totalFee = Math.round((baseFee + feeExtraAmount) * 100) / 100;

    return {
      baseFee,
      feePercentage,
      feeExtraAmount,
      totalFee,
      currency: 'GOV'
    };
  }

  submitTransaction(): void {
    this.successMessage = '';
    this.errorMessage = '';

    const calculatedStatus = this.getCalculatedTransactionStatus();

    this.transactionForm.patchValue({
      transactionStatus: calculatedStatus,
      currency: 'GOV'
    });

    if (this.transactionForm.invalid) {
      this.transactionForm.markAllAsTouched();
      this.errorMessage = 'Please fill all required fields before submitting.';
      return;
    }

    const selectedResident = this.getSelectedResident();
    const selectedService = this.getSelectedService();

    if (!selectedResident || !selectedService) {
      this.errorMessage = 'Resident and service are required.';
      return;
    }

    const feeBreakdown = this.getFeeBreakdown();
    const formValue = this.transactionForm.getRawValue();
    const paymentMethod = this.getPaymentMethod();

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
        currency_code: 'GOV',
        digitalStampRequired: selectedService.digitalStampRequired
      },
      transaction: {
        clientTransactionId: formValue.transactionId,
        amount: feeBreakdown.totalFee,
        baseFee: feeBreakdown.baseFee,
        feeExtraAmount: feeBreakdown.feeExtraAmount,
        feePercentage: feeBreakdown.feePercentage,
        currencyCode: 'GOV',
        paymentMethod,
        paymentCode: formValue.paymentCode,
        bankCard: {
          cardholderName: formValue.cardholderName,
          cardNumber: formValue.cardNumber,
          expiryDate: formValue.expiryDate,
          cvv: formValue.cvv,
          billingReference: formValue.billingReference
        },
        transactionType: 'GOVERNMENT_SERVICE',
        transactionStatus: calculatedStatus,
        notes: formValue.notes
      },
      documents: this.uploadedDocuments(),
      createdBy: {
        accountType: 'PUBLIC_ADMINISTRATION',
        loginUsername: 'system',
        walletAddress: null
      }
    };

    this.isSubmitting = true;

    this.governmentTransactionApi.createTransaction(payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;

        this.successMessage =
          response?.message ||
          `Transaction ${response?.transactionReference || ''} saved successfully.`;

        this.errorMessage = '';

        if (response?.transactionReference) {
          this.transactionForm.patchValue({
            transactionId: response.transactionReference,
            transactionStatus: response.transactionStatus || calculatedStatus
          });
        }

        this.receiptData = this.buildReceiptData(response);
        this.showReceiptPopup = true;
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('[CREATE TRANSACTION ERROR]', error);

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to create government transaction.';
      }
    });
  }

  openUploadDocuments(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.uploadMessage = '';

    const selectedResident = this.getSelectedResident();

    if (!selectedResident) {
      this.errorMessage = 'Please select a resident before uploading documents.';
      return;
    }

    this.uploadForm.patchValue({
      residentId: selectedResident.residentId,
      residentName: selectedResident.residentName,
      totalFees: this.getFeeBreakdown().totalFee,
      currency: 'GOV'
    });

    this.selectedUploadFile = null;
    this.showUploadModal = true;
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
    this.uploadMessage = '';
    this.selectedUploadFile = null;

    if (this.documentFileInput?.nativeElement) {
      this.documentFileInput.nativeElement.value = '';
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedUploadFile = input.files && input.files.length > 0
      ? input.files[0]
      : null;
  }

  submitKycDocument(): void {
    this.uploadMessage = '';

    if (this.uploadForm.invalid) {
      this.uploadForm.markAllAsTouched();
      this.uploadMessage = 'Please fill required upload fields.';
      return;
    }

    if (!this.selectedUploadFile) {
      this.uploadMessage = 'Please choose a document file.';
      return;
    }

    const uploadValue = this.uploadForm.getRawValue();
    const formData = new FormData();

    const transactionReference =
      this.receiptData?.transactionReference ||
      this.receiptData?.transaction_reference ||
      this.transactionForm?.get('transactionId')?.value ||
      this.transactionForm?.get('transactionReference')?.value ||
      this.transactionForm?.get('transaction_reference')?.value ||
      '';

    if (transactionReference) {
      formData.append('transaction_id', String(transactionReference));
      formData.append('transaction_reference', String(transactionReference));
    }

    formData.append('document', this.selectedUploadFile);
    formData.append('resident_id', uploadValue.residentId);
    formData.append('resident_name', uploadValue.residentName);
    formData.append('document_type', uploadValue.documentType);
    formData.append('document_number', uploadValue.documentNumber || '');
    formData.append('expiry_date', uploadValue.expiryDate || '');
    formData.append('uploaded_by', uploadValue.uploadedBy || 'Officer');
    formData.append('total_fees', String(uploadValue.totalFees || 0));
    formData.append('currency', 'GOV');
    formData.append('status', 'Pending Review');

    this.isUploadingDocument = true;

    this.governmentTransactionApi.uploadKycDocument(formData).subscribe({
      next: (response) => {
        this.isUploadingDocument = false;

        const row = response?.data || {};
        const file = this.selectedUploadFile as File;

        const newDocument: UploadedDocument = {
          id: String(row.id || `DOC-${Date.now()}`),
          fileName: file.name,
          documentType: uploadValue.documentType,
          size: this.formatFileSize(file.size),
          hash: row.document_hash || row.hash || 'Generated',
          status: 'Uploaded'
        };

        this.uploadedDocuments.update((docs) => [...docs, newDocument]);

        this.uploadMessage = response?.message || 'KYC document uploaded successfully.';
        this.selectedUploadFile = null;

        if (this.documentFileInput?.nativeElement) {
          this.documentFileInput.nativeElement.value = '';
        }
      },
      error: (error) => {
        this.isUploadingDocument = false;
        console.error('[KYC DOCUMENT UPLOAD ERROR]', error);

        this.uploadMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to upload KYC document.';
      }
    });
  }

  generateHash(): void {
    const docs = this.uploadedDocuments();

    if (docs.length === 0) {
      this.errorMessage = 'Please upload at least one document before generating hashes.';
      return;
    }

    this.uploadedDocuments.set(
      docs.map((doc, index) => {
        if (doc.hash && doc.hash !== 'Pending generation') {
          return doc;
        }

        return {
          ...doc,
          hash: `0x${this.generatePseudoHash(doc.fileName, index)}`,
          status: 'Verified'
        };
      })
    );

    this.successMessage = 'Document hashes generated successfully.';
    this.errorMessage = '';
  }

  getCalculatedTransactionStatus(): string {
    return this.getFeeBreakdown().totalFee < 10000000
      ? 'APPROVED'
      : 'PENDING_REVIEW';
  }

  getCalculatedTransactionStatusLabel(): string {
    return this.getCalculatedTransactionStatus() === 'APPROVED'
      ? 'Approved'
      : 'Pending Review';
  }

  buildReceiptData(response: any): any {
    const selectedResident = this.getSelectedResident();
    const selectedService = this.getSelectedService();
    const feeBreakdown = response?.feeBreakdown || this.getFeeBreakdown();

    return {
      transactionReference:
        response?.transactionReference ||
        response?.data?.transaction_reference ||
        this.transactionForm.get('transactionId')?.value,
      transactionStatus:
        response?.transactionStatus ||
        response?.data?.transaction_status ||
        this.getCalculatedTransactionStatus(),
      autoApproved:
        response?.autoApproved ??
        (this.getCalculatedTransactionStatus() === 'APPROVED'),
      residentName:
        selectedResident?.residentName ||
        response?.data?.resident_full_name ||
        response?.data?.resident_name ||
        '',
      residentId:
        selectedResident?.residentId ||
        response?.data?.resident_id ||
        '',
      walletAddress:
        selectedResident?.walletAddress ||
        response?.data?.resident_wallet_address ||
        '',
      serviceName:
        selectedService?.serviceName ||
        response?.data?.service_name ||
        '',
      serviceCode:
        selectedService?.serviceCode ||
        response?.data?.service_code ||
        '',
      paymentMethod:
        response?.paymentMethod ||
        response?.data?.payment_method ||
        this.getPaymentMethod(),
      baseFee: feeBreakdown.baseFee || response?.data?.base_fee || 0,
      extraFee: feeBreakdown.feeExtraAmount || response?.data?.fee_extra_amount || 0,
      feePercentage: feeBreakdown.feePercentage || response?.data?.fee_percentage || 0,
      totalFee: feeBreakdown.totalFee || response?.data?.total_fee || 0,
      currency: 'GOV',
      createdAt:
        response?.data?.created_at ||
        new Date().toISOString(),
      uploadedDocumentsCount: this.uploadedDocuments().length
    };
  }

  closeReceiptPopup(): void {
    this.showReceiptPopup = false;
  }

  printReceipt(): void {
    window.print();
  }

  generatePseudoHash(value: string, index: number): string {
    const source = `${value}-${index}-${Date.now()}-${Math.random()}`;
    let hash = '';

    for (let i = 0; i < source.length; i++) {
      hash += source.charCodeAt(i).toString(16);
    }

    return hash.padEnd(64, '0').slice(0, 64);
  }

  formatFileSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${Math.round(size / 1024)} KB`;
    }

    return `${Math.round(size / (1024 * 1024))} MB`;
  }

  generateTransactionId(): string {
    return `GOV-TXN-${Date.now()}`;
  }

  isInvalid(controlName: string): boolean {
    const control = this.transactionForm.get(controlName) || this.uploadForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  getStatusLabel(status: string): string {
    if (status === 'APPROVED') {
      return 'Approved';
    }

    if (status === 'PENDING_REVIEW') {
      return 'Pending Review';
    }

    return status || this.getCalculatedTransactionStatusLabel();
  }

  getStatusClass(status: string): string {
    const value = String(status || '').toLowerCase().replace(/_/g, '-');

    if (value.includes('pending')) {
      return 'status-pending';
    }

    if (value.includes('approved')) {
      return 'status-approved';
    }

    if (value.includes('rejected') || value.includes('failed')) {
      return 'status-rejected';
    }

    return 'status-default';
  }

  getDocumentStatusClass(status: string): string {
    const value = String(status || '').toLowerCase();

    if (value.includes('verified')) {
      return 'status-approved';
    }

    if (value.includes('pending')) {
      return 'status-pending';
    }

    if (value.includes('uploaded')) {
      return 'status-submitted';
    }

    return 'status-default';
  }
}
