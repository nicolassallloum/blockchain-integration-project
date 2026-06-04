import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ResidentSearchFilters {
  residentId?: string;
  walletAddress?: string;
  fullName?: string;
  nationalId?: string;
  mobile?: string;
}

export interface GovernmentServiceFilters {
  ministryId?: number | string;
  administrationId?: number | string;
  categoryId?: number | string;
  serviceStatus?: string;
  search?: string;
}

export interface TransactionListFilters {
  transactionReference?: string;
  residentId?: string;
  walletAddress?: string;
  serviceCode?: string;
  transactionStatus?: string;
  blockchainStatus?: string;
  fromDate?: string;
  toDate?: string;
}

export interface GovernmentTransactionPayload {
  resident: {
    residentId?: string;
    resident_id?: string;
    walletAddress?: string;
    wallet_address?: string;
    fullName?: string;
    full_name?: string;
    nationalId?: string;
    national_id?: string;
    mobile?: string;
    mobile_number?: string;
    email?: string;
  };

  service: {
    serviceId?: number;
    service_id?: number;
    servicePublicId?: string;
    service_public_id?: string;
    serviceCode?: string;
    service_code?: string;
    serviceName?: string;
    service_name?: string;
    arabicName?: string;
    arabic_name?: string;
    ministryId?: number;
    ministry_id?: number;
    administrationId?: number;
    administration_id?: number;
    categoryId?: number;
    category_id?: number;
    fee_amount?: number;
    currency_code?: string;
  };

  transaction: {
    amount?: number;
    currency?: string;
    currencyCode?: string;
    paymentMethod?: string;
    payment_method?: string;
    transactionType?: string;
    transaction_type?: string;
    transactionStatus?: string;
    transaction_status?: string;
    notes?: string;
    documentHash?: string;
    document_hash?: string;
  };

