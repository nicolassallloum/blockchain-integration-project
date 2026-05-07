import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface WalletSession {
  customerId: string;
  walletAddress: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  currentBalance: number;
  currencyCode: string;
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class WalletSessionService {
  private readonly SESSION_KEY = 'digital_kyc_wallet_session';

  private sessionSubject = new BehaviorSubject<WalletSession | null>(this.getSession());

  sessionChanges$ = this.sessionSubject.asObservable();

  setSession(walletProfile: any): void {
    if (!walletProfile) {
      return;
    }

    const normalizedSession: WalletSession = {
      customerId: walletProfile.customerId || walletProfile.customer_id || '',
      walletAddress: walletProfile.walletAddress || walletProfile.wallet_address || '',
      organizationId: walletProfile.organizationId || walletProfile.organization_id || '',
      organizationName: walletProfile.organizationName || walletProfile.organization_name || '',
      fullName:
        walletProfile.fullName ||
        walletProfile.full_name ||
        walletProfile.customerName ||
        walletProfile.customer_name ||
        '',
      currentBalance: Number(
        walletProfile.currentBalance ??
          walletProfile.current_balance ??
          walletProfile.balance ??
          0
      ),
      currencyCode:
        walletProfile.currencyCode ||
        walletProfile.currency_code ||
        walletProfile.currency ||
        'USD',
      token: walletProfile.token || ''
    };

    localStorage.setItem(this.SESSION_KEY, JSON.stringify(normalizedSession));

    if (normalizedSession.token) {
      localStorage.setItem('digital_kyc_wallet_token', normalizedSession.token);
    }

    localStorage.setItem('digital_kyc_wallet_profile', JSON.stringify(normalizedSession));

    this.sessionSubject.next(normalizedSession);
  }

  getSession(): WalletSession | null {
    const rawSession = localStorage.getItem(this.SESSION_KEY);

    if (!rawSession) {
      return null;
    }

    try {
      return JSON.parse(rawSession);
    } catch (error) {
      console.error('Invalid wallet session found in localStorage:', error);
      this.clearSession();
      return null;
    }
  }

  getWalletAddress(): string {
    return this.getSession()?.walletAddress || '';
  }

  getCustomerId(): string {
    return this.getSession()?.customerId || '';
  }

  getOrganizationId(): string {
    return this.getSession()?.organizationId || '';
  }

  getToken(): string {
    return this.getSession()?.token || localStorage.getItem('digital_kyc_wallet_token') || '';
  }

  clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem('digital_kyc_wallet_token');
    localStorage.removeItem('digital_kyc_wallet_profile');
    sessionStorage.removeItem(this.SESSION_KEY);

    this.sessionSubject.next(null);
  }

  isLoggedIn(): boolean {
    const session = this.getSession();
    return !!session?.customerId && !!session?.walletAddress;
  }
}