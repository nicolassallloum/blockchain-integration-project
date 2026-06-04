import { Routes } from '@angular/router';
import { BlockchainKycComponent } from './pages/blockchain-kyc/blockchain-kyc.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { GovernmentBlockchainDashboardComponent } from './pages/government-blockchain/government-blockchain-dashboard/government-blockchain-dashboard.component';
import { GovernmentServicesComponent } from './pages/government-blockchain/government-services/government-services.component';
import { CouchDbExplorerComponent } from './features/government-blockchain/couchdb-explorer/couchdb-explorer.component';
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
import { CreatePublicAdministrationAccountComponent } from './pages/government-blockchain/create-public-administration-account/create-public-administration-account.component';
import { FabricTestComponent } from './features/fabric-test/fabric-test.component';
import { CreateResidentAccountComponent } from './pages/government-blockchain/create-resident-account/create-resident-account.component';
import { NewTransactionComponent } from './pages/government-blockchain/new-transaction/new-transaction.component';
import { TransactionList } from './government-blockchain/transaction-list/transaction-list';
import { ApprovalQueue } from './government-blockchain/approval-queue/approval-queue';
import { PaymentsDigitalStamps } from './government-blockchain/payments-digital-stamps/payments-digital-stamps';
import { DocumentsKyc } from './government-blockchain/documents-kyc/documents-kyc';
import { BlockchainProof } from './government-blockchain/blockchain-proof/blockchain-proof';
import { HashVerification } from './government-blockchain/hash-verification/hash-verification';
import { RiskFraudScreening } from './government-blockchain/risk-fraud-screening/risk-fraud-screening';
import { AmlDashboard } from './government-blockchain/aml-dashboard/aml-dashboard';
import { AmlAlertsQueue } from './government-blockchain/aml-alerts-queue/aml-alerts-queue';
import { AmlCaseManagement } from './government-blockchain/aml-case-management/aml-case-management';
import { Reports } from './government-blockchain/reports/reports';
import { AuditLogs } from './government-blockchain/audit-logs/audit-logs';
import { Settings } from './government-blockchain/settings/settings';
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'digital-kyc/dashboard',
    pathMatch: 'full'
  },

  /*
   * Existing Digital KYC Routes
   */
  {
    path: 'digital-kyc/blockchain-kyc',
    component: BlockchainKycComponent
  },
  {
    path: 'government-blockchain/create-public-administration-account',
    component: CreatePublicAdministrationAccountComponent
  },
  {
    path: 'government-blockchain/account-login',
    loadComponent: () =>
      import('./features/government-blockchain/account-login/account-login.component')
        .then(m => m.AccountLoginComponent)
  },
  {
    path: 'government-blockchain/couchdb-explorer',
    component: CouchDbExplorerComponent,
  },
  {
    path: 'government-blockchain/new-transaction',
    component: NewTransactionComponent
  },
  {
    path: 'government-blockchain/resident-wallets',
    loadComponent: () =>
      import('./government-blockchain/resident-wallets/resident-wallets.component')
        .then(m => m.ResidentWalletsComponent)
  },
  {
    path: 'government-blockchain/government-services',
    component: GovernmentServicesComponent,
  },
  {
    path: 'government-blockchain/create-ministry-account',
    loadComponent: () =>
      import('./pages/government-blockchain/create-ministry-account/create-ministry-account.component')
        .then((m) => m.CreateMinistryAccountComponent),
  },
  {
    path: 'digital-kyc/dashboard',
    component: DashboardComponent
  },
  {
    path: 'government-blockchain/create-resident-account',
    component: CreateResidentAccountComponent,
    title: 'Create Resident Account'
  },
  {
    path: 'government-blockchain/resident-wallet-login',
    loadComponent: () =>
      import('./pages/government-blockchain/resident-wallet-login/resident-wallet-login.component')
        .then(m => m.ResidentWalletLoginComponent),
    title: 'Resident Wallet Login'
  },

  {
    path: 'government-blockchain/transaction-list',
    component: TransactionList
  },
  {
    path: 'government-blockchain/approval-queue',
    component: ApprovalQueue
  },
  {
    path: 'government-blockchain/payments-digital-stamps',
    component: PaymentsDigitalStamps
  },
  {
    path: 'government-blockchain/documents-kyc',
    component: DocumentsKyc
  },
  {
    path: 'government-blockchain/blockchain-proof',
    component: BlockchainProof
  },
  {
    path: 'government-blockchain/hash-verification',
    component: HashVerification
  },
  {
    path: 'government-blockchain/risk-fraud-screening',
    component: RiskFraudScreening
  },
  {
    path: 'government-blockchain/aml-dashboard',
    component: AmlDashboard
  },
  {
    path: 'government-blockchain/aml-alerts-queue',
    component: AmlAlertsQueue
  },
  {
    path: 'government-blockchain/aml-case-management',
    component: AmlCaseManagement
  },
  {
    path: 'government-blockchain/reports',
    component: Reports
  },
  {
    path: 'government-blockchain/audit-logs',
    component: AuditLogs
  },
  {
    path: 'government-blockchain/settings',
    component: Settings
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
  // {
  //   path: 'government-blockchain/dashboard',
  //   component: GovernmentBlockchainDashboardComponent
  // },


   {
    path: 'government-blockchain/dashboard',
    loadComponent: () =>
      import('./pages/government-blockchain/government-blockchain-dashboard/government-blockchain-dashboard.component')
        .then(m => m.GovernmentBlockchainDashboardComponent),
  },

  {
    path: '',
    redirectTo: 'government-blockchain/dashboard',
    pathMatch: 'full',
  },

  {
    path: '**',
    redirectTo: 'government-blockchain/dashboard',
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
 
  /*
   * Blockchain Full KYC Routes
   *
   * Parent route:
   * /blockchain-full-kyc
   *
   * Child dashboard route:
   * /blockchain-full-kyc/dashboard
   */
  // {
  //   path: 'blockchain-full-kyc',
  //   children: [
  //     {
  //       path: '',
  //       redirectTo: 'dashboard',
  //       pathMatch: 'full'
  //     },
  //     {
  //       path: 'dashboard',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/full-kyc-dashboard/full-kyc-dashboard.component')
  //           .then(m => m.FullKycDashboardComponent)
  //     },
  //     {
  //       path: 'create-citizen-kyc',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/create-citizen-kyc/create-citizen-kyc.component')
  //           .then(m => m.CreateCitizenKycComponent)
  //     },
  //     {
  //       path: 'citizen-kyc-list',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/citizen-kyc-list/citizen-kyc-list.component')
  //           .then(m => m.CitizenKycListComponent)
  //     },
  //     {
  //       path: 'citizen-kyc-details',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/citizen-kyc-details/citizen-kyc-details.component')
  //           .then(m => m.CitizenKycDetailsComponent)
  //     },
  //     {
  //       path: 'document-management',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/document-management/document-management.component')
  //           .then(m => m.DocumentManagementComponent)
  //     },
  //     {
  //       path: 'review-queue',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/kyc-review-queue/kyc-review-queue.component')
  //           .then(m => m.KycReviewQueueComponent)
  //     },
  //     {
  //       path: 'approval',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/kyc-approval/kyc-approval.component')
  //           .then(m => m.KycApprovalComponent)
  //     },
  //     {
  //       path: 'duplicate-check',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/duplicate-identity-check/duplicate-identity-check.component')
  //           .then(m => m.DuplicateIdentityCheckComponent)
  //     },
  //     {
  //       path: 'risk-fraud-screening',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/risk-fraud-screening/risk-fraud-screening.component')
  //           .then(m => m.RiskFraudScreeningComponent)
  //     },
  //     {
  //       path: 'blockchain-proof',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/blockchain-proof/blockchain-proof.component')
  //           .then(m => m.BlockchainProofComponent)
  //     },
  //     {
  //       path: 'hash-verification',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/hash-verification/hash-verification.component')
  //           .then(m => m.HashVerificationComponent)
  //     },
  //     {
  //       path: 'state-institutions',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/state-institutions/state-institutions.component')
  //           .then(m => m.StateInstitutionsComponent)
  //     },
  //     {
  //       path: 'reports',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/kyc-reports/kyc-reports.component')
  //           .then(m => m.KycReportsComponent)
  //     },
  //     {
  //       path: 'audit-logs',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/kyc-audit-logs/kyc-audit-logs.component')
  //           .then(m => m.KycAuditLogsComponent)
  //     },
  //     {
  //       path: 'users-roles',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/users-roles/users-roles.component')
  //           .then(m => m.UsersRolesComponent)
  //     },
  //     {
  //       path: 'settings',
  //       loadComponent: () =>
  //         import('./pages/blockchain-full-kyc/kyc-settings/kyc-settings.component')
  //           .then(m => m.KycSettingsComponent)
  //     }
  //   ]
  // },

  /*
   * Old Shortcut Redirects
   */
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

  /*
   * Wildcard Route Must Always Stay Last
   */
  {
    path: '**',
    redirectTo: 'digital-kyc/dashboard'
  }
];