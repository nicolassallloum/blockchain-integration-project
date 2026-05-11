import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { timeout } from 'rxjs/operators';

@Component({
  selector: 'app-data-generation-engine',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './data-generation-engine.html',
  styleUrl: './data-generation-engine.scss'
})
export class DataGenerationEngine {
  isRunning = false;
  errorMessage = '';
  successMessage = '';

  result: any = null;
  outputLines: string[] = [];

  form = {
    wallets: 1000,
    transactions: 20000,
    batchSize: 1000,
    logEvery: 5000,
    minBalance: 1000,
    maxBalance: 10000,
    minAmount: 1,
    maxAmount: 250,
    feePercent: 0.005
  };

private readonly apiBaseUrl = '/api/v1';
  constructor(private http: HttpClient) {}

  runEngine(): void {
    this.isRunning = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.result = null;
    this.outputLines = [];

    const correlationId = `DATA_GEN_UI_${Date.now()}`;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
      'x-request-id': correlationId,
      'x-source-system': 'BLOCKCHAIN_TEST_UI',
      'x-request-source': 'DATA_GENERATION_ENGINE_SCREEN'
    });

    this.http
      .post<any>(`${this.apiBaseUrl}/data-generator/run`, this.form, { headers })
      .pipe(timeout(600000))
      .subscribe({
        next: (response) => {
          this.result = response;
          this.successMessage = response?.message || 'Data generation completed successfully.';
          this.outputLines = String(response?.output || '')
            .split('\n')
            .filter((line) => line.trim().length > 0);

          this.isRunning = false;
        },
        error: (error) => {
          this.result = error?.error || null;
          this.errorMessage =
            error?.error?.message ||
            error?.message ||
            'Data generation failed. Check backend logs.';

          this.outputLines = String(error?.error?.output || error?.error?.errorOutput || '')
            .split('\n')
            .filter((line) => line.trim().length > 0);

          this.isRunning = false;
        }
      });
  }

  setSmallTest(): void {
    this.form = {
      wallets: 10,
      transactions: 20,
      batchSize: 500,
      logEvery: 10,
      minBalance: 1000,
      maxBalance: 10000,
      minAmount: 1,
      maxAmount: 250,
      feePercent: 0.005
    };
  }

  setPerformanceTest(): void {
    this.form = {
      wallets: 1000,
      transactions: 20000,
      batchSize: 1000,
      logEvery: 5000,
      minBalance: 1000,
      maxBalance: 10000,
      minAmount: 1,
      maxAmount: 250,
      feePercent: 0.005
    };
  }

  setLargeTest(): void {
    this.form = {
      wallets: 10000,
      transactions: 100000,
      batchSize: 1000,
      logEvery: 10000,
      minBalance: 1000,
      maxBalance: 20000,
      minAmount: 1,
      maxAmount: 150,
      feePercent: 0.005
    };
  }

  get throughputSummary(): string {
    if (!this.result) {
      return '-';
    }

    const durationSeconds = Number(this.result.durationSeconds || 0);
    const totalRows =
      Number(this.form.wallets || 0) + Number(this.form.transactions || 0);

    if (!durationSeconds) {
      return '-';
    }

    return `${(totalRows / durationSeconds).toFixed(2)} requested rows/sec`;
  }
}
