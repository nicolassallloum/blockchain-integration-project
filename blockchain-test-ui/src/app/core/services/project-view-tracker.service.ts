import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { ProjectViewApiService } from './project-view-api.service';

@Injectable({
  providedIn: 'root'
})
export class ProjectViewTrackerService {
  private router = inject(Router);
  private projectViewApi = inject(ProjectViewApiService);

  private started = false;
  private lastTrackedUrl = '';

  startTracking(): void {
    if (this.started) {
      return;
    }

    this.started = true;

    setTimeout(() => {
      this.trackCurrentPage();
    }, 300);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects || event.url;

        if (url === this.lastTrackedUrl) {
          return;
        }

        this.trackPage(url);
      });
  }

  private trackCurrentPage(): void {
    const url = window.location.pathname + window.location.search + window.location.hash;
    this.trackPage(url || '/');
  }

  private trackPage(url: string): void {
    this.lastTrackedUrl = url;

    this.projectViewApi.trackView({
      pageUrl: url,
      pageTitle: this.getPageTitle(url),
      sessionId: this.projectViewApi.getOrCreateSessionId(),
      sourceSystem: 'BLOCKCHAIN_TEST_UI',
      referrer: document.referrer || ''
    }).subscribe();
  }

  private getPageTitle(url: string): string {
    const cleanUrl = String(url || '').split('?')[0];

    const titleMap: Record<string, string> = {
      '/digital-kyc/dashboard': 'Digital KYC Dashboard',
      '/digital-kyc/wallet-create': 'Wallet Create',
      '/digital-kyc/organization-wallet-create': 'Organization Wallet Create',
      '/digital-kyc/wallet-login': 'Wallet Login',
      '/digital-kyc/wallet-query': 'Wallet Query',
      '/digital-kyc/wallet-information': 'Wallet Information',
      '/digital-kyc/fabric-test': 'Fabric Test',
      '/digital-kyc/balance-query': 'Balance Query',
      '/digital-kyc/wallet-transfer': 'Wallet Transfer',
      '/digital-kyc/organization-transfer': 'Organization Transfer',
      '/digital-kyc/transaction-history': 'Transaction History',
      '/data-generation-engine': 'Data Generation Engine'
    };

    return titleMap[cleanUrl] || 'Blockchain Test UI';
  }
}
