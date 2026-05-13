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

  menuItems: SidebarMenuItem[] = [
    {
      label: 'Back',
      externalUrl: 'https://vfds.dev.hq.com/kyc',
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
    }
  ];

  constructor(private router: Router) {}

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;

    if (this.isSidebarCollapsed) {
      this.sidebarSearchText = '';
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