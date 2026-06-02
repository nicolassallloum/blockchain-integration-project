import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GovernmentService,
  GovernmentServiceCategory,
  GovernmentServiceForm,
  GovernmentServiceReferenceAdministration,
  GovernmentServiceReferenceMinistry,
  GovernmentServicesService,
  ServiceStatus,
} from '../../../services/government-blockchain/government-services.service';

@Component({
  selector: 'app-government-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './government-services.component.html',
  styleUrl: './government-services.component.scss',
})
export class GovernmentServicesComponent implements OnInit {
  loading = false;

  successMessage = '';
  errorMessage = '';

  searchText = '';
  selectedStatus = '';
  selectedMinistryId = '';
  selectedCategoryId = '';

  totalServices = 0;
  activeServices = 0;
  inactiveServices = 0;
  draftServices = 0;

  services: GovernmentService[] = [];
  categories: GovernmentServiceCategory[] = [];
  ministries: GovernmentServiceReferenceMinistry[] = [];
  administrations: GovernmentServiceReferenceAdministration[] = [];

  showForm = false;
  isEditMode = false;
  selectedServiceId = '';

  form: GovernmentServiceForm = this.getEmptyForm();

  constructor(private governmentServicesService: GovernmentServicesService) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loadSummary();
    this.loadCategories();
    this.loadMinistries();
    this.loadAdministrations();
    this.loadServices();
  }

  loadSummary(): void {
    this.governmentServicesService.getSummary().subscribe({
      next: (response) => {
        const data = response?.data;

        this.totalServices = Number(
          data?.total_services ?? data?.totalServices ?? 0
        );

        this.activeServices = Number(
          data?.active_services ?? data?.activeServices ?? 0
        );

        this.inactiveServices = Number(
          data?.inactive_services ?? data?.inactiveServices ?? 0
        );

        this.draftServices = Number(
          data?.draft_services ?? data?.draftServices ?? 0
        );
      },
      error: (error) => {
        console.error('[SERVICES SUMMARY ERROR]', error);
      },
    });
  }

  loadCategories(): void {
    this.governmentServicesService.getCategories().subscribe({
      next: (response) => {
        const rows = this.governmentServicesService.extractArray(response);
        this.categories = this.governmentServicesService.mapCategories(rows);

        if (this.categories.length === 0) {
          this.categories = this.getDefaultCategories();
        }

        console.log('[SERVICE CATEGORIES RAW]', response);
        console.log('[SERVICE CATEGORIES MAPPED]', this.categories);
      },
      error: (error) => {
        console.error('[SERVICE CATEGORIES ERROR]', error);
        this.categories = this.getDefaultCategories();
      },
    });
  }

  loadMinistries(): void {
    this.governmentServicesService.getMinistries().subscribe({
      next: (response) => {
        const rows = this.governmentServicesService.extractArray(response);
        this.ministries = this.governmentServicesService.mapMinistries(rows);

        console.log('[MINISTRIES RAW]', response);
        console.log('[MINISTRIES MAPPED]', this.ministries);
      },
      error: (error) => {
        console.error('[MINISTRIES ERROR]', error);
        this.ministries = [];
      },
    });
  }

  loadAdministrations(): void {
    this.governmentServicesService.getAdministrations().subscribe({
      next: (response) => {
        const rows = this.governmentServicesService.extractArray(response);
        this.administrations =
          this.governmentServicesService.mapAdministrations(rows);

        console.log('[ADMINISTRATIONS RAW]', response);
        console.log('[ADMINISTRATIONS MAPPED]', this.administrations);
      },
      error: (error) => {
        console.error('[ADMINISTRATIONS ERROR]', error);
        this.administrations = [];
      },
    });
  }

  loadServices(): void {
    this.loading = true;
    this.clearMessages();

    this.governmentServicesService
      .getServices({
        search: this.searchText,
        ministryId: this.selectedMinistryId,
        categoryId: this.selectedCategoryId,
        status: this.selectedStatus,
      })
      .subscribe({
        next: (response) => {
          const rows = this.governmentServicesService.extractArray(response);
          this.services = this.governmentServicesService.mapServices(rows);

          console.log('[SERVICES RAW]', response);
          console.log('[SERVICES MAPPED]', this.services);

          this.loading = false;
        },
        error: (error) => {
          console.error('[SERVICES LIST ERROR]', error);
          this.errorMessage = 'Failed to load government services.';
          this.loading = false;
        },
      });
  }

  openCreateForm(): void {
    this.clearMessages();
    this.showForm = true;
    this.isEditMode = false;
    this.selectedServiceId = '';
    this.form = this.getEmptyForm();
  }

  editService(service: GovernmentService): void {
    this.clearMessages();

    this.showForm = true;
    this.isEditMode = true;
    this.selectedServiceId = service.serviceId || service.servicePublicId;

    this.form = {
      serviceCode: service.serviceCode,
      serviceName: service.serviceName,
      arabicName: service.arabicName || '',
      ministryId: service.ministryId || '',
      administrationId: service.administrationId || '',
      categoryId: service.categoryId || '',
      feeAmount: Number(service.feeAmount || 0),
      currencyCode: 'GOV',
      requiredDocuments: service.requiredDocuments || '',
      digitalStampRequired: !!service.digitalStampRequired,
      processingTime: service.processingTime || '',
      serviceStatus: service.serviceStatus || 'DRAFT',
      description: service.description || '',
    };
  }

  submitService(): void {
    this.clearMessages();

    const payload: GovernmentServiceForm = {
      ...this.form,
      ministryId: this.form.ministryId || '',
      administrationId: this.form.administrationId || '',
      categoryId: this.form.categoryId,
      feeAmount: Number(this.form.feeAmount || 0),
      currencyCode: 'GOV',
      digitalStampRequired: !!this.form.digitalStampRequired,
      serviceStatus: this.form.serviceStatus || 'DRAFT',
    };

    if (!payload.serviceCode || !payload.serviceName || !payload.categoryId) {
      this.errorMessage = 'Service Code, Service Name, and Category are required.';
      return;
    }

    this.loading = true;

    const request$ = this.isEditMode
      ? this.governmentServicesService.updateService(this.selectedServiceId, payload)
      : this.governmentServicesService.createService(payload);

    request$.subscribe({
      next: (response) => {
        this.successMessage =
          response?.message ||
          (this.isEditMode
            ? 'Government service updated successfully.'
            : 'Government service created successfully.');

        this.loading = false;
        this.closeForm();
        this.loadSummary();
        this.loadServices();
      },
      error: (error) => {
        console.error('[SERVICE SAVE ERROR]', error);

        this.errorMessage =
          error?.error?.message ||
          (this.isEditMode
            ? 'Failed to update government service.'
            : 'Failed to create government service.');

        this.loading = false;
      },
    });
  }

  activateService(service: GovernmentService): void {
    this.updateServiceStatus(service, 'ACTIVE');
  }

  deactivateService(service: GovernmentService): void {
    this.updateServiceStatus(service, 'INACTIVE');
  }

  updateServiceStatus(service: GovernmentService, status: ServiceStatus): void {
    this.clearMessages();

    const serviceIdentifier = service.serviceId || service.servicePublicId;

    if (!serviceIdentifier) {
      this.errorMessage = 'Service ID is missing.';
      return;
    }

    this.loading = true;

    this.governmentServicesService
      .updateServiceStatus(serviceIdentifier, status)
      .subscribe({
        next: (response) => {
          this.successMessage =
            response?.message ||
            `Service status updated to ${this.formatStatus(status)}.`;

          this.loading = false;
          this.loadSummary();
          this.loadServices();
        },
        error: (error) => {
          console.error('[SERVICE STATUS ERROR]', error);
          this.errorMessage =
            error?.error?.message || 'Failed to update service status.';
          this.loading = false;
        },
      });
  }

  viewTransactions(service: GovernmentService): void {
    console.log('View Transactions:', service);
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedStatus = '';
    this.selectedMinistryId = '';
    this.selectedCategoryId = '';
    this.loadServices();
  }

  closeForm(): void {
    this.showForm = false;
    this.isEditMode = false;
    this.selectedServiceId = '';
    this.form = this.getEmptyForm();
  }

  getStatusClass(status: ServiceStatus | string): string {
    switch ((status || '').toUpperCase()) {
      case 'ACTIVE':
        return 'status-active';
      case 'INACTIVE':
        return 'status-inactive';
      case 'DRAFT':
        return 'status-draft';
      default:
        return '';
    }
  }

  getStampClass(value: boolean): string {
    return value ? 'stamp-required' : 'stamp-not-required';
  }

  formatStatus(status: ServiceStatus | string): string {
    const value = (status || '').toUpperCase();

    if (value === 'ACTIVE') {
      return 'Active';
    }

    if (value === 'INACTIVE') {
      return 'Inactive';
    }

    if (value === 'DRAFT') {
      return 'Draft';
    }

    return status || '-';
  }

  private getEmptyForm(): GovernmentServiceForm {
    return {
      serviceCode: '',
      serviceName: '',
      arabicName: '',
      ministryId: '',
      administrationId: '',
      categoryId: '',
      feeAmount: 0,
      currencyCode: 'GOV',
      requiredDocuments: '',
      digitalStampRequired: true,
      processingTime: '',
      serviceStatus: 'DRAFT',
      description: '',
    };
  }

  private getDefaultCategories(): GovernmentServiceCategory[] {
    return [
      {
        categoryId: '1',
        categoryCode: 'FINANCE',
        categoryName: 'Finance',
      },
      {
        categoryId: '2',
        categoryCode: 'CIVIL_AFFAIRS',
        categoryName: 'Civil Affairs',
      },
      {
        categoryId: '3',
        categoryCode: 'HEALTH',
        categoryName: 'Health',
      },
      {
        categoryId: '4',
        categoryCode: 'TRANSPORT',
        categoryName: 'Transport',
      },
      {
        categoryId: '5',
        categoryCode: 'GENERAL',
        categoryName: 'General',
      },
    ];
  }

  private clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}