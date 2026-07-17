import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
// src/app/blockchain/audit-validation/audit-validation.component.ts

import { Component, OnInit } from '@angular/core';
interface JsonDiffLine {
  text: string;
  changed: boolean;
}

import {
  AuditEvent,
  AuditEventFilters,
  AuditDashboardResponse,
  AuditValidationService,
} from './audit-validation.service';

@Component({
  selector: 'app-audit-validation',
  templateUrl: './audit-validation.component.html',
  styleUrls: ['./audit-validation.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
})
export class AuditValidationComponent implements OnInit {
  selectedBatchEventIds = new Set<string>();
  batchProofLoading = false;
  batchProofMessage = '';
  batchProofError = '';

  events: AuditEvent[] = [];
  dashboard: AuditDashboardResponse | null = null;
  activeDashboardTitle = 'All Audit Events';
  selectedEvent: AuditEvent | null = null;

  loading = false;
  errorMessage = '';
  successMessage = '';

  total = 0;
  limit = 50;
  offset = 0;

  sourceObjects = [
    'blockchain.v_aml_alert_by_customer',
    'blockchain.v_customers',
    'blockchain.v_transactions',
    'blockchain.v_queries',
    'blockchain.v_aml_rules',
  ];

  filters: AuditEventFilters = {
    page_size: 50,
offset: this.offset,
  };


  pageSizeOptions = [10, 25, 50, 100, 250, 500];

  businessObjectOptions = [
    {
      label: 'Transactions',
      value: 'transactions',
      sourceObjects: ['Transactions', 'findba.fin_transaction', 'blockchain.v_transactions', 'fin_transaction'],
      recordPkFields: ['transaction_id', 'trx_id', 'fin_transaction_id', 'record_pk']
    },
    {
      label: 'AML Alerts',
      value: 'aml_alerts',
      sourceObjects: ['AML Alerts', 'sdedba.ref_com_snction_lst_cust_mtch', 'blockchain.v_aml_alert_by_customer', 'ref_com_snction_lst_cust_mtch'],
      recordPkFields: ['alert_id', 'customer_id', 'sanction_match_id', 'record_pk']
    },
    {
      label: 'Queries',
      value: 'queries',
      sourceObjects: ['Queries', 'qbedba.qbe_user_query', 'qbedba.qbe_user_query_details', 'blockchain.v_queries', 'qbe_user_query', 'qbe_user_query_details'],
      recordPkFields: ['qb_id', 'query_id', 'query_detail_id', 'record_pk']
    },
    {
      label: 'Customers',
      value: 'customers',
      sourceObjects: ['Customers', 'sdedba.ref_customer', 'sdedba.cfg_customer_def', 'sdedba.ref_customer_misc_info', 'blockchain.v_customers', 'ref_customer', 'cfg_customer_def'],
      recordPkFields: ['customer_id', 'customer_def_id', 'cust_id', 'record_pk']
    },
    {
      label: 'AML Rules',
      value: 'aml_rules',
      sourceObjects: ['AML Rules', 'suitedba.br_business_rule_definition', 'suitedba.br_business_rule_query', 'suitedba.br_business_rule_message', 'blockchain.v_aml_rules', 'br_business_rule_definition'],
      recordPkFields: ['rule_id', 'rule_query_id', 'business_rule_id', 'record_pk']
    }
  ];

  selectedBusinessObject = '';
  selectedRecordPkField = '';
  recordPkSearchValue = '';
  selectedDashboardTitle = 'All Audit Events';

  constructor(private auditValidationService: AuditValidationService) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.loadEvents();
  }

  refreshEvents(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.auditValidationService.getEvents(this.filters).subscribe({
      next: (response) => {
        this.events = response.events;
        this.total = response.total;
        this.limit = response.limit;
        this.offset = response.offset;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load audit events';
        this.loading = false;
      },
    });
  }

  resetFilters(): void {
    this.selectedDashboardTitle = 'All Audit Events';
    this.selectedBusinessObject = '';
    this.selectedRecordPkField = '';
    this.recordPkSearchValue = '';

    this.filters = {
      page_size: this.filters.page_size || 50,
      limit: this.filters.page_size || 50,
      source_object: '',
      source_table: '',
      record_pk: '',
      record_pk_field: '',
      action_type: '',
      hash_status: '',
      validation_status: '',
      blockchain_status: '',
      date_from: '',
      date_to: ''
    };

    this.loadEvents();
  }

  viewDetails(event: AuditEvent): void {
    this.loading = true;
    this.auditValidationService.getEvent(event.event_id).subscribe({
      next: (fullEvent) => {
        this.selectedEvent = fullEvent;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load audit event details';
        this.loading = false;
      },
    });
  }

  validate(event: AuditEvent): void {
    this.runAction(
      this.auditValidationService.validate(event.event_id),
      'Hash validation completed'
    );
  }

  approve(event: AuditEvent): void {
    this.runAction(this.auditValidationService.approve(event.event_id), 'Audit event approved');
  }

  reject(event: AuditEvent): void {
    const reason = prompt('Reject reason') || '';
    this.runAction(this.auditValidationService.reject(event.event_id, reason), 'Audit event rejected');
  }

  submitBlockchain(event: AuditEvent): void {
    this.runAction(
      this.auditValidationService.submitBlockchain(event.event_id),
      'Audit proof submitted to blockchain'
    );
  }

  private runAction(request$: any, success: string): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    request$.subscribe({
      next: (response: any) => {
        this.successMessage = response?.message || success;
        if (response?.event) {
          this.replaceEvent(response.event);
          if (this.selectedEvent?.event_id === response.event.event_id) {
            this.selectedEvent = response.event;
          }
        }
        this.loading = false;
      },
      error: (error: any) => {
        this.errorMessage = error?.error?.message || error?.message || 'Action failed';
        this.loading = false;
      },
    });
  }

  private replaceEvent(updated: AuditEvent): void {
    const index = this.events.findIndex((item) => item.event_id === updated.event_id);
    if (index >= 0) {
      this.events[index] = updated;
    } else {
      this.events = [updated, ...this.events];
    }
  }

  statusClass(status: string | null | undefined): string {
    if (!status) return 'badge badge-muted';

    const normalized = status.toLowerCase();

    if (['valid', 'approved', 'submitted'].includes(normalized)) {
      return 'badge badge-success';
    }

    if (['invalid', 'rejected', 'failed'].includes(normalized)) {
      return 'badge badge-danger';
    }

    return 'badge badge-warning';
  }

  canApprove(event: AuditEvent): boolean {
    return event.hash_status === 'VALID' && event.validation_status !== 'APPROVED';
  }

  canSubmit(event: AuditEvent): boolean {
    return (
      event.hash_status === 'VALID' &&
      event.validation_status === 'APPROVED' &&
      event.blockchain_status !== 'SUBMITTED'
    );
  }


  loadDashboard(): void {
    this.auditValidationService.getDashboard().subscribe({
      next: (dashboard: AuditDashboardResponse) => {
        this.dashboard = dashboard;
      },
      error: () => {
        this.errorMessage = 'Failed to load audit dashboard';
      },
    });
  }

  maxCount(items: any[] | undefined): number {
    if (!items || !items.length) {
      return 1;
    }

    return Math.max(...items.map((item) => Number(item.count ?? item.total_count ?? 0)), 1);
  }

  barWidth(value: number | undefined, items: any[] | undefined): string {
    const max = this.maxCount(items);
    const current = Number(value ?? 0);
    return `${Math.max((current / max) * 100, current > 0 ? 8 : 0)}%`;
  }

  selectDashboard(title: string, filters: AuditEventFilters): void {
    this.activeDashboardTitle = title;
    this.filters = {
      ...this.filters,
      source_object: '',
      action_type: '',
      hash_status: '',
      validation_status: '',
      blockchain_status: '',
      date_from: '',
      date_to: '',
      ...filters,
    };
    this.offset = 0;
    this.loadDashboard();
    this.loadEvents();
  }

  selectDailyChart(title: string, actionType: string, day: string): void {
    this.selectDashboard(`${title} - ${day}`, {
      action_type: actionType,
      date_from: `${day}T00:00`,
      date_to: `${day}T23:59`,
    });
  }

  selectObjectChart(label: string, sourceObject: string): void {
    this.selectDashboard(`Object - ${label}`, {
      source_object: sourceObject,
    });
  }



  todayDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  todayCount(actionType: 'INSERT' | 'UPDATE' | 'DELETE'): number {
    const rows = (this.dashboard?.daily as any)?.[actionType] || [];
    const today = this.todayDate();
    const row = rows.find((item: any) => item.day === today) || rows[rows.length - 1];
    return Number(row?.count || 0);
  }

  selectTodayChart(title: string, actionType: 'INSERT' | 'UPDATE' | 'DELETE'): void {
    const today = this.todayDate();

    this.selectDashboard(title, {
      action_type: actionType,
      date_from: `${today}T00:00`,
      date_to: `${today}T23:59`,
    });
  }



  getSelectedObjectConfig(): any {
    return this.businessObjectOptions.find((item) => item.value === this.selectedBusinessObject) || null;
  }

  getRecordPkFields(): string[] {
    const selected = this.getSelectedObjectConfig();
    return selected?.recordPkFields || ['record_pk'];
  }

  getFriendlyObjectName(sourceObject: string = '', sourceTable: string = ''): string {
    const value = `${sourceObject} ${sourceTable}`.toLowerCase();

    const found = this.businessObjectOptions.find((item) =>
      item.sourceObjects.some((source: string) => value.includes(source.toLowerCase()))
    );

    return found?.label || sourceObject || sourceTable || '-';
  }

  onBusinessObjectChange(): void {
    const selected = this.getSelectedObjectConfig();

    this.selectedRecordPkField = selected?.recordPkFields?.[0] || '';
    this.filters.source_object = selected?.sourceObjects?.[0] || '';
  }

  applyObjectHistorySearch(): void {
    const selected = this.getSelectedObjectConfig();

    this.filters.source_object = selected?.sourceObjects?.[0] || '';
    const cleanRecordPkValue = this.recordPkSearchValue?.trim() || '';

    this.filters.record_pk =
      this.selectedRecordPkField && cleanRecordPkValue
        ? `${this.selectedRecordPkField}=${cleanRecordPkValue}`
        : cleanRecordPkValue;

    this.filters.record_pk_field = '';
    this.loadEvents();
  }

  clearObjectHistorySearch(): void {
    this.selectedBusinessObject = '';
    this.selectedRecordPkField = '';
    this.recordPkSearchValue = '';
    this.filters.source_object = '';
    this.filters.record_pk = '';
    this.filters.record_pk_field = '';
    this.loadEvents();
  }

  onPageSizeChange(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.loading = true;
    this.errorMessage = '';

    const filters: AuditEventFilters = {
      ...this.filters,
      page_size: this.filters.page_size || 50,
      limit: this.filters.page_size || 50,
offset: this.offset,
    };

    this.auditValidationService.getEvents(filters).subscribe({
      next: (response) => {
        this.events = response.events || [];
        this.total = response.total || 0;
        this.limit = response.limit || this.limit;
        this.offset = response.offset || this.offset;
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load audit events', error);
        this.errorMessage = 'Failed to load audit events';
        this.events = [];
        this.total = 0;
        this.loading = false;
      },
    });
  }

  formatJson(value: any): string {
    if (!value) return '';
    return JSON.stringify(value, null, 2);
  }
  private prettyJsonLines(value: any): string[] {
    if (value === null || value === undefined) {
      return ['-'];
    }

    try {
      return JSON.stringify(value, null, 2).split('\n');
    } catch {
      return [String(value)];
    }
  }

  getJsonDiffLines(
    currentSideData: any,
    oppositeSideData: any
  ): JsonDiffLine[] {
    const currentLines = this.prettyJsonLines(currentSideData);
    const oppositeLines = this.prettyJsonLines(oppositeSideData);

    return currentLines.map((line, index) => ({
      text: line,
      changed: line !== (oppositeLines[index] ?? ''),
    }));
  }



  private getExportRows(): any[] {
    const candidateKeys = ['events', 'auditEvents', 'filteredEvents', 'rows', 'auditEventRows'];

    for (const key of candidateKeys) {
      const value = (this as any)[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  private downloadAuditReport(filename: string, content: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    window.URL.revokeObjectURL(url);
  }

  exportAuditReportCsv(): void {
    const rows = this.getExportRows();

    const columns = [
      'event_id',
      'source_object',
      'action_type',
      'record_pk',
      'changed_by',
      'changed_at',
      'hash_status',
      'validation_status',
      'blockchain_status',
      'ledger_status',
      'tx_id'
    ];

    const escapeCsv = (value: any): string => {
      const text = value === null || value === undefined ? '' : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [
      columns.join(','),
      ...rows.map(row => columns.map(col => escapeCsv(row?.[col])).join(','))
    ].join('\n');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.downloadAuditReport(`audit-validation-report-${stamp}.csv`, csv, 'text/csv;charset=utf-8;');
  }

  exportAuditReportTxt(): void {
    const rows = this.getExportRows();
    const stamp = new Date().toISOString();

    const lines: string[] = [];
    lines.push('VALOORES BLOCKCHAIN AUDIT VALIDATION REPORT');
    lines.push(`Generated At: ${stamp}`);
    lines.push(`Total Rows: ${rows.length}`);
    lines.push('='.repeat(80));
    lines.push('');

    rows.forEach((row, index) => {
      lines.push(`Record #${index + 1}`);
      lines.push(`Event ID          : ${row?.event_id ?? '-'}`);
      lines.push(`Object            : ${row?.source_object ?? '-'}`);
      lines.push(`Action            : ${row?.action_type ?? '-'}`);
      lines.push(`Record PK         : ${row?.record_pk ?? '-'}`);
      lines.push(`Changed By        : ${row?.changed_by ?? '-'}`);
      lines.push(`Changed At        : ${row?.changed_at ?? '-'}`);
      lines.push(`Hash Status       : ${row?.hash_status ?? '-'}`);
      lines.push(`Validation Status : ${row?.validation_status ?? '-'}`);
      lines.push(`Blockchain Status : ${row?.blockchain_status ?? '-'}`);
      lines.push(`Ledger Status     : ${row?.ledger_status ?? '-'}`);
      lines.push(`TX ID             : ${row?.tx_id ?? '-'}`);
      lines.push('-'.repeat(80));
    });

    const filenameStamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.downloadAuditReport(
      `audit-validation-report-${filenameStamp}.txt`,
      lines.join('\n'),
      'text/plain;charset=utf-8;'
    );
  }



  isBatchSelected(eventId: string): boolean {
    return this.selectedBatchEventIds.has(eventId);
  }

  toggleBatchSelection(eventId: string, checked: boolean): void {
    if (!eventId) return;

    if (checked) {
      this.selectedBatchEventIds.add(eventId);
    } else {
      this.selectedBatchEventIds.delete(eventId);
    }
  }

  toggleSelectAllBatch(checked: boolean): void {
    if (checked) {
      (this.events || []).forEach((event: any) => {
        if (event?.event_id) {
          this.selectedBatchEventIds.add(event.event_id);
        }
      });
    } else {
      (this.events || []).forEach((event: any) => {
        if (event?.event_id) {
          this.selectedBatchEventIds.delete(event.event_id);
        }
      });
    }
  }

  getSelectedBatchCount(): number {
    return this.selectedBatchEventIds.size;
  }

  async createBatchProof(): Promise<void> {
    const eventIds = Array.from(this.selectedBatchEventIds);

    this.batchProofMessage = '';
    this.batchProofError = '';

    if (!eventIds.length) {
      this.batchProofError = 'Please select at least one audit event to create a batch proof.';
      return;
    }

    const confirmed = window.confirm(`Create batch proof for ${eventIds.length} selected audit event(s)?`);
    if (!confirmed) {
      return;
    }

    this.batchProofLoading = true;

    const payload = {
      event_ids: eventIds,
      audit_event_ids: eventIds,
      selected_event_ids: eventIds,
      source: 'AUDIT_VALIDATION_UI'
    };

    const candidateUrls = [
      '/api/v1/government-blockchain/audit-batch-proofs/batches',
      '/api/v1/government-blockchain/audit-batch-proofs',
      '/api/v1/government-blockchain/audit-batch-proofs/create',
      '/api/v1/audit-validation/batch-proof',
      '/api/v1/audit-validation/batch-proofs'
    ];

    let lastError = '';

    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const text = await response.text();
        let result: any = {};

        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          result = { raw: text };
        }

        if (!response.ok) {
          lastError = result?.message || result?.error || `HTTP ${response.status}`;
          continue;
        }

        const batchId =
          result?.batch_id ||
          result?.batchId ||
          result?.data?.batch_id ||
          result?.data?.batchId ||
          result?.id ||
          'Batch proof created';

        this.batchProofMessage = `Batch proof created successfully: ${batchId}`;
        this.batchProofLoading = false;
        this.selectedBatchEventIds.clear();
        this.loadEvents();
        return;
      } catch (error: any) {
        lastError = error?.message || String(error);
      }
    }

    this.batchProofError = `Failed to create batch proof. ${lastError}`;
    this.batchProofLoading = false;
  }



  getHighRiskAlerts(): any[] {
    const rows = this.events || [];

    return rows
      .filter((event: any) => this.isHighRiskAuditEvent(event))
      .map((event: any) => ({
        ...event,
        severity: this.getHighRiskSeverity(event),
        reason: this.getHighRiskReason(event)
      }));
  }

  getHighRiskAlertCount(): number {
    return this.getHighRiskAlerts().length;
  }

  private isHighRiskAuditEvent(event: any): boolean {
    const objectText = String(event?.source_object || event?.object || '').toLowerCase();
    const tableText = String(event?.source_table || '').toLowerCase();
    const action = String(event?.action_type || '').toUpperCase();
    const validation = String(event?.validation_status || '').toUpperCase();
    const blockchain = String(event?.blockchain_status || '').toUpperCase();
    const hash = String(event?.hash_status || '').toUpperCase();

    const isCustomer =
      objectText.includes('customer') ||
      tableText.includes('customer');

    const isQuery =
      objectText.includes('quer') ||
      tableText.includes('quer');

    return (
      (isCustomer && ['DELETE', 'UPDATE'].includes(action)) ||
      (isQuery && ['DELETE', 'UPDATE'].includes(action)) ||
      validation.includes('MISMATCH') ||
      validation.includes('FAILED') ||
      blockchain.includes('FAILED') ||
      hash.includes('MISMATCH') ||
      hash.includes('INVALID')
    );
  }

  private getHighRiskSeverity(event: any): string {
    const action = String(event?.action_type || '').toUpperCase();
    const validation = String(event?.validation_status || '').toUpperCase();
    const blockchain = String(event?.blockchain_status || '').toUpperCase();
    const hash = String(event?.hash_status || '').toUpperCase();

    if (
      action === 'DELETE' ||
      validation.includes('MISMATCH') ||
      blockchain.includes('FAILED') ||
      hash.includes('MISMATCH') ||
      hash.includes('INVALID')
    ) {
      return 'CRITICAL';
    }

    if (action === 'UPDATE') {
      return 'HIGH';
    }

    return 'MEDIUM';
  }

  private getHighRiskReason(event: any): string {
    const objectText = String(event?.source_object || event?.object || '').toLowerCase();
    const tableText = String(event?.source_table || '').toLowerCase();
    const action = String(event?.action_type || '').toUpperCase();
    const validation = String(event?.validation_status || '').toUpperCase();
    const blockchain = String(event?.blockchain_status || '').toUpperCase();
    const hash = String(event?.hash_status || '').toUpperCase();

    if (validation.includes('MISMATCH')) return 'Validation mismatch detected';
    if (blockchain.includes('FAILED')) return 'Blockchain submission failed';
    if (hash.includes('MISMATCH') || hash.includes('INVALID')) return 'Hash integrity issue detected';

    if ((objectText.includes('customer') || tableText.includes('customer')) && action === 'DELETE') {
      return 'Customer record deleted';
    }

    if ((objectText.includes('customer') || tableText.includes('customer')) && action === 'UPDATE') {
      return 'Customer data updated';
    }

    if ((objectText.includes('quer') || tableText.includes('quer')) && action === 'DELETE') {
      return 'Query record deleted';
    }

    if ((objectText.includes('quer') || tableText.includes('quer')) && action === 'UPDATE') {
      return 'Query data updated';
    }

    return 'High risk audit condition detected';
  }

  applyHighRiskFilter(): void {
    this.filters.source_object = '';
    this.filters.action_type = '';
    this.filters.validation_status = '';
    this.filters.blockchain_status = '';
    this.filters.hash_status = '';
    this.selectedDashboardTitle = 'High Risk Data Changes';

    this.events = this.getHighRiskAlerts();
    this.total = this.events.length;
  }



  async bulkApproveSelected(): Promise<void> {
    await this.runBulkApprovalAction('APPROVED');
  }

  async bulkRejectSelected(): Promise<void> {
    await this.runBulkApprovalAction('REJECTED');
  }

  async bulkSubmitSelected(): Promise<void> {
    await this.runBulkApprovalAction('SUBMIT');
  }

  private async runBulkApprovalAction(action: 'APPROVED' | 'REJECTED' | 'SUBMIT'): Promise<void> {
    const eventIds = Array.from(this.selectedBatchEventIds || []);

    this.batchProofMessage = '';
    this.batchProofError = '';

    if (!eventIds.length) {
      this.batchProofError = 'Please select at least one audit event.';
      return;
    }

    const confirmed = window.confirm(`${action} ${eventIds.length} selected audit event(s)?`);
    if (!confirmed) {
      return;
    }

    this.batchProofLoading = true;

    const payload = {
      event_ids: eventIds,
      audit_event_ids: eventIds,
      selected_event_ids: eventIds,
      action,
      decision: action,
      status: action,
      source: 'AUDIT_VALIDATION_UI'
    };

    const candidateUrls = [
      '/api/v1/government-blockchain/bulk-compliance-approvals',
      '/api/v1/government-blockchain/bulk-compliance-approvals/batches',
      '/api/v1/government-blockchain/bulk-compliance-approvals/create',
      '/api/v1/audit-validation/bulk-approval',
      '/api/v1/audit-validation/bulk-approvals'
    ];

    let lastError = '';

    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const text = await response.text();
        let result: any = {};

        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          result = { raw: text };
        }

        if (!response.ok) {
          lastError = result?.message || result?.error || `HTTP ${response.status}`;
          continue;
        }

        this.batchProofMessage = `Bulk ${action} completed for ${eventIds.length} selected audit event(s).`;
        this.batchProofLoading = false;
        this.selectedBatchEventIds.clear();
        this.loadEvents();
        return;
      } catch (error: any) {
        lastError = error?.message || String(error);
      }
    }

    this.batchProofError = `Bulk ${action} failed. ${lastError}`;
    this.batchProofLoading = false;
  }



  getSelectedAuditEvents(): any[] {
    const selectedIds = this.selectedBatchEventIds || new Set<string>();
    return (this.events || []).filter((event: any) => selectedIds.has(event?.event_id));
  }

  canBulkValidateSelected(): boolean {
    const selected = this.getSelectedAuditEvents();
    return selected.length > 0 && selected.some((event: any) => {
      const validation = String(event?.validation_status || '').toUpperCase();
      return !['VALID', 'VALIDATED', 'APPROVED', 'VERIFIED'].includes(validation);
    });
  }

  canBulkApproveSelected(): boolean {
    const selected = this.getSelectedAuditEvents();
    return selected.length > 0 && selected.every((event: any) => {
      const validation = String(event?.validation_status || '').toUpperCase();
      return ['VALID', 'VALIDATED', 'VERIFIED'].includes(validation);
    });
  }

  canBulkSubmitSelected(): boolean {
    const selected = this.getSelectedAuditEvents();
    return selected.length > 0 && selected.every((event: any) => {
      const validation = String(event?.validation_status || '').toUpperCase();
      const blockchain = String(event?.blockchain_status || '').toUpperCase();

      return ['APPROVED'].includes(validation) && !['SUBMITTED', 'SUCCESS', 'DONE'].includes(blockchain);
    });
  }

  async bulkValidateSelected(): Promise<void> {
    const selected = this.getSelectedAuditEvents();

    this.batchProofMessage = '';
    this.batchProofError = '';

    if (!selected.length) {
      this.batchProofError = 'Please select at least one audit event.';
      return;
    }

    const confirmed = window.confirm(`Validate ${selected.length} selected audit event(s)?`);
    if (!confirmed) {
      return;
    }

    this.batchProofLoading = true;

    let successCount = 0;
    let failedCount = 0;

    for (const event of selected) {
      try {
        if (typeof (this as any).validateEvent === 'function') {
          await (this as any).validateEvent(event);
          successCount += 1;
        } else if (typeof (this as any).validateAuditEvent === 'function') {
          await (this as any).validateAuditEvent(event);
          successCount += 1;
        } else {
          const response = await fetch(`/api/v1/audit-validation/events/${encodeURIComponent(event.event_id)}/validate`, {
            method: 'POST',
            headers: { Accept: 'application/json' }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          successCount += 1;
        }
      } catch (error) {
        failedCount += 1;
      }
    }

    this.batchProofLoading = false;
    this.batchProofMessage = `Bulk VALIDATE completed. Success: ${successCount}, Failed: ${failedCount}.`;
    this.selectedBatchEventIds.clear();
    this.loadEvents();
  }

}
