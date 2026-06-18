import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface AmlRulesCards {
  amlRulesCount: number;
  amlRulesUpdatedToday: number;
  amlRulesCreatedToday: number;
  activeAmlRules: number;
  expiredAmlRules: number;
}

interface AmlRuleRecord {
  rule_id: string;
  rule_query_id: string;
  fabric_ledger_key: string;
  rule_desc: string;
  rule_status: string;
  computed_rule_status: string;
  sync_status: string;
  fabric_status: string;
  fabric_tx_id: string;
  rule_creation_date: string;
  rule_update_date: string;
  rule_expiry_date: string;
  last_submitted_at: string;
}

@Component({
  selector: 'app-valoores-aml-rules-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './valoores-aml-rules-dashboard.html',
  styleUrl: './valoores-aml-rules-dashboard.scss',
})
export class ValooresAmlRulesDashboard implements OnInit {
  private readonly http = inject(HttpClient);

  loading = false;
  errorMessage = '';

  search = '';
  limit = 50;
  offset = 0;

  cards: AmlRulesCards = {
    amlRulesCount: 0,
    amlRulesUpdatedToday: 0,
    amlRulesCreatedToday: 0,
    activeAmlRules: 0,
    expiredAmlRules: 0,
  };

  records: AmlRuleRecord[] = [];

  pagination = {
    total: 0,
    returned: 0,
    limit: 50,
    offset: 0,
  };

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';

    const params = new URLSearchParams({
      limit: String(this.limit),
      offset: String(this.offset),
    });

    if (this.search.trim()) {
      params.set('search', this.search.trim());
    }

    this.http
      .get<any>(`/api/v1/government-blockchain/valoores-aml-rules/dashboard?${params.toString()}`)
      .subscribe({
        next: (response) => {
          const data = response?.data || {};
          this.cards = data.cards || this.cards;
          this.records = data.records || [];
          this.pagination = data.pagination || this.pagination;
          this.loading = false;
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.message ||
            error?.message ||
            'Failed to load AML Rules Dashboard.';
          this.loading = false;
        },
      });
  }

  refresh(): void {
    this.loadDashboard();
  }

  searchNow(): void {
    this.offset = 0;
    this.loadDashboard();
  }

  clearSearch(): void {
    this.search = '';
    this.offset = 0;
    this.loadDashboard();
  }

  nextPage(): void {
    if (this.offset + this.limit < this.pagination.total) {
      this.offset += this.limit;
      this.loadDashboard();
    }
  }

  previousPage(): void {
    this.offset = Math.max(this.offset - this.limit, 0);
    this.loadDashboard();
  }

  getStatusClass(status: string | null | undefined): string {
    const value = String(status || '').toUpperCase();

    if (value === 'ACTIVE' || value === 'SYNCED' || value === 'CONFIRMED') {
      return 'status-success';
    }

    if (value === 'EXPIRED' || value === 'FAILED') {
      return 'status-danger';
    }

    return 'status-muted';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  shortText(value: string | null | undefined, size = 70): string {
    if (!value) {
      return '-';
    }

    return value.length > size ? `${value.slice(0, size)}...` : value;
  }
}
