import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
// src/app/blockchain/audit-validation/audit-validation.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
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
export class AuditValidationComponent implements OnInit, OnDestroy {
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
    limit: this.limit,
    offset: this.offset,
  };

  constructor(private auditValidationService: AuditValidationService) {}

  ngOnInit(): void {
    document.body.classList.add('audit-validation-fullscreen');
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
    this.filters = {
      limit: 50,
      offset: 0,
    };
    this.refreshEvents();
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


  loadEvents(): void {
    this.loading = true;
    this.errorMessage = '';

    const filters: AuditEventFilters = {
      ...this.filters,
      limit: this.limit,
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

  ngOnDestroy(): void {
    document.body.classList.remove('audit-validation-fullscreen');
  }

}
