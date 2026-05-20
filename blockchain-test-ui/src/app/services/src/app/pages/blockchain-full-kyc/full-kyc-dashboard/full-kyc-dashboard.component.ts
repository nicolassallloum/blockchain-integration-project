import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

type KycStatus =
  | 'APPROVED'
  | 'PENDING_REVIEW'
  | 'REJECTED'
  | 'REQUIRES_UPDATE'
  | 'SUBMITTED'
  | 'DRAFT';

type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH';

type BlockchainStatus =
  | 'CONFIRMED'
  | 'SUBMITTED'
  | 'FAILED'
  | 'NOT_SUBMITTED';

interface KpiCard {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  trend?: string;
  trendType?: 'success' | 'warning' | 'danger' | 'info';
}

interface DistributionItem {
  label: string;
  value: number;
  percentage: number;
  statusClass: string;
}

interface GrowthItem {
  month: string;
  value: number;
  percentage: number;
}

interface InstitutionSummary {
  institutionName: string;
  institutionType: string;
  totalKyc: number;
  approved: number;
  pending: number;
  rejected: number;
}

interface BlockchainHealthItem {
  label: string;
  value: string | number;
  status: 'ONLINE' | 'ACTIVE' | 'WARNING' | 'ERROR' | 'INFO';
}

interface RecentActivity {
  kycId: string;
  citizenId: string;
  fullName: string;
  institution: string;
  status: KycStatus;
  riskCategory: RiskCategory;
  blockchainStatus: BlockchainStatus;
  createdAt: string;
}

@Component({
  selector: 'app-full-kyc-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './full-kyc-dashboard.component.html',
  styleUrl: './full-kyc-dashboard.component.scss'
})
export class FullKycDashboardComponent {
  lastRefreshDate = new Date();

  kpiCards: KpiCard[] = [
    {
      title: 'Total Citizen KYC Profiles',
      value: '125,840',
      subtitle: 'All registered citizen identity profiles',
      icon: '👥',
      trend: '+8.4% this month',
      trendType: 'success'
    },
    {
      title: 'Approved KYC',
      value: '96,420',
      subtitle: 'Validated and approved profiles',
      icon: '✅',
      trend: '76.6% approval rate',
      trendType: 'success'
    },
    {
      title: 'Pending Review',
      value: '14,250',
      subtitle: 'Waiting for compliance officer review',
      icon: '⏳',
      trend: 'Needs action',
      trendType: 'warning'
    },
    {
      title: 'Rejected KYC',
      value: '4,180',
      subtitle: 'Rejected due to failed validation',
      icon: '⛔',
      trend: '3.3% rejection rate',
      trendType: 'danger'
    },
    {
      title: 'Requires Update',
      value: '6,940',
      subtitle: 'Missing or expired citizen information',
      icon: '🔄',
      trend: 'Documents required',
      trendType: 'warning'
    },
    {
      title: 'Duplicate Alerts',
      value: '1,120',
      subtitle: 'Potential duplicate citizen records',
      icon: '🧬',
      trend: 'Identity matching alerts',
      trendType: 'danger'
    },
    {
      title: 'High Risk / Fraud Alerts',
      value: '730',
      subtitle: 'High risk or suspicious profiles',
      icon: '🚨',
      trend: 'Compliance review required',
      trendType: 'danger'
    },
    {
      title: 'Blockchain Proof Records',
      value: '91,860',
      subtitle: 'KYC hashes confirmed on Fabric ledger',
      icon: '🔗',
      trend: 'Ledger proof available',
      trendType: 'success'
    },
    {
      title: 'Failed Blockchain Inserts',
      value: '92',
      subtitle: 'Failed or unmatched ledger submissions',
      icon: '⚠️',
      trend: 'Technical follow-up needed',
      trendType: 'danger'
    },
    {
      title: 'Active State Institutions',
      value: '48',
      subtitle: 'Ministries, municipalities, and authorities',
      icon: '🏛️',
      trend: 'Connected institutions',
      trendType: 'info'
    },
    {
      title: 'Today Created KYC',
      value: '1,284',
      subtitle: 'New profiles created today',
      icon: '📝',
      trend: '+214 vs yesterday',
      trendType: 'success'
    },
    {
      title: 'Today Approved KYC',
      value: '842',
      subtitle: 'Profiles approved today',
      icon: '🛡️',
      trend: 'Processing active',
      trendType: 'success'
    }
  ];

  kycStatusDistribution: DistributionItem[] = [
    {
      label: 'Approved',
      value: 96420,
      percentage: 76,
      statusClass: 'approved'
    },
    {
      label: 'Pending Review',
      value: 14250,
      percentage: 11,
      statusClass: 'pending'
    },
    {
      label: 'Rejected',
      value: 4180,
      percentage: 3,
      statusClass: 'rejected'
    },
    {
      label: 'Requires Update',
      value: 6940,
      percentage: 6,
      statusClass: 'requires-update'
    },
    {
      label: 'Draft / Submitted',
      value: 4050,
      percentage: 4,
      statusClass: 'submitted'
    }
  ];

  citizenKycGrowth: GrowthItem[] = [
    {
      month: 'Jan',
      value: 5800,
      percentage: 32
    },
    {
      month: 'Feb',
      value: 7900,
      percentage: 44
    },
    {
      month: 'Mar',
      value: 10200,
      percentage: 56
    },
    {
      month: 'Apr',
      value: 13700,
      percentage: 76
    },
    {
      month: 'May',
      value: 17850,
      percentage: 100
    }
  ];

