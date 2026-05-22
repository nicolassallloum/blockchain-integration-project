import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

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

@Component({
  selector: 'app-resident-wallets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resident-wallets.component.html',
  styleUrl: './resident-wallets.component.scss'
})
export class ResidentWalletsComponent {
  filters = {
    walletAddress: '',
    residentId: '',
    residentName: '',
    walletStatus: '',
    blockchainStatus: ''
  };

  walletStatuses: WalletStatus[] = ['Active', 'Pending', 'Suspended', 'Blocked'];
  blockchainStatuses: BlockchainStatus[] = ['Synced', 'Pending', 'Failed'];

  wallets: ResidentWallet[] = [
    {
      walletAddress: '0xLB-GOV-RES-000001',
      residentId: 'RES-000001',
      residentName: 'Nicolas Bernard Salloum',
      currency: 'LBP',
      currentBalance: 1250000,
      walletStatus: 'Active',
      blockchainStatus: 'Synced',
      createdAt: '2026-05-21 10:15'
    },
    {
      walletAddress: '0xLB-GOV-RES-000002',
      residentId: 'RES-000002',
      residentName: 'Mariam Haddad',
      currency: 'LBP',
      currentBalance: 850000,
      walletStatus: 'Pending',
      blockchainStatus: 'Pending',
      createdAt: '2026-05-21 11:30'
    },
    {
      walletAddress: '0xLB-GOV-RES-000003',
      residentId: 'RES-000003',
      residentName: 'George Khoury',
      currency: 'USD',
      currentBalance: 320,
      walletStatus: 'Suspended',
      blockchainStatus: 'Synced',
      createdAt: '2026-05-20 14:05'
    },
    {
      walletAddress: '0xLB-GOV-RES-000004',
      residentId: 'RES-000004',
      residentName: 'Rana Aoun',
      currency: 'LBP',
      currentBalance: 0,
      walletStatus: 'Blocked',
      blockchainStatus: 'Failed',
      createdAt: '2026-05-19 09:45'
    }
  ];

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
    return this.wallets.length;
  }

  get activeWallets(): number {
    return this.wallets.filter(wallet => wallet.walletStatus === 'Active').length;
  }

  get suspendedWallets(): number {
    return this.wallets.filter(wallet => wallet.walletStatus === 'Suspended').length;
  }

  get blockedWallets(): number {
    return this.wallets.filter(wallet => wallet.walletStatus === 'Blocked').length;
  }

  get syncedWallets(): number {
    return this.wallets.filter(wallet => wallet.blockchainStatus === 'Synced').length;
  }

  resetFilters(): void {
    this.filters = {
      walletAddress: '',
      residentId: '',
      residentName: '',
      walletStatus: '',
      blockchainStatus: ''
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
    return `wallet-status-${status.toLowerCase()}`;
  }

  getBlockchainStatusClass(status: BlockchainStatus): string {
    return `blockchain-status-${status.toLowerCase()}`;
  }

  formatBalance(amount: number): string {
    return amount.toLocaleString('en-US');
  }
}