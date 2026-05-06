import { Routes } from '@angular/router';

import { WalletCreate } from './pages/wallet-create/wallet-create';
import { WalletLogin } from './pages/wallet-login/wallet-login';
import { WalletQuery } from './pages/wallet-query/wallet-query';
import { DashboardComponent } from './features/dashboard/dashboard.component';


import { WalletTransferComponent } from './features/transactions/wallet-transfer/wallet-transfer.component';
import { OrganizationTransferComponent } from './features/transactions/organization-transfer/organization-transfer.component';
import { BalanceQueryComponent } from './features/transactions/balance-query/balance-query.component';
import { TransactionHistoryComponent } from './features/transactions/transaction-history/transaction-history.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    component: DashboardComponent
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'wallet-create',
    component: WalletCreate
  },
  {
    path: 'wallet-login',
    component: WalletLogin
  },
  {
    path: 'wallet-query',
    component: WalletQuery
  },
  {
    path: '**',
    redirectTo: 'dashboard'
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
    path: 'digital-kyc/balance-query',
    component: BalanceQueryComponent
  },
  {
    path: 'digital-kyc/transaction-history',
    component: TransactionHistoryComponent
  }
];