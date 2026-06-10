import { CommonModule, DecimalPipe, NgClass } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { GovernmentDashboardService } from '../../../services/government-dashboard.service';

type KpiTone =
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'purple'
  | 'cyan'
  | 'dark';

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
  total?: number;
  tone?: KpiTone;
}

interface TimelineChartItem {
  label: string;
  value: number;
  total?: number;
}

interface HealthItem {
  title: string;
  value: string | number;
  status: string;
  description: string;
}

interface RecentTransaction {
  transactionId: string;
  residentName: string;
  ministry: string;
  service: string;
  amount: number;
  currency: string;
  status: string;
  blockchainStatus: string;
  createdAt: string;
}

@Component({
  selector: 'app-government-blockchain-dashboard',
  standalone: true,
  imports: [CommonModule, NgClass, DecimalPipe],
  templateUrl: './government-blockchain-dashboard.component.html',
  styleUrl: './government-blockchain-dashboard.component.scss',
})
export class GovernmentBlockchainDashboardComponent implements OnInit {
  readonly pageTitle = 'Government Blockchain Dashboard';
  readonly pageSubtitle =
    'Full operational overview of residents, ministries, wallets, transactions, blockchain proof, payments, digital stamps, AML alerts, fraud alerts, and system health.';

  loading = false;
  dashboardError = '';
  lastUpdated = new Date();

  summary: any = {};
  cards: any = {};
  charts: any = {};
  health: any = {};

  kpis: DashboardKpi[] = [];
  transactionsByStatus: SimpleChartItem[] = [];
  transactionsByMinistry: SimpleChartItem[] = [];
  walletGrowth: TimelineChartItem[] = [];
  blockchainSubmissionStatus: SimpleChartItem[] = [];
  paymentsTimeline: TimelineChartItem[] = [];
  amlAlertsDistribution: SimpleChartItem[] = [];
  blockchainHealth: HealthItem[] = [];
  recentTransactions: RecentTransaction[] = [];

  constructor(private dashboardService: GovernmentDashboardService) {}

  ngOnInit(): void {
    this.loadDashboardRealData();
  }

  refreshDashboard(): void {
    this.loadDashboardRealData();
  }

  loadDashboardRealData(): void {
    this.loading = true;
    this.dashboardError = '';

    forkJoin({
      summary: this.dashboardService.getSummary(),
      charts: this.dashboardService.getCharts(),
      health: this.dashboardService.getHealth(),
      recentTransactions: this.dashboardService.getRecentTransactions(),
    }).subscribe({
      next: (res) => {
        this.summary = res.summary.data || {};
        this.cards = this.summary.cards || {};
        this.charts = res.charts.data || {};
        this.health = res.health.data || {};
        this.lastUpdated = this.summary.lastUpdated
          ? new Date(this.summary.lastUpdated)
          : new Date();

        this.kpis = this.buildKpis();
        this.transactionsByStatus = this.withPercent(
          this.charts.transactionsByStatus || [],
          ['green', 'orange', 'purple', 'red', 'blue']
        );
        this.transactionsByMinistry = this.withPercent(
          this.charts.transactionsByMinistry || [],
          ['blue', 'green', 'purple', 'cyan', 'orange']
        );
        this.walletGrowth = this.buildTimeline(this.charts.walletGrowth || []);
        this.blockchainSubmissionStatus = this.withPercent(
          this.charts.blockchainSubmissionStatus || [],
          ['green', 'blue', 'orange', 'red', 'purple']
        );
        this.paymentsTimeline = this.buildTimeline(this.charts.paymentsTimeline || []);
        this.amlAlertsDistribution = this.withPercent(
          this.charts.amlAlertsDistribution || [],
          ['orange', 'red', 'purple', 'dark', 'green']
        );
        this.blockchainHealth = this.buildHealth();
        this.recentTransactions = this.buildRecentTransactions(
          res.recentTransactions.data || []
        );

        this.loading = false;
      },
      error: (error) => {
        console.error('Government dashboard real data load failed', error);
        this.dashboardError = 'Failed to load dashboard real data.';
        this.loading = false;
      },
    });
  }

