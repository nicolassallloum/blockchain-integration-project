import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, timeout } from 'rxjs';
import {
  AmlAlertQueueItem,
  AmlAlertsQueueSummary,
  GovernmentAmlAlertsQueueApiService
} from '../../services/government-aml-alerts-queue-api.service';

@Component({
  selector: 'app-aml-alerts-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './aml-alerts-queue.html',
  styleUrl: './aml-alerts-queue.scss'
})
export class AmlAlertsQueue implements OnInit {
  alerts: AmlAlertQueueItem[] = [];

  summary: AmlAlertsQueueSummary = {
    totalOpen: 0,
    openAlerts: 0,
    pendingReview: 0,
    highRisk: 0
  };

  selectedAlert: AmlAlertQueueItem | null = null;
  notes = '';

  isLoading = false;
  isSaving = false;
  savingAction: 'review' | 'close' | null = null;
  errorMessage = '';
  successMessage = '';

  readonly officerName = 'Officer Nix';

  constructor(private readonly amlAlertsQueueApi: GovernmentAmlAlertsQueueApiService) {}

  ngOnInit(): void {
    this.loadAlerts();
  }

  loadAlerts(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.amlAlertsQueueApi.getAlertsQueue().subscribe({
      next: (response) => {
        this.summary = {
          totalOpen: Number(response.summary?.totalOpen || 0),
          openAlerts: Number(response.summary?.openAlerts || 0),
          pendingReview: Number(response.summary?.pendingReview || 0),
          highRisk: Number(response.summary?.highRisk || 0)
        };

        this.alerts = response.data || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load AML alerts queue:', error);
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to load AML alerts queue.';
        this.isLoading = false;
      }
    });
  }

  viewDetails(alert: AmlAlertQueueItem): void {
    this.selectedAlert = alert;
    this.notes = alert.reviewNotes || '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeDetails(): void {
    this.selectedAlert = null;
    this.notes = '';
    this.isSaving = false;
    this.savingAction = null;
  }

  markAsReviewed(alert: AmlAlertQueueItem | null = this.selectedAlert): void {
    if (!alert) {
      return;
    }

    this.isSaving = true;
    this.savingAction = 'review';
    this.errorMessage = '';
    this.successMessage = '';

    this.amlAlertsQueueApi
      .markAsReviewed(alert.alertId, this.notes, this.officerName)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.isSaving = false;
          this.savingAction = null;
        })
      )
      .subscribe({
        next: (response) => {
          this.successMessage = response.message || 'AML alert marked as reviewed successfully.';
          this.closeDetails();
          this.loadAlerts();
        },
        error: (error) => {
          console.error('Failed to mark AML alert as reviewed:', error);
          this.errorMessage =
            error?.name === 'TimeoutError'
              ? 'The review request timed out in the browser. The queue was refreshed to confirm the latest status.'
              : error?.error?.message ||
                error?.message ||
                'Failed to mark AML alert as reviewed.';

          this.closeDetails();
          this.loadAlerts();
        }
      });
  }

  closeAlert(alert: AmlAlertQueueItem | null = this.selectedAlert): void {
    if (!alert) {
      return;
    }

    this.isSaving = true;
    this.savingAction = 'close';
    this.errorMessage = '';
    this.successMessage = '';

    this.amlAlertsQueueApi
      .closeAlert(alert.alertId, this.notes, this.officerName)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.isSaving = false;
          this.savingAction = null;
        })
      )
      .subscribe({
        next: (response) => {
          this.successMessage = response.message || 'AML alert closed successfully.';
          this.closeDetails();
          this.loadAlerts();
        },
        error: (error) => {
          console.error('Failed to close AML alert:', error);
          this.errorMessage =
            error?.name === 'TimeoutError'
              ? 'The close request timed out in the browser. The queue was refreshed to confirm the latest status.'
              : error?.error?.message ||
                error?.message ||
                'Failed to close AML alert.';

          this.closeDetails();
          this.loadAlerts();
        }
      });
  }

  getRiskClass(riskLevel: string): string {
    return String(riskLevel || 'LOW').toLowerCase();
  }

  getStatusClass(status: string): string {
    const normalized = String(status || 'OPEN').toLowerCase().replace(/_/g, '-');

    if (normalized.includes('closed') || normalized.includes('resolved')) {
      return 'closed';
    }

    if (normalized.includes('pending') || normalized.includes('review')) {
      return 'pending';
    }

    return 'open';
  }

  formatJson(value: unknown): string {
    if (!value) {
      return '-';
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  trackByAlertId(index: number, alert: AmlAlertQueueItem): string {
    return alert.alertId || String(index);
  }
}
