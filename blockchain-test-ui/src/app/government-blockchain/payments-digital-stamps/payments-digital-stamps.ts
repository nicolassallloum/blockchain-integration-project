import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface DropdownItem {
  id: number | string;
  name: string;
}

interface ServiceFees {
  id: number | string;
  name: string;
  fees: number | string;
}

interface PaymentStampRecord {
  id?: number;
  paymentRef: string;
  resident: string;
  service: string;
  stampId: string;
  amount: string;
  paymentStatus: 'Paid' | 'Failed' | 'Pending';
  stampStatus: 'Redeemed' | 'Issued' | 'Active' | 'Not Issued';
}

@Component({
  selector: 'app-payments-digital-stamps',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './payments-digital-stamps.html',
  styleUrl: './payments-digital-stamps.scss'
})
export class PaymentsDigitalStampsComponent implements OnInit {
  /**
   * Use relative API path so Angular proxy.conf.json handles backend calls.
   * This avoids CORS issues if Angular runs on 4200 or another fallback port.
   */
  private apiUrl = 'http://172.31.13.90:3001/api/v1/government-blockchain/payments-digital-stamps';

  loading = false;
  loadingDropdowns = false;
  loadingFees = false;
  saving = false;

  errorMessage = '';
  successMessage = '';
  issuedPaymentCode = '';

  showIssueStampModal = false;

  residents: DropdownItem[] = [];
  services: DropdownItem[] = [];

  newStamp = {
    residentId: '',
    serviceId: '',
    serviceName: '',
    fees: '',
    currencyCode: 'GOV',
    stampStatus: 'Issued'
  };

  summaryCards = [
    {
      title: 'Total Payments',
      value: '0',
      subtitle: 'Successful service payments'
    },
    {
      title: 'Total Amount',
      value: '0 GOV',
      subtitle: 'Collected fees'
    },
    {
      title: 'Digital Stamps',
      value: '0',
      subtitle: 'Issued / active stamps'
    },
    {
      title: 'Redeemed',
      value: '0',
      subtitle: 'Used stamps'
    }
  ];

  records: PaymentStampRecord[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadSummary();
    this.loadRecords();
    this.loadDropdowns();
  }

  loadSummary(): void {
    this.http.get<any>(`${this.apiUrl}/summary`).subscribe({
      next: (response) => {
        if (!response?.success) {
          return;
        }

        const data = response.data || {};
        const currencyCode = data.currencyCode || 'GOV';

        this.summaryCards = [
          {
            title: 'Total Payments',
            value: Number(data.totalPayments || 0).toLocaleString(),
            subtitle: 'Successful service payments'
          },
          {
            title: 'Total Amount',
            value: `${this.formatShortAmount(data.totalAmount || 0)} ${currencyCode}`,
            subtitle: 'Collected fees'
          },
          {
            title: 'Digital Stamps',
            value: Number(data.digitalStamps || 0).toLocaleString(),
            subtitle: 'Issued / active stamps'
          },
          {
            title: 'Redeemed',
            value: Number(data.redeemed || 0).toLocaleString(),
            subtitle: 'Used stamps'
          }
        ];
      },
      error: (error) => {
        console.error('Failed to load digital stamp summary', error);
      }
    });
  }

  loadRecords(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<any>(this.apiUrl).subscribe({
      next: (response) => {
        this.loading = false;

        if (!response?.success) {
          this.errorMessage = 'Failed to load payment and stamp records.';
          return;
        }

        this.records = (response.data || []).map((row: any) => ({
          id: row.id,
          paymentRef: row.payment_ref,
          resident: row.resident_name,
          service: row.service_name,
          stampId: row.stamp_id,
          amount: `${Number(row.amount || 0).toLocaleString()} ${row.currency_code || 'GOV'}`,
          paymentStatus: row.payment_status,
          stampStatus: row.stamp_status
        }));
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = 'Failed to load payment and stamp records from database.';
        console.error('Digital stamp records error:', error);
      }
    });
  }

