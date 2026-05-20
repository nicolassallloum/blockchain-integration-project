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

  fullKycMenuOpen = true;

  menuItems: SidebarMenuItem[] = [
    {
      label: 'Back',
      externalUrl: 'https://vfds.dev.hq.com/dashboard',
      icon: '↩',
      group: 'Navigation'
    },

    /*
     * Existing Digital KYC Menus
     */
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

    /*
     * New Blockchain Full KYC Menus
     */
    {
      label: 'Full KYC Dashboard',
      route: '/blockchain-full-kyc/dashboard',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Create Citizen KYC',
      route: '/blockchain-full-kyc/create-citizen-kyc',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Citizen KYC List',
      route: '/blockchain-full-kyc/citizen-kyc-list',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Citizen KYC Details',
      route: '/blockchain-full-kyc/citizen-kyc-details',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Document Management',
      route: '/blockchain-full-kyc/document-management',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'KYC Review Queue',
      route: '/blockchain-full-kyc/review-queue',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'KYC Approval',
      route: '/blockchain-full-kyc/approval',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Duplicate Identity Check',
      route: '/blockchain-full-kyc/duplicate-check',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Risk / Fraud Screening',
      route: '/blockchain-full-kyc/risk-fraud-screening',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Blockchain Proof',
      route: '/blockchain-full-kyc/blockchain-proof',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Hash Verification',
      route: '/blockchain-full-kyc/hash-verification',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'State Institutions',
      route: '/blockchain-full-kyc/state-institutions',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Reports',
      route: '/blockchain-full-kyc/reports',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Audit Logs',
      route: '/blockchain-full-kyc/audit-logs',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Users & Roles',
      route: '/blockchain-full-kyc/users-roles',
      icon: '●',
      group: 'Blockchain Full KYC'
    },
    {
      label: 'Settings / Reference Data',
      route: '/blockchain-full-kyc/settings',
      icon: '●',
      group: 'Blockchain Full KYC'
    }
  ];

  constructor(private router: Router) {}

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;

    if (this.isSidebarCollapsed) {
      this.sidebarSearchText = '';
      this.fullKycMenuOpen = false;
    } else {
      this.fullKycMenuOpen = true;
    }
  }

  toggleFullKycMenu(): void {
    if (this.isSidebarCollapsed) {
      this.isSidebarCollapsed = false;
    }

    this.fullKycMenuOpen = !this.fullKycMenuOpen;
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