import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ServiceStatus = 'Active' | 'Inactive' | 'Draft';
type DigitalStampRequired = 'Yes' | 'No';

interface GovernmentService {
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  arabicName: string;
  ministry: string;
  administration: string;
  serviceCategory: string;
  feeAmount: number;
  currency: string;
  requiredDocuments: string;
  digitalStampRequired: DigitalStampRequired;
  processingTime: string;
  serviceStatus: ServiceStatus;
  createdAt: string;
}

@Component({
  selector: 'app-government-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './government-services.component.html',
  styleUrl: './government-services.component.scss',
})
export class GovernmentServicesComponent {
  searchText = '';
  selectedStatus = '';
  selectedMinistry = '';
  selectedCategory = '';

  services: GovernmentService[] = [
    {
      serviceId: 'SRV-001',
      serviceCode: 'MOF-TAX-001',
      serviceName: 'Tax Clearance Certificate',
      arabicName: 'إفادة براءة ذمة ضريبية',
      ministry: 'Ministry of Finance',
      administration: 'Tax Administration',
      serviceCategory: 'Finance',
      feeAmount: 250000,
      currency: 'LBP',
      requiredDocuments: 'National ID, Tax Number, Application Form',
      digitalStampRequired: 'Yes',
      processingTime: '2 Business Days',
      serviceStatus: 'Active',
      createdAt: '2026-05-22',
    },
    {
      serviceId: 'SRV-002',
      serviceCode: 'MOI-CR-001',
      serviceName: 'Civil Registry Extract',
      arabicName: 'إخراج قيد فردي',
      ministry: 'Ministry of Interior',
      administration: 'Civil Status Administration',
      serviceCategory: 'Civil Affairs',
      feeAmount: 100000,
      currency: 'LBP',
      requiredDocuments: 'National ID, Family Registry Number',
      digitalStampRequired: 'Yes',
      processingTime: '1 Business Day',
      serviceStatus: 'Active',
      createdAt: '2026-05-22',
    },
    {
      serviceId: 'SRV-003',
      serviceCode: 'MOPH-LIC-001',
      serviceName: 'Medical License Renewal',
      arabicName: 'تجديد ترخيص طبي',
      ministry: 'Ministry of Public Health',
      administration: 'Medical Licensing Department',
      serviceCategory: 'Health',
      feeAmount: 500000,
      currency: 'LBP',
      requiredDocuments: 'License Copy, National ID, Syndicate Certificate',
      digitalStampRequired: 'Yes',
      processingTime: '5 Business Days',
      serviceStatus: 'Draft',
      createdAt: '2026-05-22',
    },
    {
      serviceId: 'SRV-004',
      serviceCode: 'MOT-VEH-001',
      serviceName: 'Vehicle Registration Renewal',
      arabicName: 'تجديد تسجيل مركبة',
      ministry: 'Ministry of Transport',
      administration: 'Vehicle Registration Authority',
      serviceCategory: 'Transport',
      feeAmount: 750000,
      currency: 'LBP',
      requiredDocuments: 'Vehicle Registration, Insurance, National ID',
      digitalStampRequired: 'No',
      processingTime: '3 Business Days',
      serviceStatus: 'Inactive',
      createdAt: '2026-05-22',
    },
  ];

  get totalServices(): number {
    return this.services.length;
  }

  get activeServices(): number {
    return this.services.filter((item) => item.serviceStatus === 'Active').length;
  }

  get inactiveServices(): number {
    return this.services.filter((item) => item.serviceStatus === 'Inactive').length;
  }

  get draftServices(): number {
    return this.services.filter((item) => item.serviceStatus === 'Draft').length;
  }

  get filteredServices(): GovernmentService[] {
    return this.services.filter((service) => {
      const keyword = this.searchText.trim().toLowerCase();

      const matchesSearch =
        !keyword ||
        service.serviceId.toLowerCase().includes(keyword) ||
        service.serviceCode.toLowerCase().includes(keyword) ||
        service.serviceName.toLowerCase().includes(keyword) ||
        service.arabicName.toLowerCase().includes(keyword) ||
        service.ministry.toLowerCase().includes(keyword) ||
        service.administration.toLowerCase().includes(keyword);

      const matchesStatus =
        !this.selectedStatus || service.serviceStatus === this.selectedStatus;

      const matchesMinistry =
        !this.selectedMinistry || service.ministry === this.selectedMinistry;

      const matchesCategory =
        !this.selectedCategory || service.serviceCategory === this.selectedCategory;

      return matchesSearch && matchesStatus && matchesMinistry && matchesCategory;
    });
  }

  createService(): void {
    console.log('Create Service clicked');
  }

  editService(service: GovernmentService): void {
    console.log('Edit Service:', service);
  }

  activateService(service: GovernmentService): void {
    service.serviceStatus = 'Active';
    console.log('Activate Service:', service);
  }

  deactivateService(service: GovernmentService): void {
    service.serviceStatus = 'Inactive';
    console.log('Deactivate Service:', service);
  }

  viewTransactions(service: GovernmentService): void {
    console.log('View Transactions:', service);
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedStatus = '';
    this.selectedMinistry = '';
    this.selectedCategory = '';
  }

  getStatusClass(status: ServiceStatus): string {
    switch (status) {
      case 'Active':
        return 'status-active';
      case 'Inactive':
        return 'status-inactive';
      case 'Draft':
        return 'status-draft';
      default:
        return '';
    }
  }

  getStampClass(value: DigitalStampRequired): string {
    return value === 'Yes' ? 'stamp-required' : 'stamp-not-required';
  }
}
