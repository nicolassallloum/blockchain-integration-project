import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { WalletCreateComponent } from './features/wallet-create/wallet-create.component';
import { WalletLoginComponent } from './features/wallet-login/wallet-login.component';
import { WalletQueryComponent } from './features/wallet-query/wallet-query.component';
import { WalletTransferComponent } from './features/wallet-transfer/wallet-transfer.component';
import { OrganizationTransferComponent } from './features/organization-transfer/organization-transfer.component';
import { TransactionHistoryComponent } from './features/transaction-history/transaction-history.component';
import { FabricTestComponent } from './features/fabric-test/fabric-test.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'wallet-create', component: WalletCreateComponent },
  { path: 'wallet-login', component: WalletLoginComponent },
  { path: 'wallet-query', component: WalletQueryComponent },
  { path: 'wallet-transfer', component: WalletTransferComponent },
  { path: 'organization-transfer', component: OrganizationTransferComponent },
  { path: 'transaction-history', component: TransactionHistoryComponent },
  { path: 'fabric-test', component: FabricTestComponent },
  { path: '**', redirectTo: 'dashboard' }
];