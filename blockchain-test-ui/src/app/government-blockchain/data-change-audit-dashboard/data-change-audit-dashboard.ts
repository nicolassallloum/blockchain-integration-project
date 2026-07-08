import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';

type ExportFormat = 'JSON' | 'CSV';

@Component({
  selector: 'app-data-change-audit-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './data-change-audit-dashboard.html',
  styleUrls: ['./data-change-audit-dashboard.scss']
})
export class DataChangeAuditDashboard implements OnInit {
  loading = false;
  detailLoading = false;
  error = '';
  successMessage = '';
  dashboard: any = null;
  selectedEvent: any = null;
  activeDetailTab: 'summary' | 'oldNew' | 'fields' = 'summary';
  lastLoadedAt: string | null = null;

  filters: any = {
    limit: 10,
    tableName: '',
    moduleName: '',
    operationType: 'ALL',
    user: '',
    role: '',
    clientIp: '',
    clientHostname: '',
    dateFrom: '',
    dateTo: '',
    blockchainStatus: 'ALL',
    verificationStatus: 'ALL',
    approvalStatus: 'ALL',
    batchId: '',
    riskLevel: 'ALL'
  };

  metricCards = [
    { label: 'Total Audit Events', key: 'totalAuditEvents', tone: 'neutral' },
    { label: 'Insert Events', key: 'insertEvents', tone: 'success' },
    { label: 'Update Events', key: 'updateEvents', tone: 'warning' },
    { label: 'Delete Events', key: 'deleteEvents', tone: 'danger' },
    { label: 'Submitted to Blockchain', key: 'submittedToBlockchain', tone: 'success' },
    { label: 'Pending Blockchain Submission', key: 'pendingBlockchainSubmission', tone: 'warning' },
    { label: 'Failed Blockchain Submission', key: 'failedBlockchainSubmission', tone: 'danger' },
    { label: 'Verified Events', key: 'verifiedEvents', tone: 'success' },
    { label: 'Mismatched Events', key: 'mismatchedEvents', tone: 'danger' },
    { label: 'Invalid Records', key: 'invalidRecords', tone: 'danger' },
    { label: 'Records Under Compliance Review', key: 'recordsUnderComplianceReview', tone: 'warning' },
    { label: 'Bulk Approval Queue', key: 'bulkApprovalQueue', tone: 'warning' },
    { label: 'Auto-Approved Changes', key: 'autoApprovedChanges', tone: 'success' },
    { label: 'Manual Approval Required', key: 'manualApprovalRequired', tone: 'danger' }
  ];

  tableSections = [
    { title: 'Latest Data Changes', key: 'latestDataChanges' },
    { title: 'High-Risk Changes', key: 'highRiskChanges' },
    { title: 'Deleted Records Evidence', key: 'deletedRecordsEvidence' },
    { title: 'Failed Blockchain Submissions', key: 'failedBlockchainSubmissions' },
    { title: 'Invalid or Mismatched Records', key: 'invalidOrMismatchedRecords' },
    { title: 'Compliance Review Queue', key: 'complianceReviewQueue' },
    { title: 'Bulk Approval Queue', key: 'bulkApprovalQueue' },
    { title: 'Auto-Approved Changes', key: 'autoApprovedChanges' },
    { title: 'Manual Approval Required', key: 'manualApprovalRequired' }
  ];

  ngOnInit(): void {
    this.loadDashboard();
  }

  get apiBaseUrl(): string {
    if (typeof window === 'undefined') {
      return 'http://localhost:3001/api/v1/government-blockchain/data-change-audit-dashboard';
    }

    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';

    return `${protocol}//${hostname}:3001/api/v1/government-blockchain/data-change-audit-dashboard`;
  }

  get metrics(): any {
    return this.dashboard?.metrics || {};
  }

  get tables(): any {
    return this.dashboard?.tables || {};
  }

  number(value: any): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  getTableRows(key: string): any[] {
    return this.tables?.[key] || [];
  }

  json(value: any): string {
    return JSON.stringify(value ?? {}, null, 2);
  }

  private buildQueryString(): string {
    const params = new URLSearchParams();

    Object.entries(this.filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (String(value).toUpperCase() === 'ALL') {
        return;
      }

      params.set(key, String(value));
    });

    return params.toString();
  }

  clearFilters(): void {
    this.filters = {
      limit: 10,
      tableName: '',
      moduleName: '',
      operationType: 'ALL',
      user: '',
      role: '',
      clientIp: '',
      clientHostname: '',
      dateFrom: '',
      dateTo: '',
      blockchainStatus: 'ALL',
      verificationStatus: 'ALL',
      approvalStatus: 'ALL',
      batchId: '',
      riskLevel: 'ALL'
    };

    this.loadDashboard();
  }


  private getFileNameFromContentDisposition(contentDisposition: string | null, fallbackFileName: string): string {
    if (!contentDisposition) {
      return fallbackFileName;
    }

    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    return match?.[1] || fallbackFileName;
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  async loadDashboard(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.successMessage = '';

    try {
      const queryString = this.buildQueryString();
      const response = await fetch(`${this.apiBaseUrl}/dashboard?${queryString}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-user-role': 'AUDITOR'
        }
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || `Dashboard API failed with HTTP ${response.status}`);
      }

      this.dashboard = payload.data;
      this.lastLoadedAt = new Date().toISOString();
      this.successMessage = 'Data change audit dashboard loaded successfully.';
    } catch (error: any) {
      this.error = error?.message || 'Unable to load data change audit dashboard.';
    } finally {
      this.loading = false;
    }
  }

  async viewAuditEvent(row: any, tab: 'summary' | 'oldNew' | 'fields' = 'summary'): Promise<void> {
    if (!row?.auditId) {
      return;
    }

    this.detailLoading = true;
    this.error = '';
    this.activeDetailTab = tab;

    try {
      const response = await fetch(`${this.apiBaseUrl}/events/${row.auditId}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-user-role': 'AUDITOR'
        }
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || `Detail API failed with HTTP ${response.status}`);
      }

      this.selectedEvent = payload.data;
    } catch (error: any) {
      this.error = error?.message || 'Unable to load audit event detail.';
    } finally {
      this.detailLoading = false;
    }
  }

  closeDetail(): void {
    this.selectedEvent = null;
  }

  async exportEvidence(format: ExportFormat): Promise<void> {
    this.error = '';
    this.successMessage = '';

    try {
      const params = new URLSearchParams(this.buildQueryString());
      params.set('format', format);
      params.set('limit', '1000');

      const response = await fetch(`${this.apiBaseUrl}/export?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: format === 'CSV' ? 'text/csv' : 'application/json',
          'x-user-role': 'AUDITOR'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Export failed with HTTP ${response.status}`);
      }

      const fallbackFileName = `data-change-audit-evidence.${format.toLowerCase()}`;
      const fileName = this.getFileNameFromContentDisposition(
        response.headers.get('Content-Disposition'),
        fallbackFileName
      );

      const blob = await response.blob();
      this.downloadBlob(blob, fileName);

      this.successMessage = `Data change audit ${format} evidence report exported successfully.`;
    } catch (error: any) {
      this.error = error?.message || `Unable to export data change audit ${format} report.`;
    }
  }
}
