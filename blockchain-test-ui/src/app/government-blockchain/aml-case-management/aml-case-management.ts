import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  AmlCaseItem,
  AmlCaseManagementApiService,
  AmlCaseSummary
} from '../../services/aml-case-management-api.service';

@Component({
  selector: 'app-aml-case-management',
  imports: [CommonModule],
  templateUrl: './aml-case-management.html',
  styleUrl: './aml-case-management.scss',
})
export class AmlCaseManagement implements OnInit {
  summary: AmlCaseSummary = {
    totalCases: 0,
    openCases: 0,
    escalatedCases: 0,
    closedCases: 0
  };

  cases: AmlCaseItem[] = [];
  selectedCase: any = null;

  loading = false;
  actionLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private readonly amlCaseApi: AmlCaseManagementApiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.amlCaseApi.getSummary().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.summary = response.data;
        }
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load AML case summary.';
      }
    });

    this.amlCaseApi.getCases().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.cases = response.data;
        } else {
          this.cases = [];
        }

        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.cases = [];
        this.errorMessage = error?.error?.message || 'Failed to load AML cases.';
      }
    });
  }

  refresh(): void {
    this.loadData();
  }

  viewCase(caseItem: AmlCaseItem): void {
    const caseId = caseItem.caseId || caseItem.caseNumber;

    if (!caseId) {
      this.errorMessage = 'Case ID is missing.';
      return;
    }

    this.actionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.amlCaseApi.getCase(caseId).subscribe({
      next: (response) => {
        this.actionLoading = false;

        if (response.success) {
          this.selectedCase = response.data;
          this.successMessage = `Loaded details for ${caseItem.caseNumber}.`;
        } else {
          this.errorMessage = response.message || 'Failed to load case details.';
        }
      },
      error: (error) => {
        this.actionLoading = false;
        this.errorMessage = error?.error?.message || 'Failed to load case details.';
      }
    });
  }

  createCase(): void {
    const alertId = window.prompt('Enter AML Alert ID to create a case from:');

    if (!alertId) {
      return;
    }

    const assignedTo = window.prompt('Assigned investigator/team member:', 'Officer Nix') || 'Officer Nix';
    const assignedTeam = window.prompt('Assigned team:', 'AML Compliance') || 'AML Compliance';

    this.actionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.amlCaseApi.createCase({
      alertId,
      assignedTo,
      assignedTeam,
      openedBy: 'Officer Nix'
    }).subscribe({
      next: (response) => {
        this.actionLoading = false;

        if (response.success) {
          this.successMessage = response.message || 'AML case created successfully.';
          this.loadData();
        } else {
          this.errorMessage = response.message || 'Failed to create AML case.';
        }
      },
      error: (error) => {
        this.actionLoading = false;
        this.errorMessage = error?.error?.message || 'Failed to create AML case.';
      }
    });
  }

  assignCase(caseItem: AmlCaseItem): void {
    const caseId = caseItem.caseId || caseItem.caseNumber;

    if (!caseId) {
      this.errorMessage = 'Case ID is missing.';
      return;
    }

    const assignedTo = window.prompt('Assign investigator:', caseItem.assignedTo || 'Officer Nix');
    if (!assignedTo) {
      return;
    }

    const assignedTeam = window.prompt('Assign team:', caseItem.assignedTeam || 'AML Compliance') || caseItem.assignedTeam || 'AML Compliance';

    this.actionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.amlCaseApi.assignCase(caseId, {
      assignedTo,
      assignedTeam,
      actionBy: 'Officer Nix',
      note: `Assigned from AML Case Management UI to ${assignedTo}.`
    }).subscribe({
      next: (response) => {
        this.actionLoading = false;

        if (response.success) {
          this.successMessage = response.message || 'AML case assigned successfully.';
          this.loadData();
        } else {
          this.errorMessage = response.message || 'Failed to assign AML case.';
        }
      },
      error: (error) => {
        this.actionLoading = false;
        this.errorMessage = error?.error?.message || 'Failed to assign AML case.';
      }
    });
  }

  escalateCase(caseItem: AmlCaseItem): void {
    const caseId = caseItem.caseId || caseItem.caseNumber;

    if (!caseId) {
      this.errorMessage = 'Case ID is missing.';
      return;
    }

    const confirmed = window.confirm(`Escalate ${caseItem.caseNumber}?`);
    if (!confirmed) {
      return;
    }

    this.actionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.amlCaseApi.updateStatus(caseId, {
      status: 'Escalated',
      actionBy: 'Officer Nix',
      note: 'Escalated from AML Case Management UI.'
    }).subscribe({
      next: (response) => {
        this.actionLoading = false;

        if (response.success) {
          this.successMessage = response.message || 'AML case escalated successfully.';
          this.loadData();
        } else {
          this.errorMessage = response.message || 'Failed to escalate AML case.';
        }
      },
      error: (error) => {
        this.actionLoading = false;
        this.errorMessage = error?.error?.message || 'Failed to escalate AML case.';
      }
    });
  }

  closeCase(caseItem: AmlCaseItem): void {
    const caseId = caseItem.caseId || caseItem.caseNumber;

    if (!caseId) {
      this.errorMessage = 'Case ID is missing.';
      return;
    }

    const closureReason = window.prompt(
      `Closure reason for ${caseItem.caseNumber}:`,
      'AML investigation completed and case closed from UI.'
    );

    if (!closureReason) {
      return;
    }

    this.actionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.amlCaseApi.closeCase(caseId, {
      closureReason,
      actionBy: 'Officer Nix'
    }).subscribe({
      next: (response) => {
        this.actionLoading = false;

        if (response.success) {
          this.successMessage = response.message || 'AML case closed successfully.';
          this.loadData();
        } else {
          this.errorMessage = response.message || 'Failed to close AML case.';
        }
      },
      error: (error) => {
        this.actionLoading = false;
        this.errorMessage = error?.error?.message || 'Failed to close AML case.';
      }
    });
  }

  getResidentWalletText(caseItem: AmlCaseItem): string {
    const residentName = caseItem.resident?.fullName;
    const wallet = caseItem.walletAddress || caseItem.wallet?.address;

    if (residentName && wallet) {
      return `${residentName} / ${wallet}`;
    }

    return residentName || wallet || 'N/A';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'N/A';
    }

    return new Date(value).toLocaleString();
  }

  getBadgeClass(value: string | null | undefined): string {
    const normalized = String(value || '').toLowerCase();

    if (normalized.includes('high') || normalized.includes('escalated')) {
      return 'danger';
    }

    if (normalized.includes('medium') || normalized.includes('review') || normalized.includes('open')) {
      return 'warning';
    }

    if (normalized.includes('closed') || normalized.includes('low')) {
      return 'success';
    }

    return 'info';
  }

  canEscalate(caseItem: AmlCaseItem): boolean {
    return caseItem.status !== 'Escalated' && caseItem.status !== 'Closed';
  }

  canClose(caseItem: AmlCaseItem): boolean {
    return caseItem.status !== 'Closed';
  }
}
