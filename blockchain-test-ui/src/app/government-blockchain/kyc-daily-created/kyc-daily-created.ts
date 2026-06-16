import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface KycDailyRow {
  kyc_date: string;
  total_kyc_created: number;
  confirmed_kyc: number;
  failed_kyc: number;
  pending_kyc: number;
}

interface KycDailySummary {
  total_kyc_created: number;
  confirmed_kyc: number;
  failed_kyc: number;
  pending_kyc: number;
}

@Component({
  selector: 'app-kyc-daily-created',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './kyc-daily-created.html',
  styleUrls: ['./kyc-daily-created.css']
})
export class KycDailyCreatedComponent implements OnInit {
  selectedMonth = new Date().toISOString().slice(0, 7);
  loading = false;
  errorMessage = '';

  summary: KycDailySummary = {
    total_kyc_created: 0,
    confirmed_kyc: 0,
    failed_kyc: 0,
    pending_kyc: 0
  };

  rows: KycDailyRow[] = [];

  private readonly apiUrl = '/api/v1/valoores-blockchain/kyc-daily-created';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<any>(`${this.apiUrl}?month=${this.selectedMonth}`).subscribe({
      next: (res) => {
        this.summary = res?.data?.summary || {
          total_kyc_created: 0,
          confirmed_kyc: 0,
          failed_kyc: 0,
          pending_kyc: 0
        };

        this.rows = res?.data?.daily || [];
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to load KYC daily created report';
        this.loading = false;
      }
    });
  }

  formatDate(value: string): string {
    if (!value) {
      return '';
    }

    return String(value).slice(0, 10);
  }

  getMaxTotal(): number {
    const values = this.rows.map(row => Number(row.total_kyc_created || 0));
    return Math.max(...values, 1);
  }

  getBarWidth(value: number): string {
    const percent = Math.round((Number(value || 0) / this.getMaxTotal()) * 100);
    return `${percent}%`;
  }
}
