import { Routes } from '@angular/router';

import { WalletCreate } from './pages/wallet-create/wallet-create';
import { WalletLoginComponent } from './pages/wallet-login/wallet-login.component';
import { WalletQueryComponent } from './pages/wallet-query/wallet-query.component';

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
    component: WalletLoginComponent
  },
  {
    path: 'wallet-query',
    component: WalletQueryComponent
  },
  {
    path: '**',
    redirectTo: 'wallet-create'
  }
];