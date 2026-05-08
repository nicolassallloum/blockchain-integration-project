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
  walletType: string;
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
      token: walletProfile.token || '',
      walletType: String(
        walletProfile.walletType ||
          walletProfile.wallet_type ||
          walletProfile.customerType ||
          walletProfile.customer_type ||
          'CUSTOMER'
      ).toUpperCase()
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

  getWalletType(): string {
    return this.getSession()?.walletType || 'CUSTOMER';
  }

  isCustomerWallet(): boolean {
    return this.getWalletType() === 'CUSTOMER';
  }

  isOrganizationWallet(): boolean {
    return this.getWalletType() === 'ORGANIZATION';
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
    return !!session?.walletAddress;
  }

  updateBalance(newBalance: number): void {
    const session = this.getSession();

    if (!session) {
      return;
    }

    const updatedSession: WalletSession = {
      ...session,
      currentBalance: Number(newBalance)
    };

    localStorage.setItem(this.SESSION_KEY, JSON.stringify(updatedSession));
    localStorage.setItem('digital_kyc_wallet_profile', JSON.stringify(updatedSession));

    this.sessionSubject.next(updatedSession);
  }
  private normalizeSessionWallet(wallet: any): any {
    if (!wallet) {
      return wallet;
    }

    const walletAddress = String(
      wallet.walletAddress ||
      wallet.wallet_address ||
      ''
    );

    const customerId = String(
      wallet.customerId ||
      wallet.customer_id ||
      ''
    );

    const rawWalletType = String(
      wallet.walletType ||
      wallet.wallet_type ||
      wallet.type ||
      ''
    ).trim().toUpperCase();

    let walletType = rawWalletType;

    if (
      rawWalletType === 'ORG' ||
      rawWalletType === 'ORGANIZATION' ||
      walletAddress.toUpperCase().startsWith('ORG_WALLET_') ||
      customerId.toUpperCase().startsWith('ORG_')
    ) {
      walletType = 'ORGANIZATION';
    } else {
      walletType = 'CUSTOMER';
    }

    return {
      ...wallet,
      walletAddress,
      wallet_address: walletAddress,
      customerId,
      customer_id: customerId,
      walletType,
      wallet_type: walletType
    };
  }

}
