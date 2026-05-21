import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface SidebarMenuItem {
  label: string;
  route?: string;
  externalUrl?: string;
  icon: string;
  group: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    NgIf,
    NgFor
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  appName = 'VALORES';

  isSidebarCollapsed = false;
  sidebarSearchText = '';
  governmentMenuOpen = false;

  menuItems: SidebarMenuItem[] = [
    {
      label: 'Back',
      externalUrl: 'https://vfds.dev.hq.com/dashboard',
      icon: '↩',
      group: 'Navigation'
    },
    {
      label: 'Dashboard',
      route: '/digital-kyc/dashboard',
      icon: '●',
      group: 'Digital KYC'
    },
    {
      label: 'Wallet Create',
      route: '/digital-kyc/wallet-create',
      icon: '●',
      group: 'Digital KYC'
    },
    {
      label: 'BLOCKCHAIN Wallet Create',
      route: '/digital-kyc/blockchain-kyc',
      icon: '●',
      group: 'BlockChain Digital KYC'
    },
    {
      label: 'Wallet Login',
      route: '/digital-kyc/wallet-login',
      icon: '●',
      group: 'Digital KYC'
    },
    {
      label: 'Wallet Query',
      route: '/digital-kyc/wallet-query',
      icon: '●',
      group: 'Digital KYC'
    },
    {
      label: 'Fabric Test',
      route: '/digital-kyc/fabric-test',
      icon: '●',
      group: 'Digital KYC'
    },
    {
      label: 'Wallet Transfer',
      route: '/digital-kyc/wallet-transfer',
      icon: '●',
      group: 'Wallet Session'
    },
    {
      label: 'Organization Transfer',
      route: '/digital-kyc/organization-transfer',
      icon: '●',
      group: 'Wallet Session'
    },
    {
      label: 'Transaction History',
      route: '/digital-kyc/transaction-history',
      icon: '●',
      group: 'Wallet Session'
    },
    {
      label: 'Data Generation Engine',
      route: '/data-generation-engine',
      icon: '●',
      group: 'Tools'
    },
    {
      label: 'Government Dashboard',
      route: '/government-blockchain/dashboard',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Create Ministry Account',
      route: '/government-blockchain/create-ministry-account',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Create Public Administration',
      route: '/government-blockchain/create-public-administration-account',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Create Resident Account',
      route: '/government-blockchain/create-resident-account',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Resident Wallets',
      route: '/government-blockchain/resident-wallets',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Government Services',
      route: '/government-blockchain/government-services',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'New Transaction',
      route: '/government-blockchain/new-transaction',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Transaction List',
      route: '/government-blockchain/transactions',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Approval Queue',
      route: '/government-blockchain/approval-queue',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Payments / Digital Stamps',
      route: '/government-blockchain/payments-digital-stamps',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Documents & KYC',
      route: '/government-blockchain/documents-kyc',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Blockchain Proof',
      route: '/government-blockchain/blockchain-proof',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Hash Verification',
      route: '/government-blockchain/hash-verification',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Risk / Fraud Screening',
      route: '/government-blockchain/risk-fraud-screening',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'AML Dashboard',
      route: '/government-blockchain/aml/dashboard',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'AML Alerts Queue',
      route: '/government-blockchain/aml/alerts',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'AML Case Management',
      route: '/government-blockchain/aml/case-management',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Reports',
      route: '/government-blockchain/reports',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Audit Logs',
      route: '/government-blockchain/audit-logs',
      icon: '●',
      group: 'Government Blockchain Services'
    },
    {
      label: 'Settings',
      route: '/government-blockchain/settings',
      icon: '●',
      group: 'Government Blockchain Services'
    }
  ];

  constructor(private router: Router) {}

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;

    if (this.isSidebarCollapsed) {
      this.sidebarSearchText = '';
      this.governmentMenuOpen = false;
    }
  }

  toggleGovernmentMenu(): void {
    if (this.isSidebarCollapsed) {
      this.isSidebarCollapsed = false;
    }

    this.governmentMenuOpen = !this.governmentMenuOpen;

    if (this.governmentMenuOpen) {
      this.router.navigate(['/government-blockchain/dashboard']);
    }
  }

  get filteredSidebarItems(): SidebarMenuItem[] {
    const searchValue = this.sidebarSearchText.trim().toLowerCase();

    if (!searchValue || this.isSidebarCollapsed) {
      return [];
    }

    return this.menuItems.filter((item) => {
      return (
        item.label.toLowerCase().includes(searchValue) ||
        item.group.toLowerCase().includes(searchValue)
      );
    });
  }

  selectSidebarItem(item: SidebarMenuItem): void {
    this.sidebarSearchText = '';

    if (item.externalUrl) {
      window.location.href = item.externalUrl;
      return;
    }

    if (item.route) {
      this.router.navigate([item.route]);
    }
  }

  clearSidebarSearch(): void {
    this.sidebarSearchText = '';
  }
}
