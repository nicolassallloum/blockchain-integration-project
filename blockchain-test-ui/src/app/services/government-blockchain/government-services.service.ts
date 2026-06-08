import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type ServiceStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
}

export interface GovernmentService {
  serviceId: string;
  servicePublicId: string;
  serviceCode: string;
  serviceName: string;
  arabicName: string;
  ministryId: string;
  ministryName: string;
  administrationId: string;
  administrationName: string;
  categoryId: string;
  categoryName: string;
  feeAmount: number;
  currencyCode: string;
  requiredDocuments: string;
  digitalStampRequired: boolean;
  processingTime: string;
  serviceStatus: ServiceStatus;
  description: string;
  createdAt: string;
}

export interface GovernmentServiceForm {
  serviceCode: string;
  serviceName: string;
  arabicName?: string;
  ministryId?: string;
  administrationId?: string;
  categoryId: string;
  feeAmount: number;
  currencyCode: 'GOV';
  requiredDocuments?: string;
  digitalStampRequired: boolean;
  processingTime?: string;
  serviceStatus: ServiceStatus;
  description?: string;
}

export interface GovernmentServiceCategory {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
}

export interface GovernmentServiceReferenceMinistry {
  ministryId: string;
  ministryName: string;
}

export interface GovernmentServiceReferenceAdministration {
  id: string;
  name: string;
  administrationId: string;
  administrationName: string;
}