  private buildKpis(): DashboardKpi[] {
    return [
      {
        title: 'Total Residents',
        value: Number(this.cards.totalResidents || 0),
        subtitle: 'Registered resident accounts',
        icon: '👥',
        tone: 'blue',
        trend: 'Real',
      },
      {
        title: 'Total Ministries',
        value: Number(this.cards.totalMinistries || 0),
        subtitle: 'Central ministries onboarded',
        icon: '🏛️',
        tone: 'purple',
        trend: 'Real',
      },
      {
        title: 'Public Administrations',
        value: Number(this.cards.totalPublicAdministrations || 0),
        subtitle: 'Connected public entities',
        icon: '🏢',
        tone: 'cyan',
        trend: 'Real',
      },
      {
        title: 'Total Wallets',
        value: Number(this.cards.totalWallets || 0),
        subtitle: 'Blockchain wallets created',
        icon: '👛',
        tone: 'green',
        trend: 'Real',
      },
      {
        title: 'Active Wallets',
        value: Number(this.cards.activeWallets || 0),
        subtitle: 'Wallets currently active',
        icon: '✅',
        tone: 'green',
        trend: 'Real',
      },
      {
        title: 'Total Transactions',
        value: Number(this.cards.totalTransactions || 0),
        subtitle: 'Government blockchain transactions',
        icon: '🔁',
        tone: 'blue',
        trend: 'Real',
      },
      {
        title: 'Pending Transactions',
        value: Number(this.cards.pendingTransactions || 0),
        subtitle: 'Waiting for review or approval',
        icon: '⏳',
        tone: 'orange',
        trend: 'Real',
      },
      {
        title: 'Approved Transactions',
        value: Number(this.cards.approvedTransactions || 0),
        subtitle: 'Validated government transactions',
        icon: '✔️',
        tone: 'green',
        trend: 'Real',
      },
      {
        title: 'Rejected Transactions',
        value: Number(this.cards.rejectedTransactions || 0),
        subtitle: 'Rejected or invalid requests',
        icon: '❌',
        tone: 'red',
        trend: 'Real',
      },
      {
        title: 'Total Payments',
        value: Number(this.cards.totalPayments || 0),
        suffix: ' GOV',
        subtitle: 'Collected through digital services',
        icon: '💳',
        tone: 'purple',
        trend: 'Real',
      },
      {
        title: 'Digital Stamp Transactions',
        value: Number(this.cards.digitalStampTransactions || 0),
        subtitle: 'Digital stamp usage records',
        icon: '🎫',
        tone: 'cyan',
        trend: 'Real',
      },
      {
        title: 'Blockchain Proof Records',
        value: Number(this.cards.blockchainProofRecords || 0),
        subtitle: 'Hash proof records stored',
        icon: '⛓️',
        tone: 'dark',
        trend: 'Real',
      },
      {
        title: 'Fraud Alerts',
        value: Number(this.cards.fraudAlerts || 0),
        subtitle: 'Suspicious fraud indicators',
        icon: '🚨',
        tone: 'red',
        trend: 'Real',
      },
      {
        title: 'AML Alerts',
        value: Number(this.cards.amlAlerts || 0),
        subtitle: 'AML screening alerts',
        icon: '🛡️',
        tone: 'orange',
        trend: 'Real',
      },
      {
        title: 'Today Transactions',
        value: Number(this.cards.todayTransactions || 0),
        subtitle: 'Transactions created today',
        icon: '📅',
        tone: 'blue',
        trend: 'Real',
      },
      {
        title: 'Today Payments',
        value: Number(this.cards.todayPayments || 0),
        suffix: ' GOV',
        subtitle: 'Payments collected today',
        icon: '💰',
        tone: 'green',
        trend: 'Real',
      },
    ];
  }

