import { CommonModule, KeyValue } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, timeout } from 'rxjs';

import {
  GenerateGovernmentReportRequest,
  GovernmentGeneratedReport,
  GovernmentReportDetails,
  GovernmentReportTemplate,
  GovernmentReportsApiService,
  GovernmentReportSummary
} from '../../services/government-reports-api.service';

interface SummaryCard {
  title: string;
  value: number;
  subtitle: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports implements OnInit {
  loading = false;
  errorMessage = '';

  summary: GovernmentReportSummary = {
    availableReports: 0,
    generatedToday: 0,
    scheduledReports: 0,
    failedReports: 0
  };

  reportCards: GovernmentReportTemplate[] = [];
  recentReports: GovernmentGeneratedReport[] = [];

  selectedReport: GovernmentReportDetails | null = null;
  selectedTemplate: GovernmentReportTemplate | null = null;
  reportDetailsLoading = false;
  reportDetailsError = '';

  showGenerateModal = false;
  generating = false;
  generateError = '';
  generateSuccess = '';

  generateForm: GenerateGovernmentReportRequest = {
    reportCode: 'TRANSACTION_SUMMARY',
    format: 'PDF',
    generatedBy: 'Admin User',
    filters: {
      source: 'Reports screen'
    }
  };

  readonly formats = ['PDF', 'Excel', 'CSV'];

  constructor(private readonly reportsApi: GovernmentReportsApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';

    this.reportsApi.getDashboard().subscribe({
      next: (response) => {
        this.summary = response.data?.summary || this.summary;
        this.reportCards = response.data?.reportCards || [];
        this.recentReports = response.data?.recentReports || [];

        if (!this.generateForm.reportCode && this.reportCards.length > 0) {
          this.generateForm.reportCode = this.reportCards[0].reportCode;
        }
      },
      error: (error) => {
        console.error('[Reports Screen] Failed to load dashboard', error);
        this.errorMessage = error?.error?.message || 'Failed to load reports dashboard.';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  refresh(): void {
    this.loadDashboard();
  }

  getSummaryCards(): SummaryCard[] {
    return [
      {
        title: 'Available Reports',
        value: this.summary.availableReports || 0,
        subtitle: 'Report templates'
      },
      {
        title: 'Generated Today',
        value: this.summary.generatedToday || 0,
        subtitle: 'Saved report records'
      },
      {
        title: 'Scheduled',
        value: this.summary.scheduledReports || 0,
        subtitle: 'Automated reports'
      },
      {
        title: 'Failed',
        value: this.summary.failedReports || 0,
        subtitle: 'Generation errors'
      }
    ];
  }

  openReport(template: GovernmentReportTemplate): void {
    this.selectedTemplate = template;
    this.selectedReport = null;
    this.reportDetailsLoading = true;
    this.reportDetailsError = '';

    this.reportsApi.getReportDetails(template.reportCode)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.reportDetailsLoading = false;
        })
      )
      .subscribe({
        next: (response) => {
          if (!response?.success || !response?.data) {
            this.reportDetailsError = response?.message || 'Report details response was empty.';
            return;
          }

          this.selectedReport = response.data;
        },
        error: (error) => {
          console.error('[Reports Screen] Failed to open report', error);
          this.selectedReport = null;
          this.reportDetailsError = error?.error?.message || error?.message || 'Failed to open report details.';
        }
      });
  }

  closeReportDetails(): void {
    this.selectedReport = null;
    this.selectedTemplate = null;
    this.reportDetailsError = '';
  }

  openGenerateModal(template?: GovernmentReportTemplate): void {
    this.generateError = '';
    this.generateSuccess = '';

    if (template) {
      this.generateForm.reportCode = template.reportCode;
    } else if (!this.generateForm.reportCode && this.reportCards.length > 0) {
      this.generateForm.reportCode = this.reportCards[0].reportCode;
    }

    this.showGenerateModal = true;
  }

  closeGenerateModal(): void {
    if (this.generating) {
      return;
    }

    this.showGenerateModal = false;
    this.generateError = '';
    this.generateSuccess = '';
  }

  generateReport(): void {
    if (!this.generateForm.reportCode) {
      this.generateError = 'Please select a report template.';
      return;
    }

    this.generating = true;
    this.generateError = '';
    this.generateSuccess = '';

    const payload: GenerateGovernmentReportRequest = {
      reportCode: this.generateForm.reportCode,
      format: this.generateForm.format || 'PDF',
      generatedBy: this.generateForm.generatedBy || 'Admin User',
      filters: {
        source: 'Reports screen',
        generatedFromUi: true
      }
    };

    this.reportsApi.generateReport(payload).subscribe({
      next: (response) => {
        this.generateSuccess = `${response.data.reportNo} generated successfully.`;
        this.recentReports = [response.data, ...this.recentReports].slice(0, 10);
        this.loadDashboard();
      },
      error: (error) => {
        console.error('[Reports Screen] Failed to generate report', error);
        this.generateError = error?.error?.message || 'Failed to generate report.';
      },
      complete: () => {
        this.generating = false;
      }
    });
  }

  getTemplateName(reportCode: string): string {
    return this.reportCards.find((card) => card.reportCode === reportCode)?.reportName || reportCode;
  }

  getStatusClass(status?: string | null): string {
    const value = String(status || '').toUpperCase();

    if (['GENERATED', 'SUCCESS', 'COMPLETED', 'APPROVED', 'ACTIVE', 'ISSUED', 'REDEEMED', 'VERIFIED'].includes(value)) {
      return 'success';
    }

    if (['FAILED', 'ERROR', 'REJECTED', 'INVALID', 'EXPIRED', 'CANCELLED'].includes(value)) {
      return 'danger';
    }

    if (['PENDING', 'SUBMITTED', 'IN_REVIEW', 'OPEN'].includes(value)) {
      return 'warning';
    }

    return 'neutral';
  }

  formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    if (typeof value === 'number') {
      return value.toLocaleString();
    }

    if (typeof value === 'string') {
      const numeric = Number(value);
      if (!Number.isNaN(numeric) && value.trim() !== '' && value.length < 18) {
        return numeric.toLocaleString();
      }
      return value;
    }

    return JSON.stringify(value);
  }

  formatLabel(value: string): string {
    return value
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  originalOrder = (
    a: KeyValue<string, unknown>,
    b: KeyValue<string, unknown>
  ): number => 0;
}