export interface GovernmentServicesFilter {
  search?: string;
  ministryId?: string;
  categoryId?: string;
  status?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GovernmentServicesService {
  private readonly baseApiUrl = 'http://172.31.13.90:3001/api/v1';

  private readonly servicesUrl =
    `${this.baseApiUrl}/government-blockchain/services`;

  private readonly ministriesUrl =
    `${this.baseApiUrl}/government-blockchain/ministries`;

  private readonly administrationsUrl =
    `${this.baseApiUrl}/government-blockchain/public-administrations`;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.servicesUrl}/summary`);
  }

  getServices(filters: GovernmentServicesFilter = {}): Observable<ApiResponse<any[]>> {
    let params = new HttpParams();

    if (filters.search?.trim()) {
      params = params.set('search', filters.search.trim());
    }

    if (filters.ministryId) {
      params = params.set('ministryId', filters.ministryId);
    }

    if (filters.categoryId) {
      params = params.set('categoryId', filters.categoryId);
    }

    if (filters.status) {
      params = params.set('status', filters.status);
    }

    return this.http.get<ApiResponse<any[]>>(this.servicesUrl, { params });
  }

  getServiceById(serviceId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.servicesUrl}/${serviceId}`);
  }

  createService(payload: GovernmentServiceForm): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(this.servicesUrl, {
      ...payload,
      currencyCode: 'GOV',
    });
  }

  updateService(
    serviceId: string,
    payload: GovernmentServiceForm
  ): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.servicesUrl}/${serviceId}`, {
      ...payload,
      currencyCode: 'GOV',
    });
  }

  updateServiceStatus(
    serviceId: string,
    status: ServiceStatus
  ): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(
      `${this.servicesUrl}/${serviceId}/status`,
      {
        status,
        updatedBy: 'nix',
      }
    );
  }

  deleteService(serviceId: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.servicesUrl}/${serviceId}`);
  }

  getCategories(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.servicesUrl}/reference/categories`
    );
  }

  getGovCurrency(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${this.servicesUrl}/reference/currency`
    );
  }

  getMinistries(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(this.ministriesUrl);
  }

  getAdministrations(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.administrationsUrl}/dropdown`
    );
  }

  extractArray(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.data)) {
      return response.data;
    }

    if (Array.isArray(response?.rows)) {
      return response.rows;
    }

    if (Array.isArray(response?.result)) {
      return response.result;
    }

    if (Array.isArray(response?.records)) {
      return response.records;
    }

    if (Array.isArray(response?.items)) {
      return response.items;
    }

    if (Array.isArray(response?.data?.rows)) {
      return response.data.rows;
    }

    if (Array.isArray(response?.data?.data)) {
      return response.data.data;
    }

    if (Array.isArray(response?.data?.records)) {
      return response.data.records;
    }

    if (Array.isArray(response?.data?.items)) {
      return response.data.items;
    }

    return [];
  }

  mapServices(rows: any[]): GovernmentService[] {
    return rows.map((row) => ({
      serviceId: this.toStringValue(row.service_id ?? row.serviceId),
      servicePublicId: this.toStringValue(
        row.service_public_id ??
          row.servicePublicId ??
          row.service_id ??
          row.serviceId
      ),
      serviceCode: this.toStringValue(row.service_code ?? row.serviceCode),
      serviceName: this.toStringValue(row.service_name ?? row.serviceName),
      arabicName: this.toStringValue(row.arabic_name ?? row.arabicName),

      ministryId: this.toStringValue(row.ministry_id ?? row.ministryId),
      ministryName: this.toStringValue(
        row.ministry_name ??
          row.ministryName ??
          row.ministry ??
          'Not Assigned'
      ),

      administrationId: this.toStringValue(
        row.administration_id ?? row.administrationId
      ),
      administrationName: this.toStringValue(
        row.administration_name ??
          row.administrationName ??
          row.administration ??
          'Not Assigned'
      ),

      categoryId: this.toStringValue(row.category_id ?? row.categoryId),
      categoryName: this.toStringValue(
        row.category_name ??
          row.categoryName ??
          row.service_category ??
          row.serviceCategory
      ),

      feeAmount: Number(row.fee_amount ?? row.feeAmount ?? 0),
      currencyCode: this.toStringValue(
        row.currency_code ?? row.currencyCode ?? 'GOV'
      ),

      requiredDocuments: this.toStringValue(
        row.required_documents ?? row.requiredDocuments
      ),

      digitalStampRequired: this.toBoolean(
        row.digital_stamp_required ?? row.digitalStampRequired
      ),

      processingTime: this.toStringValue(
        row.processing_time ?? row.processingTime
      ),

      serviceStatus: this.normalizeStatus(
        row.service_status ?? row.serviceStatus
      ),

      description: this.toStringValue(row.description),
      createdAt: this.toStringValue(row.created_at ?? row.createdAt),
    }));
  }

  mapCategories(rows: any[]): GovernmentServiceCategory[] {
    return rows
      .map((row) => ({
        categoryId: this.toStringValue(
          row.category_id ??
            row.categoryId ??
            row.id
        ),
        categoryCode: this.toStringValue(
          row.category_code ??
            row.categoryCode ??
            row.code
        ),
        categoryName: this.toStringValue(
          row.category_name ??
            row.categoryName ??
            row.name
        ),
      }))
      .filter((item) => item.categoryId && item.categoryName);
  }

  mapMinistries(rows: any[]): GovernmentServiceReferenceMinistry[] {
    return rows
      .map((row) => ({
        ministryId: this.toStringValue(
          row.ministry_id ??
            row.ministryId ??
            row.id
        ),
        ministryName: this.toStringValue(
          row.ministry_name ??
            row.ministryName ??
            row.name ??
            row.ministry_english_name ??
            row.english_name ??
            row.englishName ??
            row.ministry_code ??
            row.ministryCode
        ),
      }))
      .filter((item) => item.ministryId && item.ministryName);
  }

  mapAdministrations(rows: any[]): GovernmentServiceReferenceAdministration[] {
    return rows.map((row) => {
      const id = this.toStringValue(
        row.id ??
          row.administration_id ??
          row.administrationId
      );

      const name = this.toStringValue(
        row.name ??
          row.administration_name ??
          row.administrationName ??
          'Unnamed Administration'
      );

      return {
        id,
        name,
        administrationId: id,
        administrationName: name,
      };
    });
  }


  private toBoolean(value: any): boolean {
    return (
      value === true ||
      value === 'true' ||
      value === 'TRUE' ||
      value === 'YES' ||
      value === 'Yes' ||
      value === 'yes' ||
      value === '1' ||
      value === 1
    );
  }

  private normalizeStatus(value: any): ServiceStatus {
    const status = String(value || 'DRAFT').toUpperCase();

    if (status === 'ACTIVE' || status === 'INACTIVE' || status === 'DRAFT') {
      return status as ServiceStatus;
    }

    return 'DRAFT';
  }

  private toStringValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }
}