import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FabricApiService } from '../../core/services/fabric-api.service';

@Component({
  selector: 'app-fabric-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Fabric Test</h1>
          <p>Test direct Hyperledger Fabric evaluate and submit calls.</p>
        </div>
      </div>

      <div class="card">
        <h2>Fabric Function Test</h2>

        <div class="grid">
          <div class="form-group">
            <label>Mode</label>
            <select [(ngModel)]="mode">
              <option value="evaluate">Evaluate</option>
              <option value="submit">Submit</option>
            </select>
          </div>

          <div class="form-group">
            <label>Function Name</label>
            <input [(ngModel)]="functionName" placeholder="GetWalletByCustomerId" />
          </div>

          <div class="form-group full">
            <label>Arguments JSON Array</label>
            <textarea [(ngModel)]="argsText" rows="5" placeholder='["19"]'></textarea>
          </div>
        </div>

        <div class="actions">
          <button class="primary-btn" type="button" (click)="runTest()" [disabled]="loading">
            {{ loading ? 'Running...' : 'Run Fabric Test' }}
          </button>

          <button class="secondary-btn" type="button" (click)="fillSample()" [disabled]="loading">
            Fill Sample
          </button>
        </div>

        <div class="message error" *ngIf="errorMessage">
          {{ errorMessage }}
        </div>

        <div class="message success" *ngIf="successMessage">
          {{ successMessage }}
        </div>
      </div>

      <div class="card response-card">
        <h2>Raw API Response</h2>
        <pre *ngIf="apiResponse">{{ apiResponse | json }}</pre>
        <div class="empty" *ngIf="!apiResponse">Response will appear here.</div>
      </div>
    </div>
  `,
  styles: [`
    .page {
      min-height: 100vh;
      padding: 32px;
      background: #eef3f8;
    }

    .page-header {
      margin-bottom: 24px;
    }

    h1 {
      margin: 0;
      color: #004aad;
      font-size: 30px;
      font-weight: 800;
    }

    p {
      color: #52647d;
      margin: 6px 0 0;
    }

    .card {
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e1e8f0;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
      padding: 22px;
      margin-bottom: 20px;
    }

    h2 {
      margin: 0 0 16px;
      color: #004aad;
      font-size: 22px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .full {
      grid-column: span 2;
    }

    label {
      display: block;
      color: #004aad;
      font-weight: 800;
      margin-bottom: 8px;
    }

    input,
    select,
    textarea {
      width: 100%;
      border: 1px solid #cbd8e6;
      border-radius: 12px;
      padding: 12px;
      font-size: 14px;
      outline: none;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 18px;
    }

    .primary-btn,
    .secondary-btn {
      border: none;
      border-radius: 12px;
      padding: 12px 18px;
      font-weight: 800;
      cursor: pointer;
    }

    .primary-btn {
      background: #004aad;
      color: #ffffff;
    }

    .secondary-btn {
      background: #eef5ff;
      color: #004aad;
    }

    .message {
      padding: 14px 18px;
      border-radius: 14px;
      margin-top: 16px;
      font-weight: 700;
    }

    .success {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }

    .error {
      background: #fff1f1;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    pre {
      background: #071124;
      color: #e5e7eb;
      border-radius: 14px;
      padding: 18px;
      overflow: auto;
      max-height: 500px;
      font-size: 12px;
    }

    .empty {
      background: #f8fafc;
      border-radius: 14px;
      padding: 24px;
      text-align: center;
      color: #52647d;
    }

    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }

      .full {
        grid-column: span 1;
      }
    }
  `]
})
export class FabricTestComponent {
  mode: 'evaluate' | 'submit' = 'evaluate';
  functionName = 'GetWalletByCustomerId';
  argsText = '["19"]';

  loading = false;
  successMessage = '';
  errorMessage = '';
  apiResponse: any = null;

  constructor(private fabricApiService: FabricApiService) {}

  fillSample(): void {
    this.mode = 'evaluate';
    this.functionName = 'GetWalletByCustomerId';
    this.argsText = '["19"]';
  }

  runTest(): void {
    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.apiResponse = null;

    let args: string[] = [];

    try {
      const parsedArgs = JSON.parse(this.argsText);
      args = Array.isArray(parsedArgs) ? parsedArgs.map(String) : [];
    } catch {
      this.loading = false;
      this.errorMessage = 'Arguments must be a valid JSON array. Example: ["19"]';
      return;
    }

    const payload = {
      functionName: this.functionName,
      args
    };

    const request$ =
      this.mode === 'submit'
        ? this.fabricApiService.submit(payload)
        : this.fabricApiService.evaluate(payload);

    request$.subscribe({
      next: (response: any) => {
        this.loading = false;
        this.apiResponse = response;
        this.successMessage = 'Fabric test completed successfully.';
      },
      error: (error: any) => {
        this.loading = false;
        this.apiResponse = error?.error || error;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Fabric test failed.';
      }
    });
  }
}
