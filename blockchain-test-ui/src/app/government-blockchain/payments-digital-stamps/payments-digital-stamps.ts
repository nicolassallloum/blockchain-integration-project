import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface PaymentStampRecord {
  id?: number;
  paymentRef: string;
  resident: string;
  service: string;
  stampId: string;
  amount: string;
  paymentStatus: 'Paid' | 'Failed' | 'Pending';
  stampStatus: 'Redeemed' | 'Issued' | 'Not Issued';
}

@Component({
  selector: 'app-payments-digital-stamps',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './payments-digital-stamps.html',
  styleUrl: './payments-digital-stamps.scss'
})
export class PaymentsDigitalStampsComponent implements OnInit {
  private apiUrl = 'http://172.31.13.90:3001/api/v1/government-blockchain/payments-digital-stamps';

  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  showIssueStampModal = false;

  newStamp = {
    resident: '',
    service: '',
    amount: ''
  };

  summaryCards = [
    {
      title: 'Total Payments',
      value: '0',
      subtitle: 'Successful service payments'
    },
    {
      title: 'Total Amount',
      value: '0 LBP',
      subtitle: 'Collected fees'
    },
    {
      title: 'Digital Stamps',
      value: '0',
      subtitle: 'Issued stamps'
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
  }

  loadSummary(): void {
    this.http.get<any>(`${this.apiUrl}/summary`).subscribe({
      next: (response) => {
        if (!response?.success) {
          return;
        }

        const data = response.data;

        this.summaryCards = [
          {
            title: 'Total Payments',
            value: Number(data.totalPayments || 0).toLocaleString(),
            subtitle: 'Successful service payments'
          },
          {
            title: 'Total Amount',
            value: `${this.formatShortAmount(data.totalAmount || 0)} LBP`,
            subtitle: 'Collected fees'
          },
          {
            title: 'Digital Stamps',
            value: Number(data.digitalStamps || 0).toLocaleString(),
            subtitle: 'Issued stamps'
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

        this.records = response.data.map((row: any) => ({
          id: row.id,
          paymentRef: row.payment_ref,
          resident: row.resident_name,
          service: row.service_name,
          stampId: row.stamp_id,
          amount: `${Number(row.amount || 0).toLocaleString()} ${row.currency_code || 'LBP'}`,
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

  issueDigitalStamp(): void {
    this.successMessage = '';
    this.errorMessage = '';

    this.newStamp = {
      resident: '',
      service: '',
      amount: ''
    };

    this.showIssueStampModal = true;
  }

  closeIssueStampModal(): void {
    this.showIssueStampModal = false;
  }

  saveDigitalStamp(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.newStamp.resident || !this.newStamp.service || !this.newStamp.amount) {
      this.errorMessage = 'Please fill resident, service, and amount.';
      return;
    }

    this.saving = true;

    const payload = {
      residentName: this.newStamp.resident,
      serviceName: this.newStamp.service,
      amount: Number(this.newStamp.amount),
      currencyCode: 'LBP'
    };

    this.http.post<any>(this.apiUrl, payload).subscribe({
      next: (response) => {
        this.saving = false;

        if (!response?.success) {
          this.errorMessage = response?.message || 'Failed to issue digital stamp.';
          return;
        }

        this.showIssueStampModal = false;
        this.successMessage = 'Digital stamp issued successfully.';

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
    return status.toLowerCase();
  }

  getStampStatusClass(status: string): string {
    return status.toLowerCase().replace(' ', '-');
  }
}