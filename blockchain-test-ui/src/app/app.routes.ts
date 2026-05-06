import { Routes } from '@angular/router';

import { WalletCreate } from './pages/wallet-create/wallet-create';
import { WalletLogin } from './pages/wallet-login/wallet-login';
import { WalletQuery } from './pages/wallet-query/wallet-query';
import { DashboardComponent } from './features/dashboard/dashboard.component';
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
  }
];