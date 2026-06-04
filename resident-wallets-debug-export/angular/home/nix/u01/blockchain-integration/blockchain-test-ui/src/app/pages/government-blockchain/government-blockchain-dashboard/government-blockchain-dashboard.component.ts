import { CommonModule, DecimalPipe, NgClass } from '@angular/common';
import { Component } from '@angular/core';

type KpiTone =
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'purple'
  | 'cyan'
  | 'dark';

type TransactionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'UNDER_REVIEW';

type BlockchainStatus =
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'PENDING';

type HealthStatus =
  | 'ONLINE'
  | 'HEALTHY'
  | 'WARNING'
  | 'OFFLINE';

interface DashboardKpi {
  title: string;
  value: number;
  suffix?: string;
  subtitle: string;
  icon: string;
  tone: KpiTone;
  trend?: string;
}

interface SimpleChartItem {
  label: string;
  value: number;
  tone?: KpiTone;
}

interface TimelineChartItem {
  label: string;
  value: number;
}

interface HealthItem {
  title: string;
  value: string;
  status: HealthStatus;
  description: string;
}

interface RecentTransaction {
  transactionId: string;
  residentName: string;
  ministry: string;
  service: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  blockchainStatus: BlockchainStatus;
  createdAt: string;
}

@Component({
  selector: 'app-government-blockchain-dashboard',
  standalone: true,
  imports: [CommonModule, NgClass, DecimalPipe],
  templateUrl: './government-blockchain-dashboard.component.html',
  styleUrl: './government-blockchain-dashboard.component.scss',
})
export class GovernmentBlockchainDashboardComponent {
  readonly pageTitle = 'Government Blockchain Dashboard';
  readonly pageSubtitle =
    'Full operational overview of residents, ministries, wallets, transactions, blockchain proof, payments, digital stamps, AML alerts, fraud alerts, and system health.';

  readonly lastUpdated = new Date();

  readonly kpis: DashboardKpi[] = [
    {
      title: 'Total Residents',
      value: 1254800,
      subtitle: 'Registered resident accounts',
      icon: '👥',
      tone: 'blue',
      trend: '+4.8%',
    },
    {
      title: 'Total Ministries',
      value: 24,
      subtitle: 'Central ministries onboarded',
      icon: '🏛️',
      tone: 'purple',
      trend: '+2',
    },
    {
      title: 'Public Administrations',
      value: 186,
      subtitle: 'Connected public entities',
      icon: '🏢',
      tone: 'cyan',
      trend: '+11',
    },
    {
      title: 'Total Wallets',
      value: 1530000,
      subtitle: 'Blockchain wallets created',
      icon: '👛',
      tone: 'green',
      trend: '+6.2%',
    },
    {
      title: 'Active Wallets',
      value: 1428700,
      subtitle: 'Wallets active in last 30 days',
      icon: '✅',
      tone: 'green',
      trend: '+3.9%',
    },
    {
      title: 'Total Transactions',
      value: 2500000,
      subtitle: 'Government blockchain transactions',
      icon: '🔁',
      tone: 'blue',
      trend: '+8.1%',
    },
    {
      title: 'Pending Transactions',
      value: 18420,
      subtitle: 'Waiting for review or approval',
      icon: '⏳',
      tone: 'orange',
      trend: '-1.4%',
    },
    {
      title: 'Approved Transactions',
      value: 2316400,
      subtitle: 'Validated government transactions',
      icon: '✔️',
      tone: 'green',
      trend: '+7.7%',
    },
    {
      title: 'Rejected Transactions',
      value: 27480,
      subtitle: 'Rejected or invalid requests',
      icon: '❌',
      tone: 'red',
      trend: '+0.8%',
    },
    {
      title: 'Total Payments',
      value: 428500000,
      suffix: ' LBP',
      subtitle: 'Collected through digital services',
      icon: '💳',
      tone: 'purple',
      trend: '+12.3%',
    },
    {
      title: 'Digital Stamp Transactions',
      value: 864200,
      subtitle: 'Digital stamp usage records',
      icon: '🎫',
      tone: 'cyan',
      trend: '+5.6%',
    },
    {
      title: 'Blockchain Proof Records',
      value: 2491200,
      subtitle: 'Hash proof records stored',
      icon: '⛓️',
      tone: 'dark',
      trend: '+8.0%',
    },
    {
      title: 'Fraud Alerts',
      value: 312,
      subtitle: 'Suspicious fraud indicators',
      icon: '🚨',
      tone: 'red',
      trend: '-3.2%',
    },
    {
      title: 'AML Alerts',
      value: 146,
      subtitle: 'AML screening alerts',
      icon: '🛡️',
      tone: 'orange',
      trend: '+1.1%',
    },
    {
      title: 'Today Transactions',
      value: 12840,
      subtitle: 'Transactions created today',
      icon: '📅',
      tone: 'blue',
      trend: '+2.4%',
    },
    {
      title: 'Today Payments',
      value: 18650000,
      suffix: ' LBP',
      subtitle: 'Payments collected today',
      icon: '💰',
      tone: 'green',
      trend: '+9.5%',
    },
  ];

  readonly transactionsByStatus: SimpleChartItem[] = [
    { label: 'Approved', value: 72, tone: 'green' },
    { label: 'Pending', value: 14, tone: 'orange' },
    { label: 'Rejected', value: 6, tone: 'red' },
    { label: 'Under Review', value: 8, tone: 'purple' },
  ];

