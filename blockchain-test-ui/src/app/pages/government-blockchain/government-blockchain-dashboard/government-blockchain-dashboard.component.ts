import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface GovernmentKpiCard {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  trend?: string;
  status?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

interface SimpleChartItem {
  label: string;
  value: number;
  displayValue: string;
  status?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

interface BlockchainHealthItem {
  label: string;
  value: string;
  status: 'ONLINE' | 'OFFLINE' | 'WARNING' | 'ACTIVE' | 'COMMITTED';
  description: string;
}

interface RecentGovernmentTransaction {
  transactionId: string;
  residentName: string;
  ministry: string;
  service: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW';
  amount: string;
  blockchainStatus: 'CONFIRMED' | 'SUBMITTED' | 'PENDING' | 'FAILED';
  createdAt: string;
}

@Component({
  selector: 'app-government-blockchain-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './government-blockchain-dashboard.component.html',
  styleUrl: './government-blockchain-dashboard.component.scss'
})
export class GovernmentBlockchainDashboardComponent {
  readonly pageTitle = 'Government Blockchain Dashboard';
  readonly pageSubtitle =
    'Unified overview for residents, ministries, public administrations, wallets, transactions, payments, digital stamps, and blockchain verification.';

  readonly channelName = 'kycchannelnix1';
  readonly lastUpdated = 'Today, 12:45 PM';

  kpiCards: GovernmentKpiCard[] = [
    {
      title: 'Total Residents',
      value: '1,245,820',
      subtitle: 'Registered resident accounts',
      icon: '👥',
      trend: '+12,450 this month',
      status: 'primary'
    },
    {
      title: 'Total Ministries',
      value: '24',
      subtitle: 'Connected ministries',
      icon: '🏛️',
      trend: '100% active',
      status: 'success'
    },
    {
      title: 'Total Public Administrations',
      value: '138',
      subtitle: 'Public entities onboarded',
      icon: '🏢',
      trend: '+8 this quarter',
      status: 'info'
    },
    {
      title: 'Total Wallets',
      value: '1,509,340',
      subtitle: 'Government blockchain wallets',
      icon: '💼',
      trend: '+35,200 this month',
      status: 'primary'
    },
    {
      title: 'Active Wallets',
      value: '1,421,775',
      subtitle: 'Wallets with active status',
      icon: '✅',
      trend: '94.2% active rate',
      status: 'success'
    },
    {
      title: 'Total Government Transactions',
      value: '2,548,900',
      subtitle: 'All government service requests',
      icon: '🔁',
      trend: '+76,400 this week',
      status: 'primary'
    },
    {
      title: 'Pending Transactions',
      value: '18,420',
      subtitle: 'Waiting for review or approval',
      icon: '⏳',
      trend: '-4.5% from yesterday',
      status: 'warning'
    },
    {
      title: 'Approved Transactions',
      value: '2,382,610',
      subtitle: 'Successfully approved services',
      icon: '🟢',
      trend: '93.5% approval rate',
      status: 'success'
    },
    {
      title: 'Rejected Transactions',
      value: '41,890',
      subtitle: 'Rejected or invalid requests',
      icon: '🔴',
      trend: '1.6% rejection rate',
      status: 'danger'
    },
    {
      title: 'Total Payments',
      value: '$48.7M',
      subtitle: 'Government payments processed',
      icon: '💳',
      trend: '+$2.4M this week',
      status: 'success'
    },
    {
      title: 'Total Digital Stamps',
      value: '784,210',
      subtitle: 'Digital stamps issued',
      icon: '🏷️',
      trend: '+9,850 today',
      status: 'info'
    },
    {
      title: 'Blockchain Proof Records',
      value: '2,506,740',
      subtitle: 'Confirmed proof records',
      icon: '⛓️',
      trend: '98.3% confirmed',
      status: 'primary'
    },
    {
      title: 'Fraud Alerts',
      value: '126',
      subtitle: 'Suspicious activity alerts',
      icon: '🚨',
      trend: '18 high priority',
      status: 'danger'
    },
    {
      title: 'Duplicate Identity Alerts',
      value: '342',
      subtitle: 'Possible duplicate identities',
      icon: '🧬',
      trend: '57 under review',
      status: 'warning'
    },
    {
      title: 'Today Transactions',
      value: '14,870',
      subtitle: 'Transactions submitted today',
      icon: '📅',
      trend: '+11.8% vs yesterday',
      status: 'primary'
    },
    {
      title: 'Today Payments',
      value: '$920K',
      subtitle: 'Payments processed today',
      icon: '💰',
      trend: '+$145K vs yesterday',
      status: 'success'
    }
  ];

  transactionStatusChart: SimpleChartItem[] = [
    { label: 'Approved', value: 72, displayValue: '72%', status: 'success' },
    { label: 'Pending', value: 14, displayValue: '14%', status: 'warning' },
    { label: 'Under Review', value: 9, displayValue: '9%', status: 'info' },
    { label: 'Rejected', value: 5, displayValue: '5%', status: 'danger' }
  ];

  transactionsByMinistryChart: SimpleChartItem[] = [
    { label: 'Ministry of Finance', value: 86, displayValue: '645K', status: 'primary' },
    { label: 'Ministry of Interior', value: 74, displayValue: '552K', status: 'success' },
    { label: 'Ministry of Health', value: 61, displayValue: '456K', status: 'info' },
    { label: 'Ministry of Justice', value: 48, displayValue: '358K', status: 'warning' },
    { label: 'Ministry of Labor', value: 36, displayValue: '269K', status: 'danger' }
  ];

  dailyTransactionVolumeChart: SimpleChartItem[] = [
    { label: 'Mon', value: 42, displayValue: '8.4K' },
    { label: 'Tue', value: 58, displayValue: '11.6K' },
    { label: 'Wed', value: 64, displayValue: '12.8K' },
    { label: 'Thu', value: 76, displayValue: '15.2K' },
    { label: 'Fri', value: 69, displayValue: '13.8K' },
    { label: 'Sat', value: 44, displayValue: '8.8K' },
    { label: 'Sun', value: 38, displayValue: '7.6K' }
  ];

  walletGrowthChart: SimpleChartItem[] = [
    { label: 'Jan', value: 35, displayValue: '920K' },
    { label: 'Feb', value: 42, displayValue: '1.01M' },
    { label: 'Mar', value: 51, displayValue: '1.13M' },
    { label: 'Apr', value: 63, displayValue: '1.27M' },
    { label: 'May', value: 78, displayValue: '1.50M' }
  ];

  digitalStampUsageChart: SimpleChartItem[] = [
    { label: 'Passport', value: 78, displayValue: '214K', status: 'primary' },
    { label: 'Civil Registry', value: 66, displayValue: '181K', status: 'success' },
    { label: 'Tax Certificate', value: 54, displayValue: '148K', status: 'info' },
    { label: 'Business License', value: 44, displayValue: '120K', status: 'warning' },
    { label: 'Court Document', value: 31, displayValue: '85K', status: 'danger' }
  ];

  blockchainSubmissionStatusChart: SimpleChartItem[] = [
    { label: 'Confirmed', value: 84, displayValue: '84%', status: 'success' },
    { label: 'Submitted', value: 10, displayValue: '10%', status: 'primary' },
    { label: 'Pending', value: 5, displayValue: '5%', status: 'warning' },
    { label: 'Failed', value: 1, displayValue: '1%', status: 'danger' }
  ];

  blockchainHealth: BlockchainHealthItem[] = [
    {
      label: 'Fabric Peer Status',
      value: 'Online',
      status: 'ONLINE',
      description: 'Org peers are reachable and responding'
    },
    {
      label: 'Orderer Status',
      value: 'Online',
      status: 'ONLINE',
      description: 'Ordering service is active'
    },
    {
      label: 'CouchDB Status',
      value: 'Online',
      status: 'ONLINE',
      description: 'World state database is available'
    },
    {
      label: 'PostgreSQL Status',
      value: 'Online',
      status: 'ONLINE',
      description: 'Off-chain database is connected'
    },
    {
      label: 'Chaincode Status',
      value: 'Committed',
      status: 'COMMITTED',
      description: 'Government service chaincode is committed'
    },
    {
      label: 'Channel Name',
      value: this.channelName,
      status: 'ACTIVE',
      description: 'Active Hyperledger Fabric channel'
    },
    {
      label: 'Last Block Number',
      value: '128,742',
      status: 'ACTIVE',
      description: 'Latest confirmed ledger block'
    }
  ];

  recentTransactions: RecentGovernmentTransaction[] = [
    {
      transactionId: 'GOV-TXN-2026-000001',
      residentName: 'Nicolas Salloum',
      ministry: 'Ministry of Finance',
      service: 'Tax Clearance Certificate',
      status: 'APPROVED',
      amount: '$25.00',
      blockchainStatus: 'CONFIRMED',
      createdAt: '2026-05-20 12:41'
    },
    {
      transactionId: 'GOV-TXN-2026-000002',
      residentName: 'Maya Haddad',
      ministry: 'Ministry of Interior',
      service: 'Civil Registry Extract',
      status: 'PENDING',
      amount: '$10.00',
      blockchainStatus: 'SUBMITTED',
      createdAt: '2026-05-20 12:34'
    },
    {
      transactionId: 'GOV-TXN-2026-000003',
      residentName: 'Karim Mansour',
      ministry: 'Ministry of Health',
      service: 'Medical License Renewal',
      status: 'UNDER_REVIEW',
      amount: '$45.00',
      blockchainStatus: 'PENDING',
      createdAt: '2026-05-20 12:18'
    },
    {
      transactionId: 'GOV-TXN-2026-000004',
      residentName: 'Rana Khoury',
      ministry: 'Ministry of Justice',
      service: 'Criminal Record Certificate',
      status: 'APPROVED',
      amount: '$18.00',
      blockchainStatus: 'CONFIRMED',
      createdAt: '2026-05-20 12:02'
    },
    {
      transactionId: 'GOV-TXN-2026-000005',
      residentName: 'Joseph Abi Raad',
      ministry: 'Ministry of Labor',
      service: 'Work Permit Request',
      status: 'REJECTED',
      amount: '$30.00',
      blockchainStatus: 'FAILED',
      createdAt: '2026-05-20 11:48'
    }
  ];

  getStatusClass(status: string): string {
    return status.toLowerCase().replace('_', '-');
  }

  trackByTitle(index: number, item: GovernmentKpiCard): string {
    return item.title;
  }

  trackByLabel(index: number, item: SimpleChartItem | BlockchainHealthItem): string {
    return item.label;
  }

  trackByTransactionId(index: number, item: RecentGovernmentTransaction): string {
    return item.transactionId;
  }
}