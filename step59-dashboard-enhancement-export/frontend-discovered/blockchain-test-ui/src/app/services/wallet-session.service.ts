import { Injectable } from '@angular/core';

export interface LoggedWalletSession {
  customerId: string;
  walletAddress: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  currentBalance: number;
  currencyCode: string;
  walletType: 'CUSTOMER' | 'ORGANIZATION';
  token?: string;
  loginTime?: string;
  sessionSource?: string;
  raw?: any;
}

@Injectable({
  providedIn: 'root'
})
export class WalletSessionService {
  private readonly mainKey = 'blockchain_logged_wallet';

  private readonly legacyKeys = [
    'walletProfile',
    'loggedInWallet',
    'loggedWallet',
    'currentWallet',
    'wallet_session',
    'digital_kyc_wallet_session',
    'digital_kyc_wallet_profile',
    'digitalKycWalletSession',
    'digitalKycWalletProfile',
    'walletSession',
    'wallet_profile',
    'wallet_token',
    'digital_kyc_wallet_token'
  ];

  setSession(walletData: any): void {
    const normalized = this.normalizeSession(walletData);

    localStorage.setItem(this.mainKey, JSON.stringify(normalized));
    sessionStorage.setItem(this.mainKey, JSON.stringify(normalized));

    if (normalized.token) {
      localStorage.setItem('digital_kyc_wallet_token', normalized.token);
      sessionStorage.setItem('digital_kyc_wallet_token', normalized.token);
    }

    window.dispatchEvent(new Event('wallet-session-changed'));
  }

  getSession(): LoggedWalletSession | null {
    const current =
      localStorage.getItem(this.mainKey) ||
      sessionStorage.getItem(this.mainKey);

    if (current) {
      try {
        return this.normalizeSession(JSON.parse(current));
      } catch {
        this.clearSession();
        return null;
      }
    }

    for (const key of this.legacyKeys) {
      const raw =
        localStorage.getItem(key) ||
        sessionStorage.getItem(key);

      if (!raw) {
        continue;
      }

      try {
        const parsed = JSON.parse(raw);
        const session = this.normalizeSession(parsed);

        if (session.walletAddress) {
          this.setSession(session);
          return session;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  isLoggedIn(): boolean {
    return !!this.getSession()?.walletAddress;
  }

  clearSession(): void {
    localStorage.removeItem(this.mainKey);
    sessionStorage.removeItem(this.mainKey);

    this.legacyKeys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    localStorage.removeItem('digital_kyc_wallet_token');
    sessionStorage.removeItem('digital_kyc_wallet_token');

    window.dispatchEvent(new Event('wallet-session-changed'));
  }

  updateBalance(newBalance: number): void {
    const session = this.getSession();

    if (!session) {
      return;
    }

    session.currentBalance = Number(newBalance || 0);
    this.setSession(session);
  }

  isCustomerWallet(): boolean {
    return this.getSession()?.walletType === 'CUSTOMER';
  }

  isOrganizationWallet(): boolean {
    return this.getSession()?.walletType === 'ORGANIZATION';
  }

  getToken(): string {
    return (
      this.getSession()?.token ||
      localStorage.getItem('digital_kyc_wallet_token') ||
      sessionStorage.getItem('digital_kyc_wallet_token') ||
      ''
    );
  }

  private normalizeSession(input: any): LoggedWalletSession {
    const wallet =
      input?.data?.wallet ||
      input?.data?.profile ||
      input?.data?.walletProfile ||
      input?.wallet ||
      input?.profile ||
      input?.walletProfile ||
      input?.data ||
      input ||
      {};

    const walletAddress = String(
      wallet?.walletAddress ||
      wallet?.wallet_address ||
      input?.walletAddress ||
      input?.wallet_address ||
      ''
    ).trim();

    const customerId = String(
      wallet?.customerId ||
      wallet?.customer_id ||
      input?.customerId ||
      input?.customer_id ||
      ''
    ).trim();

    const organizationId = String(
      wallet?.organizationId ||
      wallet?.organization_id ||
      input?.organizationId ||
      input?.organization_id ||
      ''
    ).trim();

    const organizationName = String(
      wallet?.organizationName ||
      wallet?.organization_name ||
      input?.organizationName ||
      input?.organization_name ||
      ''
    ).trim();

    const rawWalletType = String(
      wallet?.walletType ||
      wallet?.wallet_type ||
      wallet?.customerType ||
      wallet?.customer_type ||
      wallet?.type ||
      input?.walletType ||
      input?.wallet_type ||
      input?.customerType ||
      input?.customer_type ||
      input?.type ||
      ''
    )
      .trim()
      .toUpperCase();

    const inferredWalletType = this.normalizeWalletType(
      rawWalletType,
      customerId,
      organizationId
    );

    return {
      customerId,
      walletAddress,
      organizationId,
      organizationName,

      fullName:
        wallet?.fullName ||
        wallet?.full_name ||
        wallet?.customerName ||
        wallet?.customer_name ||
        input?.fullName ||
        input?.full_name ||
        input?.customerName ||
        input?.customer_name ||
        '',

      currentBalance: Number(
        wallet?.currentBalance ??
          wallet?.current_balance ??
          wallet?.balance ??
          input?.currentBalance ??
          input?.current_balance ??
          input?.balance ??
          0
      ),

      currencyCode:
        wallet?.currencyCode ||
        wallet?.currency_code ||
        wallet?.currency ||
        input?.currencyCode ||
        input?.currency_code ||
        input?.currency ||
        'USD',

      walletType: inferredWalletType,

      token:
        input?.token ||
        input?.data?.token ||
        wallet?.token ||
        localStorage.getItem('digital_kyc_wallet_token') ||
        sessionStorage.getItem('digital_kyc_wallet_token') ||
        '',

      loginTime: input?.loginTime || new Date().toISOString(),
      sessionSource: this.mainKey,
      raw: input
    };
  }

  private normalizeWalletType(
    rawWalletType: string,
    customerId: string,
    organizationId: string
  ): 'CUSTOMER' | 'ORGANIZATION' {
    /*
     * New wallet address format:
     * fe43dce35bdf18108fa5b0b9788858df518c36ff
     *
     * Therefore wallet type must NOT be inferred from wallet address prefix.
     */

    if (
      rawWalletType === 'ORG' ||
      rawWalletType === 'ORGANIZATION' ||
      rawWalletType === 'ORGANIZATION_WALLET'
    ) {
      return 'ORGANIZATION';
    }

    if (
      rawWalletType === 'CUSTOMER' ||
      rawWalletType === 'CUSTOMER_WALLET'
    ) {
      return 'CUSTOMER';
    }

    if (
      customerId.toUpperCase().startsWith('ORG_') ||
      organizationId.toUpperCase().startsWith('ORG_')
    ) {
      return 'ORGANIZATION';
    }

    return 'CUSTOMER';
  }
}