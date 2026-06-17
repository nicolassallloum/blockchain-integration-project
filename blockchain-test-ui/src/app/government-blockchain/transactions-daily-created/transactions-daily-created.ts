import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface TransactionDailyRow {
  transaction_date: string;
  total_transactions_created: number;
  confirmed_transactions: number;
  failed_transactions: number;
  pending_transactions: number;
}

interface TransactionDailySummary {
  total_transactions_created: number;
  confirmed_transactions: number;
  failed_transactions: number;
  pending_transactions: number;
}

@Component({
  selector: 'app-transactions-daily-created',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './transactions-daily-created.html',
  styleUrls: ['./transactions-daily-created.css']
})
export class TransactionsDailyCreatedComponent implements OnInit {
  selectedMonth = new Date().toISOString().slice(0, 7);
  loading = false;
  errorMessage = '';

  summary: TransactionDailySummary = {
    total_transactions_created: 0,
    confirmed_transactions: 0,
    failed_transactions: 0,
    pending_transactions: 0
  };

  rows: TransactionDailyRow[] = [];

  private readonly apiUrl = '/api/v1/dev-transactions/daily-created';

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
          total_transactions_created: 0,
          confirmed_transactions: 0,
          failed_transactions: 0,
          pending_transactions: 0
        };

        this.rows = res?.data?.daily || [];
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to load transactions daily created report';
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
    const values = this.rows.map(row => Number(row.total_transactions_created || 0));
    return Math.max(...values, 1);
  }

  getBarWidth(value: number): string {
    const percent = Math.round((Number(value || 0) / this.getMaxTotal()) * 100);
    return `${percent}%`;
  }
}