  riskDistribution: DistributionItem[] = [
    {
      label: 'Low Risk',
      value: 102500,
      percentage: 81,
      statusClass: 'low-risk'
    },
    {
      label: 'Medium Risk',
      value: 22610,
      percentage: 18,
      statusClass: 'medium-risk'
    },
    {
      label: 'High Risk',
      value: 730,
      percentage: 1,
      statusClass: 'high-risk'
    }
  ];

  blockchainSubmissionStatus: DistributionItem[] = [
    {
      label: 'Confirmed',
      value: 91860,
      percentage: 73,
      statusClass: 'confirmed'
    },
    {
      label: 'Submitted',
      value: 8200,
      percentage: 7,
      statusClass: 'submitted'
    },
    {
      label: 'Not Submitted',
      value: 25780,
      percentage: 20,
      statusClass: 'not-submitted'
    },
    {
      label: 'Failed',
      value: 92,
      percentage: 1,
      statusClass: 'failed'
    }
  ];

  institutionSummary: InstitutionSummary[] = [
    {
      institutionName: 'Ministry of Interior',
      institutionType: 'Ministry',
      totalKyc: 28400,
      approved: 22450,
      pending: 3910,
      rejected: 720
    },
    {
      institutionName: 'Ministry of Finance',
      institutionType: 'Ministry',
      totalKyc: 21600,
      approved: 17820,
      pending: 2400,
      rejected: 490
    },
    {
      institutionName: 'Beirut Municipality',
      institutionType: 'Municipality',
      totalKyc: 15840,
      approved: 11960,
      pending: 2100,
      rejected: 580
    },
    {
      institutionName: 'Public Security Authority',
      institutionType: 'Public Authority',
      totalKyc: 12350,
      approved: 9800,
      pending: 1500,
      rejected: 310
    }
  ];

  blockchainHealth: BlockchainHealthItem[] = [
    {
      label: 'Fabric Peer Status',
      value: 'Online',
      status: 'ONLINE'
    },
    {
      label: 'Orderer Status',
      value: 'Online',
      status: 'ONLINE'
    },
    {
      label: 'CouchDB Status',
      value: 'Online',
      status: 'ONLINE'
    },
    {
      label: 'PostgreSQL Status',
      value: 'Online',
      status: 'ONLINE'
    },
    {
      label: 'Chaincode Status',
      value: 'Committed',
      status: 'ACTIVE'
    },
    {
      label: 'Channel Name',
      value: 'kycchannelnix1',
      status: 'INFO'
    },
    {
      label: 'Chaincode Version',
      value: '2.2',
      status: 'INFO'
    },
    {
      label: 'Last Block Number',
      value: '127',
      status: 'INFO'
    }
  ];

  recentActivities: RecentActivity[] = [
    {
      kycId: 'KYC-2026-000184',
      citizenId: 'CIT-9823401',
      fullName: 'Karim Haddad',
      institution: 'Ministry of Interior',
      status: 'APPROVED',
      riskCategory: 'LOW',
      blockchainStatus: 'CONFIRMED',
      createdAt: '2026-05-20 10:42'
    },
    {
      kycId: 'KYC-2026-000183',
      citizenId: 'CIT-9823398',
      fullName: 'Maya Khoury',
      institution: 'Beirut Municipality',
      status: 'PENDING_REVIEW',
      riskCategory: 'MEDIUM',
      blockchainStatus: 'SUBMITTED',
      createdAt: '2026-05-20 10:35'
    },
    {
      kycId: 'KYC-2026-000182',
      citizenId: 'CIT-9823382',
      fullName: 'Rami Mansour',
      institution: 'Ministry of Finance',
      status: 'REQUIRES_UPDATE',
      riskCategory: 'MEDIUM',
      blockchainStatus: 'NOT_SUBMITTED',
      createdAt: '2026-05-20 10:28'
    },
    {
      kycId: 'KYC-2026-000181',
      citizenId: 'CIT-9823376',
      fullName: 'Nour El-Din',
      institution: 'Public Security Authority',
      status: 'REJECTED',
      riskCategory: 'HIGH',
      blockchainStatus: 'FAILED',
      createdAt: '2026-05-20 10:19'
    },
    {
      kycId: 'KYC-2026-000180',
      citizenId: 'CIT-9823360',
      fullName: 'Lina Farah',
      institution: 'Ministry of Interior',
      status: 'APPROVED',
      riskCategory: 'LOW',
      blockchainStatus: 'CONFIRMED',
      createdAt: '2026-05-20 10:10'
    }
  ];

  refreshDashboard(): void {
    this.lastRefreshDate = new Date();

    // Later API integration example:
    // this.blockchainFullKycApiService.getDashboardSummary().subscribe(...)
    // this.blockchainFullKycApiService.getStatusDistribution().subscribe(...)
    // this.blockchainFullKycApiService.getInstitutionSummary().subscribe(...)
    // this.blockchainFullKycApiService.getRiskDistribution().subscribe(...)
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  getRiskClass(risk: RiskCategory): string {
    return risk.toLowerCase();
  }

  getBlockchainClass(status: BlockchainStatus): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  trackByKpiTitle(index: number, item: KpiCard): string {
    return item.title;
  }

  trackByLabel(index: number, item: DistributionItem): string {
    return item.label;
  }

  trackByMonth(index: number, item: GrowthItem): string {
    return item.month;
  }

  trackByInstitution(index: number, item: InstitutionSummary): string {
    return item.institutionName;
  }

  trackByHealthLabel(index: number, item: BlockchainHealthItem): string {
    return item.label;
  }

  trackByKycId(index: number, item: RecentActivity): string {
    return item.kycId;
  }
}
