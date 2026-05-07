import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WalletSessionService {
  private readonly SESSION_KEY = 'digital_kyc_wallet_session';

  setSession(walletProfile: any): void {
    if (!walletProfile) {
      return;
    }

    const normalizedSession = {
      customerId: walletProfile.customerId || '',
      walletAddress: walletProfile.walletAddress || '',
      organizationId: walletProfile.organizationId || '',
      organizationName: walletProfile.organizationName || '',
      fullName: walletProfile.fullName || '',
      currentBalance: walletProfile.currentBalance ?? 0,
      currencyCode: walletProfile.currencyCode || walletProfile.currency || 'USD',
      token: walletProfile.token || ''
    };

    localStorage.setItem(this.SESSION_KEY, JSON.stringify(normalizedSession));
  }

  getSession(): any | null {
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

  clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY);
  }

  isLoggedIn(): boolean {
    const session = this.getSession();
    return !!session?.customerId && !!session?.walletAddress;
  }
}