  private buildHealth(): HealthItem[] {
    return [
      {
        title: 'Peer Status',
        value: this.health.peerStatus || 'UNKNOWN',
        status: this.health.peerStatus || 'UNKNOWN',
        description: 'Org1 and Org2 peers are reachable',
      },
      {
        title: 'Orderer Status',
        value: this.health.ordererStatus || 'UNKNOWN',
        status: this.health.ordererStatus || 'UNKNOWN',
        description: 'Ordering service is processing blocks',
      },
      {
        title: 'CouchDB Status',
        value: this.health.couchDbStatus || 'UNKNOWN',
        status: this.health.couchDbStatus || 'UNKNOWN',
        description: 'State database is available',
      },
      {
        title: 'PostgreSQL Status',
        value: this.health.postgresqlStatus || 'UNKNOWN',
        status: this.health.postgresqlStatus || 'UNKNOWN',
        description: 'Off-chain database connection is active',
      },
      {
        title: 'Chaincode Status',
        value: this.health.chaincodeStatus || 'UNKNOWN',
        status: this.health.chaincodeStatus || 'UNKNOWN',
        description: 'Government blockchain chaincode is active',
      },
      {
        title: 'Last Block Number',
        value: Number(this.health.lastBlockNumber || 0),
        status: 'ONLINE',
        description: 'Latest block committed to channel',
      },
    ];
  }

  private buildRecentTransactions(rows: any[]): RecentTransaction[] {
    return rows.map((tx) => ({
      transactionId: tx.transaction_id || '-',
      residentName: tx.resident_name || 'Unknown Resident',
      ministry: tx.ministry || 'Unknown Ministry',
      service: tx.service || 'Government Service',
      amount: Number(tx.amount || 0),
      currency: tx.currency || 'GOV',
      status: tx.status || 'PENDING',
      blockchainStatus: tx.blockchain_status || 'PENDING',
      createdAt: tx.created_at || '',
    }));
  }

  private withPercent(items: any[], tones: KpiTone[]): SimpleChartItem[] {
    const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);

    return items.map((item, index) => {
      const count = Number(item.total || 0);
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;

      return {
        label: this.normalizeLabel(item.label),
        value: percent,
        total: count,
        tone: tones[index] || 'blue',
      };
    });
  }

  private buildTimeline(items: any[]): TimelineChartItem[] {
    return items.map((item) => ({
      label: this.normalizeLabel(item.label),
      value: Number(item.total || 0),
      total: Number(item.total || 0),
    }));
  }

  private normalizeLabel(value: any): string {
    if (!value) return 'Unknown';

    return String(value)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  getBarWidth(value: number, items: Array<{ value: number }>): number {
    const max = Math.max(...items.map((item) => Number(item.value || 0)), 1);
    return Math.max(4, Math.round((Number(value || 0) / max) * 100));
  }

  getTotal(items: Array<{ value: number }>): number {
    return items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  }

  getStatusClass(status: string): string {
    const normalized = String(status || '').toUpperCase();

    if (['ONLINE', 'HEALTHY', 'COMMITTED', 'CONFIRMED', 'SYNCED', 'APPROVED', 'COMPLETED'].includes(normalized)) {
      return 'status-success';
    }

    if (['PENDING', 'SUBMITTED', 'PENDING_REVIEW', 'UNDER_REVIEW', 'WARNING', 'NOT SUBMITTED'].includes(normalized)) {
      return 'status-warning';
    }

    if (['FAILED', 'REJECTED', 'OFFLINE', 'BLOCKCHAIN FAILED'].includes(normalized)) {
      return 'status-danger';
    }

    return 'status-neutral';
  }

  trackByTitle(index: number, item: { title?: string; label?: string }): string {
    return item?.title || item?.label || index.toString();
  }

  trackByTransactionId(index: number, item: RecentTransaction): string {
    return item?.transactionId || index.toString();
  }
  trackByLabel(index: number, item: { label?: string; title?: string }): string {
    return item?.label || item?.title || index.toString();
  }

}
