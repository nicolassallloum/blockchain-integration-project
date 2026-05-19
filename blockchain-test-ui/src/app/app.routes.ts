import { Routes } from '@angular/router';
import { BlockchainKycComponent } from './pages/blockchain-kyc/blockchain-kyc.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';

import { WalletCreate } from './pages/wallet-create/wallet-create';
import { OrganizationWalletCreate } from './pages/organization-wallet-create/organization-wallet-create';
import { WalletLogin } from './pages/wallet-login/wallet-login';
import { WalletQuery } from './pages/wallet-query/wallet-query';
import { WalletInformationComponent } from './pages/wallet-information/wallet-information.component';
import { DataGenerationEngine } from './pages/data-generation-engine/data-generation-engine';
import { WalletTransferComponent } from './features/transactions/wallet-transfer/wallet-transfer.component';
import { OrganizationTransferComponent } from './features/transactions/organization-transfer/organization-transfer.component';
import { TransactionHistoryComponent } from './features/transactions/transaction-history/transaction-history.component';
import { BalanceQueryComponent } from './features/transactions/balance-query/balance-query.component';

import { FabricTestComponent } from './features/fabric-test/fabric-test.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'digital-kyc/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'digital-kyc/blockchain-kyc',
    component: BlockchainKycComponent
  },
  {
    path: 'digital-kyc/dashboard',
    component: DashboardComponent
  },
  {
    path: 'digital-kyc/wallet-create',
    component: WalletCreate
  },
  {
    path: 'digital-kyc/organization-wallet-create',
    component: OrganizationWalletCreate
  },
  {
    path: 'digital-kyc/wallet-login',
    component: WalletLogin
  },
  {
    path: 'digital-kyc/wallet-query',
    component: WalletQuery
  },
  {
    path: 'digital-kyc/wallet-information',
    component: WalletInformationComponent
  },
  {
    path: 'data-generation-engine',
    component: DataGenerationEngine
  },
  {
    path: 'digital-kyc/balance-query',
    component: BalanceQueryComponent
  },
  {
    path: 'digital-kyc/wallet-transfer',
    component: WalletTransferComponent
  },
  {
    path: 'digital-kyc/organization-transfer',
    component: OrganizationTransferComponent
  },
  {
    path: 'digital-kyc/transaction-history',
    component: TransactionHistoryComponent
  },
  {
    path: 'digital-kyc/fabric-test',
    component: FabricTestComponent
  },

  {
    path: 'dashboard',
    redirectTo: 'digital-kyc/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'wallet-create',
    redirectTo: 'digital-kyc/wallet-create',
    pathMatch: 'full'
  },
  {
    path: 'organization-wallet-create',
    redirectTo: 'digital-kyc/organization-wallet-create',
    pathMatch: 'full'
  },
  {
    path: 'wallet-login',
    redirectTo: 'digital-kyc/wallet-login',
    pathMatch: 'full'
  },
  {
    path: 'wallet-query',
    redirectTo: 'digital-kyc/wallet-query',
    pathMatch: 'full'
  },
  {
    path: 'wallet-information',
    redirectTo: 'digital-kyc/wallet-information',
    pathMatch: 'full'
  },
  {
    path: 'balance-query',
    redirectTo: 'digital-kyc/balance-query',
    pathMatch: 'full'
  },
  {
    path: 'wallet-transfer',
    redirectTo: 'digital-kyc/wallet-transfer',
    pathMatch: 'full'
  },
  {
    path: 'organization-transfer',
    redirectTo: 'digital-kyc/organization-transfer',
    pathMatch: 'full'
  },
  {
    path: 'transaction-history',
    redirectTo: 'digital-kyc/transaction-history',
    pathMatch: 'full'
  },
  {
    path: 'fabric-test',
    redirectTo: 'digital-kyc/fabric-test',
    pathMatch: 'full'
  },

  {
    path: '**',
    redirectTo: 'digital-kyc/dashboard'
  }
];