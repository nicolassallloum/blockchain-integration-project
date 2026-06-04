import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';

type WalletStatus = 'Active' | 'Pending' | 'Suspended' | 'Blocked' | 'Not Created';
type BlockchainStatus = 'Synced' | 'Pending' | 'Failed';

interface ResidentWallet {
  walletAddress: string;
  wallet_address?: string;
  residentId: string;
  resident_id?: string;
  residentName: string;
  resident_name?: string;
  currency: string;
  currentBalance: number;
  current_balance?: number;
  walletStatus: WalletStatus;
  wallet_status?: WalletStatus;
  blockchainStatus: BlockchainStatus;
  blockchain_status?: BlockchainStatus;
  createdAt: string;
  created_at?: string;
}

@Component({
  selector: 'app-resident-wallets',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './resident-wallets.component.html',
  styleUrl: './resident-wallets.component.scss'
})
export class ResidentWalletsComponent implements OnInit {
  private readonly apiUrl = 'http://172.31.13.90:3001/api/v1';

  loading = false;
  errorMessage = '';

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

  summary = {
    totalWallets: 0,
    activeWallets: 0,
    suspendedWallets: 0,
    blockedWallets: 0,
    blockchainSynced: 0
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadResidentWallets();
  }

  loadResidentWallets(): void {
    this.loading = true;
    this.errorMessage = '';

    let params = new HttpParams();

    if (this.filters.walletAddress) {
      params = params.set('walletAddress', this.filters.walletAddress);
    }

    if (this.filters.residentId) {
      params = params.set('residentId', this.filters.residentId);
    }

    if (this.filters.residentName) {
      params = params.set('residentName', this.filters.residentName);
    }

    if (this.filters.walletStatus) {
      params = params.set('walletStatus', this.filters.walletStatus);
    }

    if (this.filters.blockchainStatus) {
      params = params.set('blockchainStatus', this.filters.blockchainStatus);
    }
    const url = `${this.apiUrl}/government-blockchain/resident-wallets`;
    console.log('RESIDENT WALLETS API URL:', url);
    console.log('RESIDENT WALLETS API PARAMS:', params.toString());
    this.http
      .get<any>(`${this.apiUrl}/government-blockchain/resident-wallets`, { params })
      .subscribe({
        next: (response) => {
          console.log('RESIDENT WALLETS API SUCCESS:', response);
          if (response?.success === true) {
            this.wallets = (response.data || []).map((wallet: any) => ({
              walletAddress: wallet.walletAddress || wallet.wallet_address || '-',
              wallet_address: wallet.wallet_address || wallet.walletAddress || '-',

              residentId: wallet.residentId || wallet.resident_id || '-',
              resident_id: wallet.resident_id || wallet.residentId || '-',

              residentName: wallet.residentName || wallet.resident_name || '-',
              resident_name: wallet.resident_name || wallet.residentName || '-',

              currency: wallet.currency || 'LBP',

              currentBalance: Number(wallet.currentBalance || wallet.current_balance || 0),
              current_balance: Number(wallet.current_balance || wallet.currentBalance || 0),

              walletStatus: wallet.walletStatus || wallet.wallet_status || 'Not Created',
              wallet_status: wallet.wallet_status || wallet.walletStatus || 'Not Created',

              blockchainStatus: wallet.blockchainStatus || wallet.blockchain_status || 'Pending',
              blockchain_status: wallet.blockchain_status || wallet.blockchainStatus || 'Pending',

              createdAt: wallet.createdAt || wallet.created_at || '-',
              created_at: wallet.created_at || wallet.createdAt || '-'
            }));

            this.summary = {
              totalWallets: response.summary?.totalWallets ?? this.wallets.length,
              activeWallets: response.summary?.activeWallets ?? this.wallets.filter(w => w.walletStatus === 'Active').length,
              suspendedWallets: response.summary?.suspendedWallets ?? this.wallets.filter(w => w.walletStatus === 'Suspended').length,
              blockedWallets: response.summary?.blockedWallets ?? this.wallets.filter(w => w.walletStatus === 'Blocked').length,
              blockchainSynced: response.summary?.blockchainSynced ?? this.wallets.filter(w => w.blockchainStatus === 'Synced').length
            };

            this.errorMessage = '';
          } else {
            this.wallets = [];
            this.resetSummary();
            this.errorMessage = response?.message || 'Failed to load resident wallets from database.';
          }

          this.loading = false;
        },
        error: (error) => {
          console.error('RESIDENT WALLETS API ERROR:', error);
          console.error('Resident wallets API error:', error);
          this.wallets = [];
          this.resetSummary();
          this.errorMessage = 'Failed to load resident wallets from database.';
          this.loading = false;
        }
      });
  }

  get filteredWallets(): ResidentWallet[] {
    return this.wallets.filter((wallet) => {
      return (
        (!this.filters.walletAddress ||
          wallet.walletAddress.toLowerCase().includes(this.filters.walletAddress.toLowerCase())) &&
        (!this.filters.residentId ||
          wallet.residentId.toLowerCase().includes(this.filters.residentId.toLowerCase())) &&
        (!this.filters.residentName ||
          wallet.residentName.toLowerCase().includes(this.filters.residentName.toLowerCase())) &&
        (!this.filters.walletStatus || wallet.walletStatus === this.filters.walletStatus) &&
        (!this.filters.blockchainStatus || wallet.blockchainStatus === this.filters.blockchainStatus)
      );
    });
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

  searchWallets(): void {
    this.loadResidentWallets();
  }

  refreshWallets(): void {
    this.loadResidentWallets();
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

  private resetSummary(): void {
    this.summary = {
      totalWallets: 0,
      activeWallets: 0,
      suspendedWallets: 0,
      blockedWallets: 0,
      blockchainSynced: 0
    };
  }

  viewWallet(wallet: ResidentWallet): void {
    console.log('View Wallet', wallet);
  }

  activateWallet(wallet: ResidentWallet): void {
    wallet.walletStatus = 'Active';
  }

  suspendWallet(wallet: ResidentWallet): void {
    wallet.walletStatus = 'Suspended';
  }

  blockWallet(wallet: ResidentWallet): void {
    wallet.walletStatus = 'Blocked';
  }

  viewTransactions(wallet: ResidentWallet): void {
    console.log('View Transactions', wallet);
  }

  viewBlockchainProof(wallet: ResidentWallet): void {
    console.log('View Blockchain Proof', wallet);
  }

  getWalletStatusClass(status: WalletStatus): string {
    return `wallet-status-${String(status).toLowerCase().replace(/\s+/g, '-')}`;
  }

  getBlockchainStatusClass(status: BlockchainStatus): string {
    return `blockchain-status-${String(status).toLowerCase()}`;
  }

  formatBalance(amount: number): string {
    return Number(amount || 0).toLocaleString('en-US');
  }
}