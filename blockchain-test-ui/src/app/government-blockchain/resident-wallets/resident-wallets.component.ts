import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';

type WalletStatus = 'Active' | 'Pending' | 'Suspended' | 'Blocked' | 'Not Created';
type BlockchainStatus = 'Synced' | 'Pending' | 'Failed';

interface ResidentWallet {
  id: string | number;
  walletAddress: string;
  residentId: string;
  residentName: string;
  balance: number;
  currency: string;
  walletStatus: WalletStatus;
  blockchainStatus: BlockchainStatus;
  fabricTxId?: string | null;
  createdAt: string;
}

interface ResidentWalletSummary {
  totalWallets: number;
  activeWallets: number;
  suspendedWallets: number;
  blockedWallets: number;
  blockchainSynced: number;
}

interface ResidentWalletApiResponse {
  success: boolean;
  message: string;
  summary?: ResidentWalletSummary;
  count?: number;
  data?: any[];
}

@Component({
  selector: 'app-resident-wallets',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './resident-wallets.component.html',
  styleUrl: './resident-wallets.component.scss'
})
export class ResidentWalletsComponent implements OnInit {
  private readonly apiUrl = '/api/v1/government-blockchain/resident-wallets';

  filters = {
    walletAddress: '',
    residentId: '',
    residentName: '',
    walletStatus: '',
    blockchainStatus: ''
  };

  walletStatuses: WalletStatus[] = ['Active', 'Pending', 'Suspended', 'Blocked', 'Not Created'];
  blockchainStatuses: BlockchainStatus[] = ['Synced', 'Pending', 'Failed'];

  wallets: ResidentWallet[] = [];