  createdBy: {
    accountType?: string;
    account_type?: string;
    loginUsername?: string;
    login_username?: string;
    walletAddress?: string;
    wallet_address?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentTransactionsService {

  /**
   * Use relative URL if Angular is served through same Nginx reverse proxy.
   * If you are testing directly with ng serve, use full backend URL.
   */
  private readonly baseUrl = 'http://172.31.13.90:3001/api/v1/government-blockchain/transactions';

  constructor(private http: HttpClient) {}

  /**
   * Search residents from PostgreSQL.
   */
  searchResidents(filters: ResidentSearchFilters): Observable<any> {
    let params = new HttpParams();

    if (filters.residentId) {
      params = params.set('residentId', filters.residentId);
    }

    if (filters.walletAddress) {
      params = params.set('walletAddress', filters.walletAddress);
    }

    if (filters.fullName) {
      params = params.set('fullName', filters.fullName);
    }

    // if (filters.nationalId) {
    //   params = params.set('nationalId', filters.nationalId);
    // }

    if (filters.mobile) {
      params = params.set('mobile', filters.mobile);
    }

    return this.http.get(`${this.baseUrl}/residents/search`, { params });
  }

  /**
   * Read services from existing blockchain.government_services table.
   */
  getServices(filters: GovernmentServiceFilters = {}): Observable<any> {
    let params = new HttpParams();

    if (filters.ministryId !== undefined && filters.ministryId !== null && filters.ministryId !== '') {
      params = params.set('ministryId', String(filters.ministryId));
    }

    if (filters.administrationId !== undefined && filters.administrationId !== null && filters.administrationId !== '') {
      params = params.set('administrationId', String(filters.administrationId));
    }

    if (filters.categoryId !== undefined && filters.categoryId !== null && filters.categoryId !== '') {
      params = params.set('categoryId', String(filters.categoryId));
    }

    if (filters.serviceStatus) {
      params = params.set('serviceStatus', filters.serviceStatus);
    }

    if (filters.search) {
      params = params.set('search', filters.search);
    }

    return this.http.get(`${this.baseUrl}/services`, { params });
  }

  /**
   * Create transaction.
   * Backend will save in PostgreSQL and submit to Blockchain.
   */
  createTransaction(payload: GovernmentTransactionPayload): Observable<any> {
    return this.http.post(`${this.baseUrl}`, payload);
  }

  /**
   * List transactions.
   */
  getTransactions(filters: TransactionListFilters = {}): Observable<any> {
    let params = new HttpParams();

    if (filters.transactionReference) {
      params = params.set('transactionReference', filters.transactionReference);
    }

    if (filters.residentId) {
      params = params.set('residentId', filters.residentId);
    }

    if (filters.walletAddress) {
      params = params.set('walletAddress', filters.walletAddress);
    }

    if (filters.serviceCode) {
      params = params.set('serviceCode', filters.serviceCode);
    }

    if (filters.transactionStatus) {
      params = params.set('transactionStatus', filters.transactionStatus);
    }

    if (filters.blockchainStatus) {
      params = params.set('blockchainStatus', filters.blockchainStatus);
    }

    if (filters.fromDate) {
      params = params.set('fromDate', filters.fromDate);
    }

    if (filters.toDate) {
      params = params.set('toDate', filters.toDate);
    }

    return this.http.get(`${this.baseUrl}`, { params });
  }

  /**
   * Get transaction details by reference.
   */
  getTransactionByReference(transactionReference: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${transactionReference}`);
  }

  /**
   * Build payload from selected resident, selected service, transaction form, and logged-in user.
   */
  buildTransactionPayload(
    selectedResident: any,
    selectedService: any,
    transactionForm: any,
    loggedInUser: any
  ): GovernmentTransactionPayload {
    return {
      resident: {
        residentId: selectedResident?.resident_id,
        walletAddress: selectedResident?.wallet_address,
        fullName: selectedResident?.full_name,
        nationalId: selectedResident?.national_id,
        mobile: selectedResident?.mobile_number,
        email: selectedResident?.email
      },

      service: {
        serviceId: selectedService?.service_id,
        servicePublicId: selectedService?.service_public_id,
        serviceCode: selectedService?.service_code,
        serviceName: selectedService?.service_name,
        arabicName: selectedService?.arabic_name,
        ministryId: selectedService?.ministry_id,
        administrationId: selectedService?.administration_id,
        categoryId: selectedService?.category_id,
        fee_amount: selectedService?.fee_amount,
        currency_code: selectedService?.currency_code
      },

      transaction: {
        amount: transactionForm?.amount || selectedService?.fee_amount || 0,
        currencyCode: transactionForm?.currencyCode || selectedService?.currency_code || 'LBP',
        paymentMethod: transactionForm?.paymentMethod || 'WALLET',
        transactionType: transactionForm?.transactionType || 'GOVERNMENT_SERVICE',
        transactionStatus: transactionForm?.transactionStatus || 'PENDING',
        notes: transactionForm?.notes || null,
        documentHash: transactionForm?.documentHash || null
      },

      createdBy: {
        accountType: loggedInUser?.accountType || loggedInUser?.account_type,
        loginUsername: loggedInUser?.loginUsername || loggedInUser?.login_username || loggedInUser?.username,
        walletAddress: loggedInUser?.walletAddress || loggedInUser?.wallet_address
      }
    };
  }

  /**
   * Get logged-in resident from localStorage for auto-fill.
   */
  getLoggedInResidentFromStorage(): any | null {
    const accountType = localStorage.getItem('accountType');
    const residentRaw = localStorage.getItem('resident');

    if (!accountType || accountType.toUpperCase() !== 'RESIDENT') {
      return null;
    }

    if (!residentRaw) {
      return null;
    }

    try {
      return JSON.parse(residentRaw);
    } catch (error) {
      console.error('[RESIDENT STORAGE PARSE ERROR]', error);
      return null;
    }
  }

  /**
   * Check if logged-in user is resident.
   */
  isResidentLogin(): boolean {
    const accountType = localStorage.getItem('accountType');
    return !!accountType && accountType.toUpperCase() === 'RESIDENT';
  }

  /**
   * Get createdBy object from localStorage.
   */
  getCreatedByFromStorage(): any {
    return {
      accountType: localStorage.getItem('accountType'),
      loginUsername: localStorage.getItem('loginUsername'),
      walletAddress: localStorage.getItem('walletAddress')
    };
  }
}