import { Routes } from '@angular/router';

import { WalletCreate } from './pages/wallet-create/wallet-create';
import { WalletLogin } from './pages/wallet-login/wallet-login';
import { WalletQuery } from './pages/wallet-query/wallet-query';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'wallet-create',
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
    redirectTo: 'wallet-create'
  }
];