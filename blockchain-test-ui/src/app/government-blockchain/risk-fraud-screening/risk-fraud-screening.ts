import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GovernmentRiskFraudScreeningApiService,
  RiskFraudAlert,
  RiskFraudFilters,
  RiskFraudSummary
} from '../../services/government-risk-fraud-screening-api.service';

@Component({
  selector: 'app-risk-fraud-screening',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './risk-fraud-screening.html',
  styleUrl: './risk-fraud-screening.scss'
})
export class RiskFraudScreening implements OnInit {
  summary: RiskFraudSummary = {
    totalAlerts: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
    resolvedAlerts: 0
  };

  alerts: RiskFraudAlert[] = [];

  filters: RiskFraudFilters = {
    riskLevel: '',
    status: '',
    residentName: '',
    transactionId: '',
    dateFrom: '',
    dateTo: ''
  };

  selectedAlert: RiskFraudAlert | null = null;
  isLoading = false;
  errorMessage = '';

  readonly riskLevels = [
    { value: '', label: 'All Risk Levels' },
    { value: 'HIGH', label: 'High Risk' },
    { value: 'MEDIUM', label: 'Medium Risk' },
    { value: 'LOW', label: 'Low Risk' }
  ];

  readonly statuses = [
    { value: '', label: 'All Statuses' },
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_REVIEW', label: 'In Review' },
    { value: 'RESOLVED', label: 'Resolved' }
  ];

  constructor(private readonly riskFraudApi: GovernmentRiskFraudScreeningApiService) {}

  ngOnInit(): void {
    this.loadRiskFraudScreening();
  }

  loadRiskFraudScreening(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.riskFraudApi.getRiskFraudScreening(this.filters).subscribe({
      next: (response) => {
        this.summary = response.summary || this.summary;
        this.alerts = response.data || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load risk / fraud screening data:', error);
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to load risk / fraud screening data.';
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    this.loadRiskFraudScreening();
  }

  resetFilters(): void {
    this.filters = {
      riskLevel: '',
      status: '',
      residentName: '',
      transactionId: '',
      dateFrom: '',
      dateTo: ''
    };

    this.loadRiskFraudScreening();
  }

  viewDetails(alert: RiskFraudAlert): void {
    this.selectedAlert = alert;
  }

  closeDetails(): void {
    this.selectedAlert = null;
  }

  getRiskClass(riskLevel: string): string {
    return String(riskLevel || 'LOW').toLowerCase();
  }

  getStatusClass(status: string): string {
    return String(status || 'OPEN').toLowerCase().replace(/_/g, '-');
  }

  trackByAlertId(index: number, alert: RiskFraudAlert): string {
    return alert.alertId || String(index);
  }
}
