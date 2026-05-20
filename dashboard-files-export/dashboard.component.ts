import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { WalletApiService } from '../../core/services/wallet-api.service';
import { ProjectViewApiService } from '../../core/services/project-view-api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div>
          <h1>Digital KYC Dashboard</h1>
          <p>Professional overview of blockchain wallets, transactions, organizations, and network health.</p>
        </div>

        <button class="secondary-btn" type="button" (click)="refresh()" [disabled]="loading">
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <span>Total Wallets</span>
          <strong>{{ walletSummary.totalWallets | number }}</strong>
          <p>Registered blockchain identities</p>
        </div>

        <div class="stat-card">
          <span>Displayed Wallets</span>
          <strong>{{ activeWallets | number }}</strong>
          <p>Status = ACTIVE</p>
        </div>

        <div class="stat-card">
          <span>Total Balance</span>
          <strong>{{ walletSummary.totalBalance | number:'1.2-2' }}</strong>
          <p>{{ walletSummary.currencyCode || 'USD' }} active wallet balance</p>
        </div>

        <div class="stat-card">
          <span>Today Created Wallets</span>
          <strong>{{ walletSummary.todayCreatedWallets | number }}</strong>
          <p>New wallets created today</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <span>Today Transactions</span>
          <strong>{{ transactionSummary.todayTransactions | number }}</strong>
          <p>Transactions recorded today</p>
        </div>

        <div class="stat-card">
          <span>Total Transactions</span>
          <strong>{{ transactionSummary.totalTransactions | number }}</strong>
          <p>All blockchain transaction records</p>
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

      <div class="stats-grid viewer-stats-grid">
        <div class="stat-card viewer-card">
          <span>Total Project Views</span>
          <strong>{{ projectViewStats.totalViews }}</strong>
          <p>All blockchain UI page opens</p>
        </div>

        <div class="stat-card viewer-card">
          <span>Unique Visitors</span>
          <strong>{{ projectViewStats.uniqueVisitors }}</strong>
          <p>Based on browser session</p>
        </div>

        <div class="stat-card viewer-card">
          <span>Today Views</span>
          <strong>{{ projectViewStats.todayViews }}</strong>
          <p>Views recorded today</p>
        </div>

        <div class="stat-card viewer-card">
          <span>Last Viewed At</span>
          <strong class="small-value">{{ formatDateTime(projectViewStats.lastViewedAt) }}</strong>
          <p>Latest project access time</p>
        </div>
      </div>

      <div class="dashboard-two-columns">
        <section class="dashboard-section">
          <div class="section-header compact">
            <div>
              <h2>Wallet Growth Chart</h2>
              <p>Wallets created during the last 30 days.</p>
            </div>
          </div>

          <div class="chart-empty" *ngIf="!loading && walletGrowth.length === 0">
            No wallet growth data available.
          </div>

          <div class="bar-chart" *ngIf="walletGrowth.length > 0">
            <div class="bar-item" *ngFor="let item of walletGrowth">
              <div class="bar-label">{{ formatShortDate(item.date) }}</div>
              <div class="bar-track">
                <div class="bar-fill" [style.width.%]="getWalletGrowthPercent(item.wallets)"></div>
              </div>
              <div class="bar-value">{{ item.wallets | number }}</div>
            </div>
          </div>
        </section>

        <section class="dashboard-section">
          <div class="section-header compact">
            <div>
              <h2>Blockchain Network Health</h2>
              <p>Fabric, CouchDB, PostgreSQL, and chaincode status.</p>
            </div>
          </div>

          <div class="health-grid">
            <div class="health-item">
              <span>Fabric Peer Status</span>
              <strong>{{ blockchainHealth.fabricPeerStatus || blockchainHealth.fabric_peer_status || '-' }}</strong>
            </div>

            <div class="health-item">
              <span>Orderer Status</span>
              <strong>{{ blockchainHealth.ordererStatus || blockchainHealth.orderer_status || '-' }}</strong>
            </div>

            <div class="health-item">
              <span>CouchDB Status</span>
              <strong>{{ blockchainHealth.couchDbStatus || blockchainHealth.couchdbStatus || blockchainHealth.couch_db_status || '-' }}</strong>
            </div>

            <div class="health-item">
              <span>PostgreSQL Status</span>
              <strong>{{ blockchainHealth.postgresqlStatus || blockchainHealth.postgresql_status || '-' }}</strong>
            </div>

            <div class="health-item">
              <span>Chaincode Status</span>
              <strong>{{ blockchainHealth.chaincodeStatus || blockchainHealth.chaincode_status || '-' }}</strong>
            </div>

            <div class="health-item">
              <span>Channel Name</span>
              <strong>{{ blockchainHealth.channelName || blockchainHealth.channel_name || '-' }}</strong>
            </div>

            <div class="health-item">
              <span>Chaincode Version</span>
              <strong>{{ blockchainHealth.chaincodeVersion || blockchainHealth.chaincode_version || '-' }}</strong>
            </div>

            <div class="health-item">
              <span>Last Block Number</span>
              <strong>{{ getLastBlockNumber() | number }}</strong>
            </div>

            <div class="health-item">
              <span>Channel Height</span>
              <strong>{{ getChannelHeight() | number }}</strong>
            </div>

            <div class="health-item wide">
              <span>Last Sync Time</span>
              <strong>{{ formatDateTime(getLastSyncTime()) }}</strong>
            </div>

            <div class="health-item wide debug-item" *ngIf="showBlockchainDebug">
              <span>Debug Blockchain Health</span>
              <pre>{{ blockchainHealth | json }}</pre>
            </div>
          </div>
        </section>
      </div>

      <section class="dashboard-section">
        <div class="section-header compact">
          <div>
            <h2>Transactions Overview</h2>
            <p>High-level transaction metrics for wallet and organization movement.</p>
          </div>

          <button class="light-btn" type="button" (click)="toggleBlockchainDebug()">
            {{ showBlockchainDebug ? 'Hide Debug' : 'Show Debug' }}
          </button>
        </div>

        <div class="metric-grid">
          <div class="metric-card">
            <span>Wallet-to-Wallet Transfers</span>
            <strong>{{ transactionSummary.walletToWalletTransfers | number }}</strong>
          </div>

          <div class="metric-card">
            <span>Wallet-to-Organization Transfers</span>
            <strong>{{ transactionSummary.walletToOrganizationTransfers | number }}</strong>
          </div>

          <div class="metric-card">
            <span>Total Transaction Volume</span>
            <strong>{{ transactionSummary.totalTransactionVolume | number:'1.2-2' }}</strong>
            <small>{{ transactionSummary.currencyCode || 'USD' }}</small>
          </div>

          <div class="metric-card">
            <span>Average Transaction Amount</span>
            <strong>{{ transactionSummary.averageTransactionAmount | number:'1.2-2' }}</strong>
            <small>{{ transactionSummary.currencyCode || 'USD' }}</small>
          </div>

          <div class="metric-card danger">
            <span>Failed Transactions</span>
            <strong>{{ transactionSummary.failedTransactions | number }}</strong>
          </div>

          <div class="metric-card warning">
            <span>Pending Transactions</span>
            <strong>{{ transactionSummary.pendingTransactions | number }}</strong>
          </div>
        </div>
      </section>

      <section class="dashboard-section">
        <div class="section-header compact">
          <div>
            <h2>Organization / Bank Summary</h2>
            <p>Wallets, balances, and transactions grouped by organization.</p>
          </div>
        </div>

        <div class="table-wrapper" *ngIf="organizationSummary.length > 0">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Code</th>
                <th>Type</th>
                <th>Wallets</th>
                <th>Balance</th>
                <th>Transactions</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              <tr *ngFor="let org of organizationSummary">
                <td>{{ org.organizationName || org.organization_name || '-' }}</td>
                <td>{{ org.organizationCode || org.organization_code || '-' }}</td>
                <td>{{ org.organizationType || org.organization_type || '-' }}</td>
                <td>{{ org.wallets | number }}</td>
                <td>{{ org.balance | number:'1.2-2' }} USD</td>
                <td>{{ org.transactions | number }}</td>
                <td>
                  <span class="status-pill" [class.active]="String(org.status).toUpperCase() === 'ACTIVE'">
                    {{ org.status || '-' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" *ngIf="!loading && organizationSummary.length === 0">
          <h3>No organization summary found</h3>
          <p>No organization records were returned from the backend.</p>
        </div>
      </section>

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
          Loading dashboard data...
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

      <section class="dashboard-section latest-section">
        <div class="section-header compact">
          <div>
            <h2>Latest Transactions</h2>
            <p>Most recent blockchain transactions from PostgreSQL.</p>
          </div>
        </div>

        <div class="table-wrapper" *ngIf="latestTransactions.length > 0">
          <table>
            <thead>
              <tr>
                <th>Tx ID</th>
                <th>From</th>
                <th>To</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              <tr *ngFor="let tx of latestTransactions">
                <td class="mono">{{ tx.txId || tx.tx_id || '-' }}</td>
                <td class="mono">{{ tx.from || tx.fromWalletAddress || tx.from_wallet_address || '-' }}</td>
                <td class="mono">{{ tx.to || tx.toWalletAddress || tx.to_wallet_address || '-' }}</td>
                <td>{{ tx.type || tx.transactionType || tx.transaction_type || '-' }}</td>
                <td>{{ tx.amount | number:'1.2-2' }} {{ tx.currency || tx.currencyCode || tx.currency_code || 'USD' }}</td>
                <td>
                  <span
                    class="status-pill"
                    [class.active]="String(tx.status).toUpperCase() === 'SUCCESS' || String(tx.status).toUpperCase() === 'COMPLETED'"
                    [class.warning]="String(tx.status).toUpperCase() === 'PENDING'"
                    [class.danger]="String(tx.status).toUpperCase() === 'FAILED'"
                  >
                    {{ tx.status || '-' }}
                  </span>
                </td>
                <td>{{ formatDateTime(tx.date || tx.createdAt || tx.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" *ngIf="!loading && latestTransactions.length === 0">
          <h3>No latest transactions found</h3>
          <p>No transaction records were returned from the backend.</p>
        </div>
      </section>

      <section class="dashboard-section reports-section">
        <div class="section-header compact">
          <div>
            <h2>Regulatory Reports Shortcut</h2>
            <p>Quick actions for future AML, KYC, bank, and audit exports.</p>
          </div>
        </div>

        <div class="report-actions">
          <button type="button" (click)="showReportPlaceholder('Daily Wallet Report')">Generate Daily Wallet Report</button>
          <button type="button" (click)="showReportPlaceholder('AML Suspicious Activity Report')">Generate AML Suspicious Activity Report</button>
          <button type="button" (click)="showReportPlaceholder('Bank Transactions Report')">Generate Bank Transactions Report</button>
          <button type="button" (click)="showReportPlaceholder('KYC Status Report')">Generate KYC Status Report</button>
          <button type="button" (click)="showReportPlaceholder('Audit Report')">Generate Audit Report</button>
          <button type="button" (click)="showReportPlaceholder('Regulatory Report Export')">Export Regulatory Report</button>
        </div>
      </section>

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
      .raw-card,
      .dashboard-section {
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

      .stat-card strong.small-value {
        font-size: 16px;
        letter-spacing: 0;
        word-break: break-word;
      }

      .stat-card strong.source {
        font-size: 26px;
      }

      .stat-card p {
        margin: 0;
        color: #52647d;
        font-size: 13px;
      }

      .viewer-stats-grid {
        margin-top: -6px;
      }

      .viewer-card {
        border-left: 5px solid #004aad;
      }

      .dashboard-two-columns {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
        gap: 20px;
        margin-bottom: 20px;
      }

      .dashboard-section {
        padding: 20px;
        margin-bottom: 20px;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-start;
        margin-bottom: 16px;
      }

      .section-header.compact {
        margin-bottom: 18px;
      }

      .section-header h2,
      .search-card h2,
      .wallets-card h2,
      .raw-card h2 {
        margin: 0 0 8px;
        color: #004aad;
        font-size: 20px;
        font-weight: 800;
      }

      .section-header p {
        margin: 0;
        color: #52647d;
      }

      .metric-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 14px;
      }

      .metric-card {
        min-height: 110px;
        padding: 16px;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }

      .metric-card span {
        display: block;
        color: #52647d;
        font-size: 12px;
        font-weight: 800;
        min-height: 34px;
      }

      .metric-card strong {
        display: block;
        color: #004aad;
        font-size: 24px;
        font-weight: 900;
        margin-top: 8px;
      }

      .metric-card small {
        color: #64748b;
        font-weight: 800;
      }

      .metric-card.danger strong {
        color: #b91c1c;
      }

      .metric-card.warning strong {
        color: #b45309;
      }

      .health-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .health-item {
        padding: 13px;
        border-radius: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }

      .health-item.wide {
        grid-column: 1 / -1;
      }

      .health-item span {
        display: block;
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 6px;
      }

      .health-item strong {
        color: #004aad;
        font-size: 14px;
        font-weight: 900;
        word-break: break-word;
      }

      .debug-item pre {
        margin: 8px 0 0;
        max-height: 220px;
        font-size: 12px;
      }

      .bar-chart {
        display: grid;
        gap: 9px;
      }

      .bar-item {
        display: grid;
        grid-template-columns: 74px minmax(0, 1fr) 68px;
        gap: 10px;
        align-items: center;
      }

      .bar-label,
      .bar-value {
        color: #475569;
        font-size: 12px;
        font-weight: 800;
      }

      .bar-value {
        text-align: right;
      }

      .bar-track {
        height: 12px;
        background: #e2e8f0;
        border-radius: 999px;
        overflow: hidden;
      }

      .bar-fill {
        height: 100%;
        min-width: 4px;
        background: #004aad;
        border-radius: 999px;
      }

      .chart-empty {
        padding: 28px;
        text-align: center;
        border-radius: 14px;
        background: #f8fafc;
        color: #52647d;
        font-weight: 700;
      }

      .search-card {
        padding: 20px;
        margin-bottom: 20px;
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
      .light-btn,
      .report-actions button {
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

      .report-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .report-actions button {
        background: #eef5ff;
        color: #004aad;
        border: 1px solid #d5e5ff;
        text-align: left;
      }

      .report-actions button:hover,
      .secondary-btn:hover,
      .light-btn:hover,
      .primary-btn:hover {
        transform: translateY(-1px);
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

      .status-pill.warning {
        background: #fef3c7;
        color: #b45309;
      }

      .status-pill.danger {
        background: #fee2e2;
        color: #b91c1c;
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

      .latest-section,
      .reports-section,
      .raw-card {
        margin-top: 20px;
      }

      .raw-card {
        padding: 20px;
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

      @media (max-width: 1300px) {
        .metric-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 1100px) {
        .stats-grid,
        .dashboard-two-columns {
          grid-template-columns: repeat(2, 1fr);
        }

        .dashboard-two-columns {
          grid-template-columns: 1fr;
        }

        .search-row,
        .report-actions {
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

        .stats-grid,
        .metric-grid,
        .health-grid {
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

  private projectViewApi = inject(ProjectViewApiService);

  apiBaseUrl = environment.apiBaseUrl;

  loading = false;
  errorMessage = '';
  successMessage = '';
  showBlockchainDebug = false;

  wallets: any[] = [];
  apiResponse: any = null;

  walletSummary: any = {
    totalWallets: 0,
    activeWallets: 0,
    totalBalance: 0,
    todayCreatedWallets: 0,
    currencyCode: 'USD'
  };

  transactionSummary: any = {
    todayTransactions: 0,
    totalTransactions: 0,
    walletToWalletTransfers: 0,
    walletToOrganizationTransfers: 0,
    totalTransactionVolume: 0,
    averageTransactionAmount: 0,
    failedTransactions: 0,
    pendingTransactions: 0,
    currencyCode: 'USD'
  };

  walletGrowth: any[] = [];
  organizationSummary: any[] = [];
  blockchainHealth: any = {};
  latestTransactions: any[] = [];

  projectViewStats = {
    totalViews: 0,
    todayViews: 0,
    uniqueVisitors: 0,
    lastViewedAt: null as string | null,
    mostViewedPages: [] as any[]
  };

  totalWallets = 0;
  activeWallets = 0;
  dataSource = 'postgres';
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
    this.loadProjectViewStats();
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.walletApiService.getWallets(this.filters).subscribe({
      next: (response: any) => {
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

        this.dataSource = response?.source || 'postgres';
        this.tableName = response?.table || 'blockchain.wallets';

        this.loadDashboardSummary(false);
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

        this.cdr.detectChanges();
      }
    });
  }

  loadDashboardSummary(showSuccessMessage = true): void {
    this.walletApiService.getDashboardSummary().subscribe({
      next: (response: any) => {
        const data = response?.data || {};

        this.walletSummary = {
          ...this.walletSummary,
          ...(data.walletSummary || {})
        };

        this.transactionSummary = {
          ...this.transactionSummary,
          ...(data.transactionSummary || {})
        };

        this.walletGrowth = Array.isArray(data.walletGrowth) ? data.walletGrowth : [];
        this.organizationSummary = Array.isArray(data.organizationSummary) ? data.organizationSummary : [];

        this.blockchainHealth =
          data.blockchainHealth ||
          data.blockchain_health ||
          response?.blockchainHealth ||
          response?.blockchain_health ||
          {};

        this.latestTransactions = Array.isArray(data.latestTransactions)
          ? data.latestTransactions
          : Array.isArray(data.latest_transactions)
            ? data.latest_transactions
            : [];

        this.totalWallets = Number(this.walletSummary.totalWallets || this.totalWallets || 0);
        this.activeWallets = Number(this.walletSummary.activeWallets || this.activeWallets || 0);
        this.dataSource = response?.meta?.source || response?.source || 'postgres';

        this.loading = false;
        this.successMessage = showSuccessMessage
          ? 'Dashboard data loaded successfully.'
          : 'Dashboard data loaded successfully.';

        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.loading = false;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          `Http failure while loading ${this.apiBaseUrl}/dashboard/summary`;

        this.cdr.detectChanges();
      }
    });
  }

  refresh(): void {
    this.loadProjectViewStats();
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

  showReportPlaceholder(reportName: string): void {
    this.successMessage = `${reportName} shortcut is ready. Backend report export endpoint can be connected in the next step.`;
  }

  toggleBlockchainDebug(): void {
    this.showBlockchainDebug = !this.showBlockchainDebug;
  }

  getLastBlockNumber(): number {
    const value =
      this.blockchainHealth?.lastBlockNumber ??
      this.blockchainHealth?.last_block_number ??
      this.blockchainHealth?.blockNumber ??
      this.blockchainHealth?.block_number ??
      this.blockchainHealth?.latestBlockNumber ??
      this.blockchainHealth?.latest_block_number ??
      0;

    return Number(value) || 0;
  }

  getChannelHeight(): number {
    const value =
      this.blockchainHealth?.channelHeight ??
      this.blockchainHealth?.channel_height ??
      this.blockchainHealth?.height ??
      this.blockchainHealth?.ledgerHeight ??
      this.blockchainHealth?.ledger_height ??
      0;

    return Number(value) || 0;
  }

  getLastSyncTime(): string | null {
    return (
      this.blockchainHealth?.lastSyncTime ||
      this.blockchainHealth?.last_sync_time ||
      this.blockchainHealth?.updatedAt ||
      this.blockchainHealth?.updated_at ||
      null
    );
  }

  getWalletGrowthPercent(wallets: any): number {
    const value = Number(wallets || 0);

    const max = this.walletGrowth.reduce((largest: number, item: any) => {
      const count = Number(item?.wallets || 0);
      return count > largest ? count : largest;
    }, 0);

    if (!max) {
      return 0;
    }

    return Math.max(4, Math.round((value / max) * 100));
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

  loadProjectViewStats(): void {
    this.projectViewApi.getStats().subscribe({
      next: (response: any) => {
        const data = response?.data || {};

        this.projectViewStats = {
          totalViews: Number(data.totalViews || 0),
          todayViews: Number(data.todayViews || 0),
          uniqueVisitors: Number(data.uniqueVisitors || 0),
          lastViewedAt: data.lastViewedAt || null,
          mostViewedPages: Array.isArray(data.mostViewedPages) ? data.mostViewedPages : []
        };

        this.cdr.detectChanges();
      },
      error: () => {
        this.projectViewStats = {
          totalViews: 0,
          todayViews: 0,
          uniqueVisitors: 0,
          lastViewedAt: null,
          mostViewedPages: []
        };

        this.cdr.detectChanges();
      }
    });
  }

  formatDateTime(value: string | null): string {
    if (!value) {
      return '-';
    }

    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  formatShortDate(value: string | null): string {
    if (!value) {
      return '-';
    }

    try {
      return new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: '2-digit'
      });
    } catch {
      return value;
    }
  }
}