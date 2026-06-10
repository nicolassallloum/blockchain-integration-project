import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GovernmentAuditLog,
  GovernmentAuditLogsApiService,
  GovernmentAuditLogsPagination,
  GovernmentAuditLogsSummary
} from '../../services/government-audit-logs-api.service';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.scss',
})
export class AuditLogs implements OnInit {
  summary: GovernmentAuditLogsSummary = {
    totalLogs: 0,
    userActions: 0,
    apiEvents: 0,
    securityAlerts: 0
  };

  logs: GovernmentAuditLog[] = [];

  pagination: GovernmentAuditLogsPagination = {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0
  };

  search = '';
  logType = 'ALL';
  severity = 'ALL';

  isLoadingSummary = false;
  isLoadingLogs = false;
  errorMessage = '';

  readonly logTypeOptions = [
    { label: 'All Log Types', value: 'ALL' },
    { label: 'Government Blockchain', value: 'GOVERNMENT_BLOCKCHAIN' },
    { label: 'Wallet', value: 'WALLET' },
    { label: 'Transaction', value: 'TRANSACTION' },
    { label: 'Database Schema', value: 'DATABASE_SCHEMA' },
    { label: 'Wallet Login', value: 'WALLET_LOGIN' },
    { label: 'Resident Creation', value: 'RESIDENT_CREATION' },
    { label: 'Resident Wallet Creation', value: 'RESIDENT_WALLET_CREATION' },
    { label: 'Resident KYC Submission', value: 'RESIDENT_KYC_SUBMISSION' },
    { label: 'Wallet Transfer', value: 'WALLET_TRANSFER' }
  ];

  readonly severityOptions = [
    { label: 'All Severities', value: 'ALL' },
    { label: 'Info', value: 'INFO' },
    { label: 'Warning', value: 'WARNING' },
    { label: 'Error', value: 'ERROR' },
    { label: 'Critical', value: 'CRITICAL' },
    { label: 'Success', value: 'SUCCESS' },
    { label: 'Failed', value: 'FAILED' }
  ];

  constructor(private readonly auditLogsApi: GovernmentAuditLogsApiService) {}

  ngOnInit(): void {
    this.loadSummary();
    this.loadLogs();
  }

  loadSummary(): void {
    this.isLoadingSummary = true;

    this.auditLogsApi.getSummary().subscribe({
      next: (response) => {
        this.summary = response.data || this.summary;
        this.isLoadingSummary = false;
      },
      error: (error) => {
        console.error('[AUDIT_LOGS_SUMMARY_UI_ERROR]', error);
        this.errorMessage = 'Failed to load audit logs summary.';
        this.isLoadingSummary = false;
      }
    });
  }

  loadLogs(page = 1): void {
    this.isLoadingLogs = true;
    this.errorMessage = '';

    this.auditLogsApi.getLogs({
      search: this.search,
      logType: this.logType,
      severity: this.severity,
      page,
      limit: this.pagination.limit
    }).subscribe({
      next: (response) => {
        this.logs = response.data || [];
        this.pagination = response.pagination || {
          ...this.pagination,
          page,
          total: this.logs.length,
          totalPages: 1
        };
        this.isLoadingLogs = false;
      },
      error: (error) => {
        console.error('[AUDIT_LOGS_LIST_UI_ERROR]', error);
        this.errorMessage = 'Failed to load audit logs.';
        this.logs = [];
        this.isLoadingLogs = false;
      }
    });
  }

  applyFilters(): void {
    this.loadLogs(1);
  }

  resetFilters(): void {
    this.search = '';
    this.logType = 'ALL';
    this.severity = 'ALL';
    this.loadLogs(1);
  }

  nextPage(): void {
    if (this.pagination.page < this.pagination.totalPages) {
      this.loadLogs(this.pagination.page + 1);
    }
  }

  previousPage(): void {
    if (this.pagination.page > 1) {
      this.loadLogs(this.pagination.page - 1);
    }
  }

  getSeverityClass(severity: string | null | undefined): string {
    const value = String(severity || '').toUpperCase();

    if (['SUCCESS', 'COMPLETED', 'APPROVED'].includes(value)) {
      return 'success';
    }

    if (['ERROR', 'FAILED', 'FAILURE', 'HIGH', 'CRITICAL'].includes(value)) {
      return 'danger';
    }

    if (['WARNING', 'WARN', 'MEDIUM'].includes(value)) {
      return 'warning';
    }

    return 'info';
  }

  formatAction(action: string | null | undefined): string {
    return String(action || 'UNKNOWN')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  shortenLogId(logId: string | null | undefined): string {
    const value = String(logId || '');
    return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
  }

  exportLogs(): void {
    const rows = this.logs.map((log) => ({
      logId: log.logId,
      userName: log.userName,
      action: log.action,
      moduleName: log.moduleName,
      ipAddress: log.ipAddress,
      severity: log.severity,
      eventDate: log.eventDate,
      requestId: log.requestId || '',
      correlationId: log.correlationId || '',
      errorMessage: log.errorMessage || ''
    }));

    const csv = [
      Object.keys(rows[0] || {
        logId: '',
        userName: '',
        action: '',
        moduleName: '',
        ipAddress: '',
        severity: '',
        eventDate: '',
        requestId: '',
        correlationId: '',
        errorMessage: ''
      }).join(','),
      ...rows.map((row) =>
        Object.values(row)
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `audit-logs-page-${this.pagination.page}.csv`;
    anchor.click();

    window.URL.revokeObjectURL(url);
  }
}
