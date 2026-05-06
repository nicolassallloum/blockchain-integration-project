import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface DashboardWallet {
  walletId?: string;
  walletAddress?: string;
  customerId?: string;
  customerName?: string;
  fullName?: string;
  customerType?: string;
  walletType?: string;
  nationality?: string;
  nationalIdHash?: string;
  idType?: string;
  ledgerDocType?: string;
  idNumber?: string;
  ledgerKey?: string;
  organizationId?: string;
  organizationCode?: string;
  mobileHash?: string;
  emailHash?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-page">
      <div class="dashboard-header">
        <div>
          <h1>Digital KYC Dashboard</h1>
          <p>Professional overview of created blockchain wallet identities.</p>
        </div>

        <div class="header-actions">
          <button class="secondary-btn" type="button" (click)="refreshDashboard()">
            Refresh
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <span>Total Wallets</span>
          <strong>{{ totalRecords }}</strong>
          <small>Registered blockchain identities</small>
        </div>

        <div class="kpi-card">
          <span>Active Wallets</span>
          <strong>{{ activeWallets }}</strong>
          <small>Status = ACTIVE</small>
        </div>

        <div class="kpi-card">
          <span>Current Page</span>
          <strong>{{ page }}</strong>
          <small>Limit {{ limit }} records</small>
        </div>

        <div class="kpi-card">
          <span>Data Source</span>
          <strong>PostgreSQL</strong>
          <small>blockchain.wallets</small>
        </div>
      </div>

      <div class="toolbar-card">
        <div class="search-box">
          <label>Search Wallets</label>
          <input
            type="text"
            [(ngModel)]="searchText"
            placeholder="Search customer, wallet, organization, national ID..."
            (keyup.enter)="searchWallets()"
          />
        </div>

        <div class="toolbar-actions">
          <button class="primary-btn" type="button" (click)="searchWallets()">
            Search
          </button>

          <button class="reset-btn" type="button" (click)="clearSearch()">
            Clear
          </button>
        </div>
      </div>

      <div *ngIf="loading" class="loading-card">
        Loading dashboard wallets...
      </div>

      <div *ngIf="errorMessage" class="alert error">
        {{ errorMessage }}
      </div>

      <div *ngIf="!loading && !errorMessage" class="table-card">
        <div class="table-header">
          <div>
            <h2>Wallet Identities</h2>
            <p>Showing {{ wallets.length }} of {{ totalRecords }} wallet records.</p>
          </div>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Customer Name</th>
                <th>Customer Type</th>
                <th>Nationality / ID Hash</th>
                <th>ID Type</th>
                <th>ID Number</th>
                <th>Wallet Address</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>

            <tbody>
              <tr *ngFor="let wallet of wallets">
                <td>
                  <strong>{{ wallet.customerId || '-' }}</strong>
                </td>

                <td>
                  {{ wallet.customerName || wallet.fullName || '-' }}
                </td>

                <td>
                  {{ wallet.customerType || wallet.walletType || 'CUSTOMER' }}
                </td>

                <td>
                  {{ wallet.nationality || wallet.nationalIdHash || '-' }}
                </td>

                <td>
                  {{ wallet.idType || wallet.ledgerDocType || 'wallet' }}
                </td>

                <td>
                  {{ wallet.idNumber || wallet.ledgerKey || '-' }}
                </td>

                <td class="wallet-address">
                  {{ wallet.walletAddress || '-' }}
                </td>

                <td>
                  <span
                    class="status-pill"
                    [class.active]="wallet.status === 'ACTIVE'"
                    [class.inactive]="wallet.status !== 'ACTIVE'"
                  >
                    {{ wallet.status || '-' }}
                  </span>
                </td>

                <td>
                  {{ wallet.createdAt || '-' }}
                </td>
              </tr>

              <tr *ngIf="wallets.length === 0">
                <td colspan="9" class="empty-cell">
                  No wallet records found.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-row">
          <span>
            Page {{ page }} of {{ totalPages }}
          </span>

          <div class="pagination-actions">
            <button
              type="button"
              class="secondary-btn"
              [disabled]="page <= 1"
              (click)="previousPage()"
            >
              Previous
            </button>

            <button
              type="button"
              class="secondary-btn"
              [disabled]="page >= totalPages"
              (click)="nextPage()"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      padding: 28px;
      color: #10233f;
      box-sizing: border-box;
      overflow-x: hidden;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .dashboard-header h1 {
      margin: 0;
      color: #004aad;
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.02em;
    }

    .dashboard-header p {
      margin: 6px 0 0 0;
      color: #64748b;
      font-size: 15px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .kpi-card,
    .toolbar-card,
    .table-card,
    .loading-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
      box-sizing: border-box;
    }

    .kpi-card {
      padding: 18px;
      min-width: 0;
    }

    .kpi-card span {
      display: block;
      color: #64748b;
      font-size: 12px;
      font-weight: 900;
      margin-bottom: 8px;
    }

    .kpi-card strong {
      display: block;
      color: #004aad;
      font-size: 24px;
      font-weight: 950;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .kpi-card small {
      display: block;
      margin-top: 8px;
      color: #64748b;
      font-size: 12px;
    }

    .toolbar-card {
      display: flex;
      align-items: end;
      gap: 16px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .search-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .search-box label {
      color: #004aad;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .search-box input {
      width: 100%;
      height: 46px;
      padding: 0 14px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      outline: none;
      font-size: 14px;
      box-sizing: border-box;
    }

    .search-box input:focus {
      border-color: #004aad;
      box-shadow: 0 0 0 3px rgba(0, 74, 173, 0.12);
    }

    .toolbar-actions {
      display: flex;
      gap: 10px;
    }

    .primary-btn,
    .secondary-btn,
    .reset-btn {
      border: none;
      border-radius: 12px;
      height: 44px;
      padding: 0 18px;
      font-weight: 900;
      cursor: pointer;
      white-space: nowrap;
      transition: 0.2s ease;
    }

    .primary-btn {
      background: #004aad;
      color: #ffffff;
      box-shadow: 0 8px 18px rgba(0, 74, 173, 0.22);
    }

    .primary-btn:hover {
      background: #003b8a;
    }

    .secondary-btn {
      background: #e8f1ff;
      color: #004aad;
    }

    .secondary-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .reset-btn {
      background: #f3f4f6;
      color: #111827;
    }

    .loading-card {
      padding: 24px;
      text-align: center;
      font-weight: 800;
      color: #475569;
    }

    .alert {
      margin-bottom: 18px;
      padding: 14px 16px;
      border-radius: 14px;
      font-weight: 800;
    }

    .error {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    .table-card {
      overflow: hidden;
    }

    .table-header {
      padding: 22px 24px;
      border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%);
    }

    .table-header h2 {
      margin: 0;
      color: #004aad;
      font-size: 22px;
      font-weight: 950;
    }

    .table-header p {
      margin: 6px 0 0 0;
      color: #64748b;
      font-size: 14px;
    }

    .table-wrapper {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1100px;
    }

    th {
      text-align: left;
      color: #004aad;
      font-size: 12px;
      font-weight: 950;
      padding: 14px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e5e7eb;
      white-space: nowrap;
    }

    td {
      padding: 14px 16px;
      border-bottom: 1px solid #edf2f7;
      color: #0f172a;
      font-size: 14px;
      vertical-align: top;
    }

    .wallet-address {
      max-width: 260px;
      overflow-wrap: anywhere;
      font-size: 12px;
      color: #334155;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 900;
      background: #f1f5f9;
      color: #475569;
    }

    .status-pill.active {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }

    .status-pill.inactive {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    .empty-cell {
      text-align: center;
      padding: 28px;
      color: #64748b;
      font-weight: 800;
    }

    .pagination-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 24px;
      color: #475569;
      font-weight: 800;
    }

    .pagination-actions {
      display: flex;
      gap: 10px;
    }

    @media (max-width: 1200px) {
      .kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 900px) {
      .dashboard-page {
        padding: 20px;
      }

      .dashboard-header,
      .toolbar-card,
      .pagination-row {
        flex-direction: column;
        align-items: flex-start;
      }

      .kpi-grid {
        grid-template-columns: 1fr;
      }

      .toolbar-actions,
      .pagination-actions {
        width: 100%;
        flex-wrap: wrap;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly apiBaseUrl = '/api/v1';

  wallets: DashboardWallet[] = [];

  loading = false;
  errorMessage = '';

  searchText = '';

  page = 1;
  limit = 13;
  totalRecords = 0;
  totalPages = 1;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadWallets();
  }

  get activeWallets(): number {
    return this.wallets.filter((wallet) => wallet.status === 'ACTIVE').length;
  }

  loadWallets(): void {
    this.loading = true;
    this.errorMessage = '';

    const params = new URLSearchParams({
      page: String(this.page),
      limit: String(this.limit)
    });

    if (this.searchText.trim()) {
      params.set('search', this.searchText.trim());
    }

    this.http
      .get<any>(`${this.apiBaseUrl}/wallets?${params.toString()}`)
      .subscribe({
        next: (res: any) => {
          this.loading = false;

          const responseData = res?.data || [];
          const wallets =
            Array.isArray(responseData)
              ? responseData
              : responseData?.data ||
                responseData?.wallets ||
                responseData?.records ||
                [];

          this.wallets = wallets;

          const pagination = res?.pagination || res?.meta || responseData?.pagination || {};

          this.totalRecords =
            pagination?.totalRecords ||
            pagination?.total ||
            res?.totalRecords ||
            responseData?.totalRecords ||
            this.wallets.length;

          this.totalPages =
            pagination?.totalPages ||
            Math.max(1, Math.ceil(this.totalRecords / this.limit));
        },
        error: (err: any) => {
          this.loading = false;
          this.wallets = [];
          this.totalRecords = 0;
          this.totalPages = 1;

          this.errorMessage =
            err?.error?.message ||
            err?.message ||
            'Failed to load dashboard wallets';
        }
      });
  }

  searchWallets(): void {
    this.page = 1;
    this.loadWallets();
  }

  clearSearch(): void {
    this.searchText = '';
    this.page = 1;
    this.loadWallets();
  }

  refreshDashboard(): void {
    this.loadWallets();
  }

  previousPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadWallets();
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.loadWallets();
    }
  }
}