  loadDropdowns(): void {
    this.loadingDropdowns = true;

    this.http.get<any>(`${this.apiUrl}/residents/dropdown`).subscribe({
      next: (response) => {
        this.residents = response?.success ? response.data || [] : [];
      },
      error: (error) => {
        this.errorMessage = 'Failed to load residents dropdown.';
        console.error('Residents dropdown error:', error);
      }
    });

    this.http.get<any>(`${this.apiUrl}/services/dropdown`).subscribe({
      next: (response) => {
        this.services = response?.success ? response.data || [] : [];
        this.loadingDropdowns = false;
      },
      error: (error) => {
        this.loadingDropdowns = false;
        this.errorMessage = 'Failed to load services dropdown.';
        console.error('Services dropdown error:', error);
      }
    });
  }

  issueDigitalStamp(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.issuedPaymentCode = '';

    this.newStamp = {
      residentId: '',
      serviceId: '',
      serviceName: '',
      fees: '',
      currencyCode: 'GOV',
      stampStatus: 'Issued'
    };

    if (this.residents.length === 0 || this.services.length === 0) {
      this.loadDropdowns();
    }

    this.showIssueStampModal = true;
  }

  closeIssueStampModal(): void {
    this.showIssueStampModal = false;
  }

  onServiceChange(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.issuedPaymentCode = '';

    this.newStamp.fees = '';
    this.newStamp.serviceName = '';

    if (!this.newStamp.serviceId) {
      return;
    }

    const selectedService = this.services.find(
      (service) => String(service.id) === String(this.newStamp.serviceId)
    );

    this.newStamp.serviceName = selectedService?.name || '';

    this.loadingFees = true;

    this.http.get<any>(`${this.apiUrl}/services/${this.newStamp.serviceId}/fees`).subscribe({
      next: (response) => {
        this.loadingFees = false;

        if (!response?.success) {
          this.errorMessage = response?.message || 'Failed to load service fees.';
          return;
        }

        const feesData: ServiceFees = response.data;
        this.newStamp.fees = String(feesData.fees || '');
        this.newStamp.serviceName = feesData.name || this.newStamp.serviceName;
      },
      error: (error) => {
        this.loadingFees = false;
        this.errorMessage = error?.error?.message || 'Failed to load service fees.';
        console.error('Service fees error:', error);
      }
    });
  }

  saveDigitalStamp(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.issuedPaymentCode = '';

    if (!this.newStamp.residentId || !this.newStamp.serviceId) {
      this.errorMessage = 'Please select resident and service.';
      return;
    }

    if (!this.newStamp.fees) {
      this.errorMessage = 'Fees are required. Please select a valid service.';
      return;
    }

    this.saving = true;

    const payload = {
      residentId: Number(this.newStamp.residentId),
      serviceId: Number(this.newStamp.serviceId),
      stampStatus: this.newStamp.stampStatus || 'Issued'
    };

    this.http.post<any>(`${this.apiUrl}/issue`, payload).subscribe({
      next: (response) => {
        this.saving = false;

        if (!response?.success) {
          this.errorMessage = response?.message || 'Failed to issue digital stamp.';
          return;
        }

        const paymentCode =
          response?.data?.payment_code ||
          response?.data?.payment_ref ||
          response?.data?.stamp_id ||
          '';

        this.issuedPaymentCode = paymentCode;
        this.showIssueStampModal = false;
        this.successMessage = paymentCode
          ? `Digital stamp issued successfully. Payment Code: ${paymentCode}`
          : 'Digital stamp issued successfully.';

        this.loadSummary();
        this.loadRecords();
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage = error?.error?.message || 'Failed to issue digital stamp.';
        console.error('Issue digital stamp error:', error);
      }
    });
  }

  formatShortAmount(value: number): string {
    const amount = Number(value || 0);

    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(1)}B`;
    }

    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }

    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }

    return amount.toLocaleString();
  }

  getPaymentStatusClass(status: string): string {
    return String(status || '').toLowerCase();
  }

  getStampStatusClass(status: string): string {
    return String(status || '').toLowerCase().replace(' ', '-');
  }

  trackById(index: number, item: DropdownItem): number | string {
    return item.id || index;
  }

  trackByPaymentRef(index: number, item: PaymentStampRecord): string | number {
    return item.paymentRef || item.id || index;
  }
}