  summary: ResidentWalletSummary = this.emptySummary();

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadResidentWallets();
  }

  loadResidentWallets(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    let params = new HttpParams();

    Object.entries(this.filters).forEach(([key, value]) => {
      const cleanValue = String(value || '').trim();

      if (cleanValue) {
        params = params.set(key, cleanValue);
      }
    });

    this.http
      .get<ResidentWalletApiResponse>(this.apiUrl, { params })
      .pipe(
        timeout(15000),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (response) => {
          const apiData = response.data || [];

          this.wallets = apiData.map((wallet) => this.mapWalletFromApi(wallet));

          this.summary = response.summary
            ? this.normalizeSummary(response.summary)
            : this.calculateSummary(this.wallets);

          if (response.success) {
            this.successMessage = response.message || 'Resident wallets loaded successfully.';
          } else {
            this.errorMessage = response.message || 'Failed to load resident wallets.';
          }
        },
        error: (error) => {
          console.error('Failed to load resident wallets:', error);

          this.wallets = [];
          this.summary = this.emptySummary();

          if (error.name === 'TimeoutError') {
            this.errorMessage = 'API timeout. The backend did not respond within 15 seconds.';
            return;
          }

          if (error.status === 0) {
            this.errorMessage = 'API connection failed. Check backend URL, CORS, proxy, and port 3001.';
            return;
          }

          if (error.status === 404) {
            this.errorMessage = 'Resident wallets API endpoint not found.';
            return;
          }

          this.errorMessage =
            error.error?.message || 'Failed to load resident wallets from PostgreSQL.';
        }
      });
  }

  resetFilters(): void {
    this.filters = {
      walletAddress: '',
      residentId: '',
      residentName: '',
      walletStatus: '',
      blockchainStatus: ''
    };

    this.loadResidentWallets();
  }

  refreshWallets(): void {
    this.loadResidentWallets();
  }

  exportCsv(): void {
    const headers = [
      'Wallet Address',
      'Resident ID',
      'Resident Name',
      'Balance',
      'Currency',
      'Wallet Status',
      'Blockchain Status',
      'Created Date'
    ];

    const rows = this.wallets.map((wallet) => [
      wallet.walletAddress,
      wallet.residentId,
      wallet.residentName,
      this.formatBalance(wallet.balance),
      'GOV',
      wallet.walletStatus,
      wallet.blockchainStatus,
      this.formatDate(wallet.createdAt)
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `resident-wallets-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    window.URL.revokeObjectURL(url);
  }

  viewWallet(wallet: ResidentWallet): void {
    console.log('View Wallet:', wallet);
  }

  viewTransactions(wallet: ResidentWallet): void {
    console.log('View Transactions:', wallet);
  }

  viewBlockchainProof(wallet: ResidentWallet): void {
    console.log('View Blockchain Proof:', wallet);
  }

  get totalWallets(): number {
    return this.summary.totalWallets;
  }

  get activeWallets(): number {
    return this.summary.activeWallets;
  }

  get suspendedWallets(): number {
    return this.summary.suspendedWallets;
  }

  get blockedWallets(): number {
    return this.summary.blockedWallets;
  }

  get syncedWallets(): number {
    return this.summary.blockchainSynced;
  }

  get hasFilters(): boolean {
    return Object.values(this.filters).some((value) => String(value || '').trim() !== '');
  }

  getWalletStatusClass(status: WalletStatus): string {
    return `wallet-status-${String(status || 'pending').toLowerCase().replace(/\s+/g, '-')}`;
  }

  getBlockchainStatusClass(status: BlockchainStatus): string {
    return `blockchain-status-${String(status || 'pending').toLowerCase()}`;
  }

  formatBalance(amount: number): string {
    return Number(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatDate(value: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  trackByWalletAddress(index: number, wallet: ResidentWallet): string {
    return wallet.walletAddress || String(index);
  }

  private mapWalletFromApi(wallet: any): ResidentWallet {
    return {
      id: wallet.id || wallet.wallet_id || wallet.walletAddress || wallet.wallet_address || '-',

      walletAddress:
        wallet.walletAddress ||
        wallet.wallet_address ||
        wallet.address ||
        '-',

      residentId:
        wallet.residentId ||
        wallet.resident_id ||
        wallet.customerId ||
        wallet.customer_id ||
        '-',

      residentName:
        wallet.residentName ||
        wallet.resident_name ||
        wallet.fullName ||
        wallet.full_name ||
        '-',

      balance: Number(
        wallet.balance ??
        wallet.currentBalance ??
        wallet.current_balance ??
        0
      ),

      currency: 'GOV',

      walletStatus: this.normalizeWalletStatus(
        wallet.walletStatus ||
        wallet.wallet_status ||
        wallet.status
      ),

      blockchainStatus: this.normalizeBlockchainStatus(
        wallet.blockchainStatus ||
        wallet.blockchain_status ||
        wallet.fabricStatus ||
        wallet.fabric_status
      ),

      fabricTxId:
        wallet.fabricTxId ||
        wallet.fabric_tx_id ||
        null,

      createdAt:
        wallet.createdAt ||
        wallet.created_at ||
        ''
    };
  }

  private normalizeWalletStatus(status: any): WalletStatus {
    const value = String(status || '').trim().toLowerCase();

    if (value === 'active') return 'Active';
    if (value === 'suspended') return 'Suspended';
    if (value === 'blocked') return 'Blocked';
    if (value === 'not created') return 'Not Created';

    return 'Pending';
  }

  private normalizeBlockchainStatus(status: any): BlockchainStatus {
    const value = String(status || '').trim().toLowerCase();

    if (
      value === 'synced' ||
      value === 'confirmed' ||
      value === 'fabric_confirmed' ||
      value === 'success' ||
      value === 'completed'
    ) {
      return 'Synced';
    }

    if (
      value === 'failed' ||
      value === 'error' ||
      value === 'rejected'
    ) {
      return 'Failed';
    }

    return 'Pending';
  }

  private normalizeSummary(summary: ResidentWalletSummary): ResidentWalletSummary {
    return {
      totalWallets: Number(summary.totalWallets || 0),
      activeWallets: Number(summary.activeWallets || 0),
      suspendedWallets: Number(summary.suspendedWallets || 0),
      blockedWallets: Number(summary.blockedWallets || 0),
      blockchainSynced: Number(summary.blockchainSynced || 0)
    };
  }

  private calculateSummary(wallets: ResidentWallet[]): ResidentWalletSummary {
    return {
      totalWallets: wallets.length,
      activeWallets: wallets.filter((wallet) => wallet.walletStatus === 'Active').length,
      suspendedWallets: wallets.filter((wallet) => wallet.walletStatus === 'Suspended').length,
      blockedWallets: wallets.filter((wallet) => wallet.walletStatus === 'Blocked').length,
      blockchainSynced: wallets.filter((wallet) => wallet.blockchainStatus === 'Synced').length
    };
  }

  private emptySummary(): ResidentWalletSummary {
    return {
      totalWallets: 0,
      activeWallets: 0,
      suspendedWallets: 0,
      blockedWallets: 0,
      blockchainSynced: 0
    };
  }
}
