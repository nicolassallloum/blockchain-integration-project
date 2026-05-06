import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DashboardApiService,
  WalletDashboardResponse,
  WalletDashboardRow
} from '../../core/services/dashboard-api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-toolbar">
      <div class="page-search">
        <span>🔎</span>
        <input
          type="text"
          placeholder="Search Here ..."
          [(ngModel)]="search"
          (keyup.enter)="loadWallets(1)"
        />
      </div>

      <div class="toolbar-buttons">
        <button class="icon-btn" title="Refresh" (click)="loadWallets(page)">↻</button>
        <button class="icon-btn" title="Edit">✎</button>
        <button class="icon-btn" title="Delete">🗑</button>
      </div>
    </div>

    @if (loading) {
      <div class="status-card">Loading wallets from PostgreSQL...</div>
    }

    @if (errorMessage) {
      <div class="error-card">
        <strong>API Error</strong>
        <pre>{{ errorMessage }}</pre>
      </div>
    }

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th class="checkbox-col"></th>
            <th>Customer Name</th>
            <th>Customer Type</th>
            <th>Nationality</th>
            <th>ID Type</th>
            <th>ID Number</th>
          </tr>
        </thead>

        <tbody>
          @if (!loading && rows.length === 0) {
            <tr>
              <td colspan="6" class="empty-row">No wallet records found.</td>
            </tr>
          }

          @for (row of rows; track row.walletId) {
            <tr>
              <td class="checkbox-col">
                <input type="checkbox" />
              </td>
              <td>{{ row.customerName || '-' }}</td>
              <td>{{ row.customerType || '-' }}</td>
              <td>{{ row.nationality || '-' }}</td>
              <td>{{ row.idType || '-' }}</td>
              <td>{{ row.idNumber || '-' }}</td>
            </tr>
          }
        </tbody>
      </table>

      <div class="columns-tab">▤ Columns</div>

      <div class="table-footer">
        <div>
          {{ startRecord }} to {{ endRecord }} of {{ totalRecords }}
        </div>

        <div class="pagination">
          <button (click)="loadWallets(1)" [disabled]="page === 1">⏮</button>
          <button (click)="loadWallets(page - 1)" [disabled]="page === 1">◀</button>

          <span>Page {{ page }} of {{ totalPages }}</span>

          <button (click)="loadWallets(page + 1)" [disabled]="page >= totalPages">▶</button>
          <button (click)="loadWallets(totalPages)" [disabled]="page >= totalPages">⏭</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .page-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding: 10px 6px 2px;
    }

    .page-search {
      width: 340px;
      background: #ffffff;
      border: 1px solid #d5dbe3;
      border-radius: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .page-search input {
      border: 0;
      outline: none;
      width: 100%;
      font-size: 15px;
      background: transparent;
    }

    .toolbar-buttons {
      display: flex;
      gap: 16px;
    }

    .icon-btn {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      border: 1px solid #d6dce5;
      background: #ffffff;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      font-size: 18px;
    }

    .icon-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .status-card,
    .error-card {
      max-width: 1160px;
      margin: 0 auto 14px;
      background: #ffffff;
      border-radius: 12px;
      padding: 14px 18px;
      border: 1px solid #d7dde6;
    }

    .error-card {
      background: #fff1f2;
      border-color: #fecdd3;
      color: #991b1b;
    }

    .error-card pre {
      white-space: pre-wrap;
      margin: 8px 0 0;
      font-size: 13px;
    }

    .table-card {
      position: relative;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #d7dde6;
      box-shadow: 0 3px 12px rgba(0,0,0,0.08);
      padding: 8px 22px 0;
      max-width: 1160px;
      margin: 0 auto;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead th {
      text-align: left;
      padding: 16px 12px;
      color: #005bbb;
      font-size: 15px;
      border-bottom: 2px solid #cdd9e6;
    }

    tbody td {
      padding: 14px 12px;
      border-bottom: 1px solid #dce2e8;
      color: #263445;
      font-size: 15px;
    }

    .checkbox-col {
      width: 42px;
    }

    .empty-row {
      text-align: center;
      color: #64748b;
      padding: 30px;
    }

    .columns-tab {
      position: absolute;
      top: 62px;
      right: 0;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      padding: 12px 8px;
      font-size: 13px;
      color: #2f4e7a;
      border-left: 1px solid #d7dde6;
      background: #f9fbfd;
      height: 180px;
    }

    .table-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 0;
      font-weight: 600;
      color: #5b6570;
    }

    .pagination {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pagination button {
      border: 1px solid #d6dde6;
      background: #fff;
      border-radius: 5px;
      padding: 3px 7px;
      cursor: pointer;
    }

    .pagination button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    @media (max-width: 900px) {
      .page-toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
      }

      .page-search {
        width: 100%;
      }

      .table-card {
        overflow-x: auto;
      }

      .table-footer {
        flex-direction: column;
        gap: 10px;
      }

      .columns-tab {
        display: none;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private dashboardApi = inject(DashboardApiService);

  rows: WalletDashboardRow[] = [];

  page = 1;
  limit = 13;
  totalRecords = 0;
  totalPages = 1;
  search = '';

  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadWallets(1);
  }

  get startRecord(): number {
    if (this.totalRecords === 0) {
      return 0;
    }

    return (this.page - 1) * this.limit + 1;
  }

  get endRecord(): number {
    return Math.min(this.page * this.limit, this.totalRecords);
  }

  loadWallets(pageNumber: number): void {
    if (pageNumber < 1) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.dashboardApi.getWallets(pageNumber, this.limit, this.search).subscribe({
      next: (response: WalletDashboardResponse) => {
        this.rows = response?.data || [];

        this.page = response?.pagination?.page || pageNumber;
        this.limit = response?.pagination?.limit || this.limit;
        this.totalRecords = response?.pagination?.totalRecords || this.rows.length;
        this.totalPages =
          response?.pagination?.totalPages ||
          Math.max(1, Math.ceil(this.totalRecords / this.limit));

        this.loading = false;
      },
      error: (error: any) => {
        this.rows = [];
        this.loading = false;
        this.errorMessage = JSON.stringify(error?.error || error?.message || error, null, 2);
      }
    });
  }
}
