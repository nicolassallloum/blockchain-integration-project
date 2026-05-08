import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { WalletApiService } from '../../core/services/wallet-api.service';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div>
          <h1>Digital KYC Dashboard</h1>
          <p>Professional overview of created blockchain wallet identities.</p>
        </div>

        <button class="secondary-btn" type="button" (click)="refresh()" [disabled]="loading">
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <span>Total Wallets</span>
          <strong>{{ totalWallets }}</strong>
          <p>Registered blockchain identities</p>
        </div>

        <div class="stat-card">
          <span>Active Wallets</span>
          <strong>{{ activeWallets }}</strong>
          <p>Status = ACTIVE</p>
        </div>

        <div class="stat-card">
          <span>Current Page</span>
          <strong>{{ pagination.page }}</strong>
          <p>Limit {{ pagination.limit }} records</p>
        </div>

        <div class="stat-card">
          <span>Data Source</span>
          <strong class="source">{{ dataSource }}</strong>
          <p>{{ tableName }}</p>
        </div>
      </div>

      <div class="search-card">
        <h2>Search Wallets</h2>

        <div class="search-row">
          <input
            type="text"
            [(ngModel)]="filters.search"
            name="search"
            placeholder="Search customer, wallet, organization, national ID..."
            (keyup.enter)="searchWallets()"
          />

          <button class="primary-btn" type="button" (click)="searchWallets()" [disabled]="loading">
            Search
          </button>

          <button class="light-btn" type="button" (click)="clearSearch()" [disabled]="loading">
            Clear
          </button>
        </div>
      </div>

      <div class="error-box" *ngIf="errorMessage">
        {{ errorMessage }}
      </div>

      <div class="success-box" *ngIf="successMessage">
        {{ successMessage }}
      </div>

      <div class="wallets-card">
        <div class="section-header">
          <div>
            <h2>Wallet Records</h2>
            <p>Latest wallet identities loaded from the backend API.</p>
          </div>

          <div class="api-url">
            API:
            <span>{{ apiBaseUrl }}/wallets</span>
          </div>
        </div>

        <div class="loading" *ngIf="loading">
          Loading wallet data...
        </div>

        <div class="empty-state" *ngIf="!loading && wallets.length === 0">
          <h3>No wallets found</h3>
          <p>No wallet records were returned from the backend for the selected filters.</p>
        </div>

        <div class="table-wrapper" *ngIf="!loading && wallets.length > 0">
          <table>
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Wallet Address</th>
                <th>Full Name</th>
                <th>Organization</th>
                <th>Balance</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>

            <tbody>
              <tr *ngFor="let wallet of wallets">
                <td>{{ getField(wallet, 'customerId', 'customer_id') }}</td>
                <td class="mono">{{ getField(wallet, 'walletAddress', 'wallet_address') }}</td>
                <td>{{ getField(wallet, 'fullName', 'full_name', 'customerName', 'customer_name') }}</td>
                <td>
                  {{
                    getField(
                      wallet,
                      'organizationName',
                      'organization_name',
                      'organizationCode',
                      'organization_code',
                      'organizationId',
                      'organization_id'
                    )
                  }}
                </td>
                <td>{{ getField(wallet, 'currentBalance', 'current_balance') }}</td>
                <td>{{ getField(wallet, 'currencyCode', 'currency_code', 'currency') }}</td>
                <td>
                  <span
                    class="status-pill"
                    [class.active]="String(getField(wallet, 'status', 'wallet_status')).toUpperCase() === 'ACTIVE'"
                  >
                    {{ getField(wallet, 'status', 'wallet_status') }}
                  </span>
                </td>
                <td>{{ getField(wallet, 'createdAt', 'created_at') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination" *ngIf="!loading">
          <button
            class="light-btn"
            type="button"
            (click)="previousPage()"
            [disabled]="!pagination.hasPreviousPage"
          >
            Previous
          </button>

          <span>
            Page {{ pagination.page }} of {{ pagination.totalPages || 1 }}
          </span>

          <button
            class="light-btn"
            type="button"
            (click)="nextPage()"
            [disabled]="!pagination.hasNextPage"
          >
            Next
          </button>
        </div>
      </div>

      <div class="raw-card" *ngIf="apiResponse">
        <h2>Raw API Response</h2>
        <pre>{{ apiResponse | json }}</pre>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard-page {
        min-height: 100vh;
        padding: 32px;
        background: #eef3f8;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
      }

      .page-header h1 {
        margin: 0;
        color: #004aad;
        font-size: 30px;
        font-weight: 800;
      }

      .page-header p {
        margin: 6px 0 0;
        color: #52647d;
        font-size: 15px;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 18px;
        margin-bottom: 24px;
      }

      .stat-card,
      .search-card,
      .wallets-card,
      .raw-card {
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #e1e8f0;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
      }

      .stat-card {
        padding: 20px;
      }

      .stat-card span {
        display: block;
        color: #52647d;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 10px;
      }

      .stat-card strong {
        display: block;
        color: #004aad;
        font-size: 28px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .stat-card strong.source {
        font-size: 26px;
      }

      .stat-card p {
        margin: 0;
        color: #52647d;
        font-size: 13px;
      }

      .search-card {
        padding: 20px;
        margin-bottom: 20px;
      }

      .search-card h2,
      .wallets-card h2,
      .raw-card h2 {
        margin: 0 0 12px;
        color: #004aad;
        font-size: 20px;
        font-weight: 800;
      }

      .search-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 12px;
      }

      input {
        width: 100%;
        height: 44px;
        border: 1px solid #cbd8e6;
        border-radius: 12px;
        padding: 0 14px;
        outline: none;
        font-size: 14px;
      }

      input:focus {
        border-color: #004aad;
        box-shadow: 0 0 0 3px rgba(0, 74, 173, 0.12);
      }

      .primary-btn,
      .secondary-btn,
      .light-btn {
        border: none;
        border-radius: 12px;
        padding: 12px 18px;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .primary-btn {
        background: #004aad;
        color: #ffffff;
        box-shadow: 0 8px 18px rgba(0, 74, 173, 0.25);
      }

      .secondary-btn {
        background: #eef5ff;
        color: #004aad;
      }

      .light-btn {
        background: #f2f4f7;
        color: #111827;
      }

      .primary-btn:disabled,
      .secondary-btn:disabled,
      .light-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .error-box {
        background: #fff1f1;
        color: #b91c1c;
        border: 1px solid #fecaca;
        border-radius: 14px;
        padding: 14px 18px;
        margin-bottom: 20px;
        font-weight: 700;
      }

      .success-box {
        background: #ecfdf5;
        color: #047857;
        border: 1px solid #a7f3d0;
        border-radius: 14px;
        padding: 14px 18px;
        margin-bottom: 20px;
        font-weight: 700;
      }

      .wallets-card {
        padding: 20px;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-start;
        margin-bottom: 16px;
      }

      .section-header p {
        margin: 0;
        color: #52647d;
      }

      .api-url {
        color: #52647d;
        font-size: 13px;
        text-align: right;
      }

      .api-url span {
        display: block;
        color: #004aad;
        font-weight: 700;
        margin-top: 4px;
      }

      .loading,
      .empty-state {
        padding: 32px;
        text-align: center;
        border-radius: 14px;
        background: #f8fafc;
        color: #52647d;
      }

      .empty-state h3 {
        margin: 0 0 8px;
        color: #004aad;
      }

      .empty-state p {
        margin: 0;
      }

      .table-wrapper {
        overflow-x: auto;
      }

      table {
        width: 100%;
        min-width: 1100px;
        border-collapse: collapse;
      }

      th {
        background: #f8fafc;
        color: #334155;
        text-align: left;
        padding: 12px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 13px;
      }

      td {
        padding: 12px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 13px;
        color: #0f172a;
        vertical-align: top;
      }

      .mono {
        font-family: Consolas, Monaco, monospace;
        font-size: 12px;
      }

      .status-pill {
        display: inline-block;
        padding: 5px 10px;
        border-radius: 999px;
        background: #e5e7eb;
        color: #374151;
        font-weight: 800;
        font-size: 12px;
      }

      .status-pill.active {
        background: #dcfce7;
        color: #047857;
      }

      .pagination {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 14px;
        margin-top: 18px;
      }

      .pagination span {
        color: #52647d;
        font-weight: 700;
      }

      .raw-card {
        padding: 20px;
        margin-top: 20px;
      }

      pre {
        background: #071124;
        color: #e5e7eb;
        border-radius: 14px;
        padding: 18px;
        overflow: auto;
        max-height: 420px;
        font-size: 12px;
      }

      @media (max-width: 1100px) {
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .search-row {
          grid-template-columns: 1fr;
        }

        .section-header {
          flex-direction: column;
        }

        .api-url {
          text-align: left;
        }
      }

      @media (max-width: 700px) {
        .dashboard-page {
          padding: 18px;
        }

        .stats-grid {
          grid-template-columns: 1fr;
        }

        .page-header {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `
  ]
})
export class DashboardComponent implements OnInit {
  protected readonly String = String;

  apiBaseUrl = environment.apiBaseUrl;

  loading = false;
  errorMessage = '';
  successMessage = '';

  wallets: any[] = [];
  apiResponse: any = null;

  totalWallets = 0;
  activeWallets = 0;
  dataSource = 'PostgreSQL';
  tableName = 'blockchain.wallets';

  filters = {
    search: '',
    page: 1,
    limit: 100
  };

  pagination = {
    page: 1,
    limit: 100,
    totalRecords: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false
  };

  constructor(
    private walletApiService: WalletApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.walletApiService.getWallets(this.filters).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.apiResponse = response;

        this.wallets = this.extractWallets(response);
        this.pagination = this.extractPagination(response);

        this.totalWallets =
          response?.pagination?.totalRecords ??
          response?.pagination?.total ??
          response?.totalRecords ??
          this.wallets.length;

        this.activeWallets = this.wallets.filter((wallet: any) => {
          const status = this.getField(wallet, 'status', 'wallet_status');
          return String(status).toUpperCase() === 'ACTIVE';
        }).length;

        this.dataSource = response?.source || 'PostgreSQL';
        this.tableName = response?.table || 'blockchain.wallets';

        this.successMessage = 'Dashboard data loaded successfully.';
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.loading = false;
        this.apiResponse = error?.error || error;

        this.wallets = [];
        this.totalWallets = 0;
        this.activeWallets = 0;

        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          `Http failure while loading ${this.apiBaseUrl}/wallets`;
      }
    });
  }

  refresh(): void {
    this.loadDashboard();
  }

  searchWallets(): void {
    this.filters.page = 1;
    this.loadDashboard();
  }

  clearSearch(): void {
    this.filters.search = '';
    this.filters.page = 1;
    this.loadDashboard();
  }

  nextPage(): void {
    if (!this.pagination.hasNextPage) {
      return;
    }

    this.filters.page = Number(this.filters.page) + 1;
    this.loadDashboard();
  }

  previousPage(): void {
    if (!this.pagination.hasPreviousPage || Number(this.filters.page) <= 1) {
      return;
    }

    this.filters.page = Number(this.filters.page) - 1;
    this.loadDashboard();
  }

  getField(row: any, ...keys: string[]): any {
    for (const key of keys) {
      if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') {
        return row[key];
      }
    }

    return '-';
  }

  private extractWallets(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.data)) {
      return response.data;
    }

    if (Array.isArray(response?.data?.wallets)) {
      return response.data.wallets;
    }

    if (Array.isArray(response?.wallets)) {
      return response.wallets;
    }

    return [];
  }

  private extractPagination(response: any): any {
    const pagination = response?.pagination || {};

    const page = Number(pagination.page || this.filters.page || 1);
    const limit = Number(pagination.limit || this.filters.limit || 100);
    const totalRecords = Number(
      pagination.totalRecords ??
        pagination.total ??
        response?.totalRecords ??
        this.wallets.length ??
        0
    );

    const totalPages = Number(
      pagination.totalPages || Math.ceil(totalRecords / limit) || 0
    );

    return {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage:
        pagination.hasNextPage !== undefined
          ? pagination.hasNextPage
          : page < totalPages,
      hasPreviousPage:
        pagination.hasPreviousPage !== undefined
          ? pagination.hasPreviousPage
          : page > 1
    };
  }
}