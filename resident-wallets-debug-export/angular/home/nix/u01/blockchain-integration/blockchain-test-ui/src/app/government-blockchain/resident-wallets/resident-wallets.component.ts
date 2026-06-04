import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';

type WalletStatus = 'Active' | 'Pending' | 'Suspended' | 'Blocked';
type BlockchainStatus = 'Synced' | 'Pending' | 'Failed';

interface ResidentWallet {
  walletAddress: string;
  residentId: string;
  residentName: string;
  currency: string;
  currentBalance: number;
  walletStatus: WalletStatus;
  blockchainStatus: BlockchainStatus;
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
  private readonly apiUrl =
    '/api/v1/government-blockchain/digital-kyc/resident-wallets';

  filters = {
    walletAddress: '',
    residentId: '',
    residentName: '',
    walletStatus: '',
    blockchainStatus: ''
  };

  walletStatuses: WalletStatus[] = ['Active', 'Pending', 'Suspended', 'Blocked'];
  blockchainStatuses: BlockchainStatus[] = ['Synced', 'Pending', 'Failed'];

  wallets: ResidentWallet[] = [];

  summary: ResidentWalletSummary = {
    totalWallets: 0,
    activeWallets: 0,
    suspendedWallets: 0,
    blockedWallets: 0,
    blockchainSynced: 0
  };

  isLoading = false;
  errorMessage = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadResidentWallets();
  }

  loadResidentWallets(): void {
    this.isLoading = true;
    this.errorMessage = '';

    let params = new HttpParams();

    if (this.filters.walletAddress.trim()) {
      params = params.set('walletAddress', this.filters.walletAddress.trim());
    }

    if (this.filters.residentId.trim()) {
      params = params.set('residentId', this.filters.residentId.trim());
    }

    if (this.filters.residentName.trim()) {
      params = params.set('residentName', this.filters.residentName.trim());
    }

    if (this.filters.walletStatus) {
      params = params.set('walletStatus', this.filters.walletStatus);
    }

    if (this.filters.blockchainStatus) {
      params = params.set('blockchainStatus', this.filters.blockchainStatus);
    }

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
          console.log('Resident wallets API response:', response);

          const apiData = response.data || [];

          this.wallets = apiData.map((wallet) => this.mapWalletFromApi(wallet));

          this.summary = response.summary
            ? this.normalizeSummary(response.summary)
            : this.calculateSummary(this.wallets);

          if (!response.success && response.message) {
            this.errorMessage = response.message;
          }
        },
        error: (error) => {
          console.error('Failed to load resident wallets:', error);

          this.wallets = [];
          this.summary = this.emptySummary();

          if (error.name === 'TimeoutError') {
            this.errorMessage =
              'API timeout. The backend did not respond within 15 seconds.';
            return;
          }

          if (error.status === 0) {
            this.errorMessage =
              'API connection failed. Check backend URL, CORS, and port 3001.';
            return;
          }

          if (error.status === 404) {
            this.errorMessage =
              'API endpoint not found. Check the resident-wallets backend route.';
            return;
          }

          if (error.status === 500) {
            this.errorMessage =
              error.error?.message || 'Backend error while reading resident wallets from database.';
            return;
          }

          this.errorMessage =
            error.error?.message || 'Failed to load resident wallets from database.';
        }
      });
  }

  get filteredWallets(): ResidentWallet[] {
    return this.wallets;
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

  viewWallet(wallet: ResidentWallet): void {
    console.log('View Wallet:', wallet);
  }

  activateWallet(wallet: ResidentWallet): void {
    console.log('Activate Wallet:', wallet);
  }

  suspendWallet(wallet: ResidentWallet): void {
    console.log('Suspend Wallet:', wallet);
  }

  blockWallet(wallet: ResidentWallet): void {
    console.log('Block Wallet:', wallet);
  }

  viewTransactions(wallet: ResidentWallet): void {
    console.log('View Transactions:', wallet);
  }

  viewBlockchainProof(wallet: ResidentWallet): void {
    console.log('View Blockchain Proof:', wallet);
  }

  getWalletStatusClass(status: WalletStatus): string {
    return `wallet-status-${status.toLowerCase()}`;
  }

  getBlockchainStatusClass(status: BlockchainStatus): string {
    return `blockchain-status-${status.toLowerCase()}`;
  }

  formatBalance(amount: number): string {
    return Number(amount || 0).toLocaleString('en-US');
  }

  private mapWalletFromApi(wallet: any): ResidentWallet {
    return {
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

      currency:
        wallet.currency ||
        wallet.walletCurrency ||
        wallet.wallet_currency ||
        wallet.currencyCode ||
        wallet.currency_code ||
        'LBP',

      currentBalance:
        Number(
          wallet.currentBalance ??
          wallet.current_balance ??
          wallet.walletBalance ??
          wallet.wallet_balance ??
          wallet.balance ??
          0
        ),

      walletStatus: this.normalizeWalletStatus(
        wallet.walletStatus ||
        wallet.wallet_status ||
        wallet.status
      ),

      blockchainStatus: this.normalizeBlockchainStatus(
        wallet.blockchainStatus ||
        wallet.blockchain_status ||
        wallet.syncStatus ||
        wallet.sync_status
      ),

      createdAt:
        wallet.createdAt ||
        wallet.created_at ||
        wallet.creationDate ||
        wallet.creation_date ||
        ''
    };
  }

  private normalizeWalletStatus(status: string): WalletStatus {
    const value = String(status || '').toLowerCase();

    if (value === 'active') {
      return 'Active';
    }

    if (value === 'suspended') {
      return 'Suspended';
    }

    if (value === 'blocked') {
      return 'Blocked';
    }

    return 'Pending';
  }

  private normalizeBlockchainStatus(status: string): BlockchainStatus {
    const value = String(status || '').toLowerCase();

    if (value === 'synced' || value === 'sync' || value === 'success') {
      return 'Synced';
    }

    if (value === 'failed' || value === 'error') {
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
      activeWallets: wallets.filter(wallet => wallet.walletStatus === 'Active').length,
      suspendedWallets: wallets.filter(wallet => wallet.walletStatus === 'Suspended').length,
      blockedWallets: wallets.filter(wallet => wallet.walletStatus === 'Blocked').length,
      blockchainSynced: wallets.filter(wallet => wallet.blockchainStatus === 'Synced').length
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