  readonly transactionsByMinistry: SimpleChartItem[] = [
    { label: 'Interior', value: 34, tone: 'blue' },
    { label: 'Finance', value: 27, tone: 'green' },
    { label: 'Justice', value: 18, tone: 'purple' },
    { label: 'Health', value: 13, tone: 'cyan' },
    { label: 'Transport', value: 8, tone: 'orange' },
  ];

  readonly walletGrowth: TimelineChartItem[] = [
    { label: 'Jan', value: 42 },
    { label: 'Feb', value: 58 },
    { label: 'Mar', value: 77 },
    { label: 'Apr', value: 92 },
    { label: 'May', value: 118 },
    { label: 'Jun', value: 146 },
  ];

  readonly blockchainSubmissionStatus: SimpleChartItem[] = [
    { label: 'Confirmed', value: 82, tone: 'green' },
    { label: 'Submitted', value: 11, tone: 'blue' },
    { label: 'Pending', value: 5, tone: 'orange' },
    { label: 'Failed', value: 2, tone: 'red' },
  ];

  readonly paymentsTimeline: TimelineChartItem[] = [
    { label: 'Mon', value: 18 },
    { label: 'Tue', value: 24 },
    { label: 'Wed', value: 21 },
    { label: 'Thu', value: 32 },
    { label: 'Fri', value: 29 },
    { label: 'Sat', value: 15 },
    { label: 'Sun', value: 12 },
  ];

  readonly amlAlertsDistribution: SimpleChartItem[] = [
    { label: 'Low Risk', value: 46, tone: 'green' },
    { label: 'Medium Risk', value: 34, tone: 'orange' },
    { label: 'High Risk', value: 14, tone: 'red' },
    { label: 'Critical', value: 6, tone: 'dark' },
  ];

  readonly blockchainHealth: HealthItem[] = [
    {
      title: 'Peer Status',
      value: 'ONLINE',
      status: 'ONLINE',
      description: 'Org1 and Org2 peers are reachable',
    },
    {
      title: 'Orderer Status',
      value: 'HEALTHY',
      status: 'HEALTHY',
      description: 'Ordering service is processing blocks',
    },
    {
      title: 'CouchDB Status',
      value: 'ONLINE',
      status: 'ONLINE',
      description: 'State database is available',
    },
    {
      title: 'PostgreSQL Status',
      value: 'ONLINE',
      status: 'ONLINE',
      description: 'Off-chain database connection is active',
    },
    {
      title: 'Chaincode Status',
      value: 'COMMITTED',
      status: 'HEALTHY',
      description: 'Government blockchain chaincode is active',
    },
    {
      title: 'Last Block Number',
      value: '2,846,193',
      status: 'HEALTHY',
      description: 'Latest block committed to channel',
    },
  ];

  readonly recentTransactions: RecentTransaction[] = [
    {
      transactionId: 'GTX-20260521-0001',
      residentName: 'Nicolas Salloum',
      ministry: 'Ministry of Interior',
      service: 'Civil Registry Extract',
      amount: 150000,
      currency: 'LBP',
      status: 'APPROVED',
      blockchainStatus: 'CONFIRMED',
      createdAt: '2026-05-21 09:15',
    },
    {
      transactionId: 'GTX-20260521-0002',
      residentName: 'Maya Haddad',
      ministry: 'Ministry of Finance',
      service: 'Tax Clearance Certificate',
      amount: 350000,
      currency: 'LBP',
      status: 'PENDING',
      blockchainStatus: 'SUBMITTED',
      createdAt: '2026-05-21 09:07',
    },
    {
      transactionId: 'GTX-20260521-0003',
      residentName: 'Karim Khoury',
      ministry: 'Ministry of Justice',
      service: 'Judicial Record Request',
      amount: 250000,
      currency: 'LBP',
      status: 'UNDER_REVIEW',
      blockchainStatus: 'PENDING',
      createdAt: '2026-05-21 08:52',
    },
    {
      transactionId: 'GTX-20260521-0004',
      residentName: 'Lea Mansour',
      ministry: 'Ministry of Public Health',
      service: 'Health Coverage Document',
      amount: 0,
      currency: 'LBP',
      status: 'APPROVED',
      blockchainStatus: 'CONFIRMED',
      createdAt: '2026-05-21 08:34',
    },
    {
      transactionId: 'GTX-20260521-0005',
      residentName: 'Rami Daher',
      ministry: 'Ministry of Transport',
      service: 'Vehicle Registration Renewal',
      amount: 750000,
      currency: 'LBP',
      status: 'REJECTED',
      blockchainStatus: 'FAILED',
      createdAt: '2026-05-21 08:21',
    },
  ];

  getMaxValue(items: TimelineChartItem[] | SimpleChartItem[]): number {
    return Math.max(...items.map((item) => item.value), 1);
  }

  getBarWidth(value: number, items: TimelineChartItem[] | SimpleChartItem[]): number {
    return Math.round((value / this.getMaxValue(items)) * 100);
  }

  getTotal(items: SimpleChartItem[]): number {
    return items.reduce((total, item) => total + item.value, 0);
  }

  getStatusClass(status: TransactionStatus | BlockchainStatus | HealthStatus): string {
    return String(status).toLowerCase().replaceAll('_', '-');
  }

  trackByTitle(_: number, item: DashboardKpi | HealthItem): string {
    return item.title;
  }

  trackByLabel(_: number, item: SimpleChartItem | TimelineChartItem): string {
    return item.label;
  }

  trackByTransactionId(_: number, item: RecentTransaction): string {
    return item.transactionId;
  }
}