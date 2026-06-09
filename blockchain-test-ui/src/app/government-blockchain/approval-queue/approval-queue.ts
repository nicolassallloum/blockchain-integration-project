import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

type ApprovalStatus = 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED';
type BlockchainStatus =
  | 'PENDING'
  | 'Submitting to Blockchain'
  | 'Blockchain Confirmed'
  | 'Submitted to Blockchain'
  | 'Blockchain Failed'
  | 'Not Submitted'
  | string;

interface ApprovalTransaction {
  id: string;
  transactionId: string;
  residentName: string;
  serviceName: string;
  totalFees: number;
  currency: string;
  paymentMethod: string;
  submittedDate: string;
  status: ApprovalStatus;
  blockchainStatus: BlockchainStatus;
  blockchainTxId?: string | null;
  blockchainError?: string | null;
  selected?: boolean;
}

@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './approval-queue.html',
  styleUrl: './approval-queue.scss',
})
export class ApprovalQueue implements OnInit {
  private readonly API_BASE = 'http://172.31.13.90:3001/api/v1';
  private readonly APPROVAL_QUEUE_URL =
    `${this.API_BASE}/government-blockchain/approval-queue`;

  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  searchText = signal('');
  paymentMethodFilter = signal('ALL');

  transactions = signal<ApprovalTransaction[]>([]);
  approvingIds = signal<Record<string, boolean>>({});
  rejectingIds = signal<Record<string, boolean>>({});
  selectedTransaction = signal<ApprovalTransaction | null>(null);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.http.get<any>(this.APPROVAL_QUEUE_URL).subscribe({
      next: (res) => {
        const rows = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : [];

        this.transactions.set(
          rows.map((row: any, index: number) => this.mapTransaction(row, index))
        );

        this.loading.set(false);
      },
      error: (err) => {
        console.error('[APPROVAL QUEUE LOAD ERROR]', err);
        this.errorMessage.set(
          err?.error?.message ||
            'Failed to load approval queue from PostgreSQL.'
        );
        this.transactions.set([]);
        this.loading.set(false);
      },
    });
  }

  private mapTransaction(row: any, index: number): ApprovalTransaction {
    const id = String(
      row.transaction_id ??
        row.id ??
        row.transactionId ??
        row.transaction_reference ??
        index + 1
    );

    return {
      id,
      transactionId:
        row.transaction_reference ??
        row.transactionReference ??
        row.transaction_public_id ??
        row.transaction_code ??
        id,
      residentName:
        row.resident_full_name ??
        row.resident_name ??
        row.full_name ??
        row.fullName ??
        row.residentName ??
        'Unknown Resident',
      serviceName:
        row.service_name ??
        row.government_service_name ??
        row.serviceName ??
        row.service_code ??
        'Government Service',
      totalFees:
        Number(
          row.total_fees ??
            row.total_fee ??
            row.totalFees ??
            row.amount ??
            row.transaction_amount ??
            0
        ) || 0,
      currency: 'GOV',
      paymentMethod: row.payment_method ?? row.paymentMethod ?? '-',
      submittedDate: row.created_at ?? row.submitted_date ?? row.createdAt ?? '',
      status: this.normalizeStatus(row.transaction_status ?? row.status),
      blockchainStatus: row.blockchain_status ?? 'PENDING',
      blockchainTxId: row.blockchain_tx_id ?? null,
      blockchainError: row.blockchain_error ?? null,
      selected: false,
    };
  }

  private normalizeStatus(value: any): ApprovalStatus {
    const status = String(value || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

    if (status === 'APPROVED') {
      return 'APPROVED';
    }

    if (status === 'REJECTED') {
      return 'REJECTED';
    }

    return 'PENDING_REVIEW';
  }

  filteredTransactions = computed(() => {
    const search = this.searchText().trim().toLowerCase();
    const paymentMethod = this.paymentMethodFilter();

    return this.transactions().filter((tx) => {
      const matchesSearch =
        !search ||
        tx.transactionId.toLowerCase().includes(search) ||
        tx.residentName.toLowerCase().includes(search) ||
        tx.serviceName.toLowerCase().includes(search) ||
        tx.paymentMethod.toLowerCase().includes(search);

      const matchesPayment =
        paymentMethod === 'ALL' || tx.paymentMethod === paymentMethod;

      return matchesSearch && matchesPayment;
    });
  });

  paymentMethods = computed(() => {
    return Array.from(
      new Set(
        this.transactions()
          .map((tx) => tx.paymentMethod)
          .filter((value) => value && value !== '-')
      )
    ).sort();
  });

  totalTransactions = computed(() => this.transactions().length);

  pendingCount = computed(
    () => this.transactions().filter((tx) => tx.status === 'PENDING_REVIEW').length
  );

  approvingCount = computed(
    () => Object.values(this.approvingIds()).filter(Boolean).length
  );

  failedBlockchainCount = computed(
    () =>
      this.transactions().filter(
        (tx) => String(tx.blockchainStatus).toLowerCase() === 'blockchain failed'
      ).length
  );

  hasSelectedPending = computed(() =>
    this.filteredTransactions().some(
      (tx) => tx.selected && tx.status === 'PENDING_REVIEW'
    )
  );

  isApproving(tx: ApprovalTransaction): boolean {
    return Boolean(this.approvingIds()[tx.id]);
  }

  isRejecting(tx: ApprovalTransaction): boolean {
    return Boolean(this.rejectingIds()[tx.id]);
  }

  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const visibleIds = new Set(this.filteredTransactions().map((tx) => tx.id));

    this.transactions.update((items) =>
      items.map((tx) =>
        visibleIds.has(tx.id) && tx.status === 'PENDING_REVIEW'
          ? { ...tx, selected: checked }
          : tx
      )
    );
  }

  viewDetails(tx: ApprovalTransaction): void {
    this.selectedTransaction.set(tx);
  }

  closeDetails(): void {
    this.selectedTransaction.set(null);
  }

  approve(tx: ApprovalTransaction): void {
    if (tx.status !== 'PENDING_REVIEW' || this.isApproving(tx)) {
      return;
    }

    const confirmed = window.confirm(
      `Approve transaction ${tx.transactionId} and submit proof to Blockchain?`
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.approvingIds.update((state) => ({ ...state, [tx.id]: true }));

    this.http
      .post<any>(`${this.APPROVAL_QUEUE_URL}/${encodeURIComponent(tx.id)}/approve`, {
        approvedBy: 'approval-officer',
        officerUsername: 'approval-officer',
      })
      .subscribe({
        next: (res) => {
          if (res?.warning) {
            this.successMessage.set(
              res.message ||
                'Transaction approved, but Blockchain submission failed.'
            );
          } else {
            this.successMessage.set(
              res?.message ||
                'Transaction approved and submitted to Blockchain successfully.'
            );
          }

          this.approvingIds.update((state) => {
            const copy = { ...state };
            delete copy[tx.id];
            return copy;
          });

          this.loadTransactions();
        },
        error: (err) => {
          console.error('[APPROVAL QUEUE APPROVE ERROR]', err);

          this.errorMessage.set(
            err?.error?.message || 'Failed to approve transaction.'
          );

          this.approvingIds.update((state) => {
            const copy = { ...state };
            delete copy[tx.id];
            return copy;
          });
        },
      });
  }

  reject(tx: ApprovalTransaction): void {
    if (tx.status !== 'PENDING_REVIEW' || this.isRejecting(tx)) {
      return;
    }

    const reason = window.prompt(
      `Reject transaction ${tx.transactionId}. Enter rejection reason:`,
      'Rejected by approval officer'
    );

    if (reason === null) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.rejectingIds.update((state) => ({ ...state, [tx.id]: true }));

    this.http
      .post<any>(`${this.APPROVAL_QUEUE_URL}/${encodeURIComponent(tx.id)}/reject`, {
        reason: reason || 'Rejected by approval officer',
      })
      .subscribe({
        next: (res) => {
          this.successMessage.set(
            res?.message || 'Transaction rejected successfully.'
          );

          this.rejectingIds.update((state) => {
            const copy = { ...state };
            delete copy[tx.id];
            return copy;
          });

          this.loadTransactions();
        },
        error: (err) => {
          console.error('[APPROVAL QUEUE REJECT ERROR]', err);

          this.errorMessage.set(
            err?.error?.message || 'Failed to reject transaction.'
          );

          this.rejectingIds.update((state) => {
            const copy = { ...state };
            delete copy[tx.id];
            return copy;
          });
        },
      });
  }

  approveSelected(): void {
    const selected = this.transactions().filter(
      (tx) => tx.selected && tx.status === 'PENDING_REVIEW'
    );

    if (selected.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Approve ${selected.length} selected transaction(s)?`
    );

    if (!confirmed) {
      return;
    }

    selected.forEach((tx) => this.approveWithoutPrompt(tx));
  }

  private approveWithoutPrompt(tx: ApprovalTransaction): void {
    if (tx.status !== 'PENDING_REVIEW' || this.isApproving(tx)) {
      return;
    }

    this.approvingIds.update((state) => ({ ...state, [tx.id]: true }));

    this.http
      .post<any>(`${this.APPROVAL_QUEUE_URL}/${encodeURIComponent(tx.id)}/approve`, {
        approvedBy: 'approval-officer',
        officerUsername: 'approval-officer',
      })
      .subscribe({
        next: () => {
          this.approvingIds.update((state) => {
            const copy = { ...state };
            delete copy[tx.id];
            return copy;
          });

          this.loadTransactions();
        },
        error: (err) => {
          console.error('[APPROVAL QUEUE BULK APPROVE ERROR]', err);
          this.errorMessage.set(
            err?.error?.message || 'One selected transaction failed approval.'
          );

          this.approvingIds.update((state) => {
            const copy = { ...state };
            delete copy[tx.id];
            return copy;
          });
        },
      });
  }

  clearFilters(): void {
    this.searchText.set('');
    this.paymentMethodFilter.set('ALL');
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  formatDate(value: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  statusLabel(status: ApprovalStatus): string {
    if (status === 'PENDING_REVIEW') {
      return 'Pending Review';
    }

    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  paymentMethodLabel(value: string): string {
    return String(value || '-').replace(/_/g, ' ');
  }

  blockchainBadgeClass(value: string): string {
    const normalized = String(value || '').toLowerCase();

    if (normalized.includes('confirmed') || normalized.includes('submitted')) {
      return 'success';
    }

    if (normalized.includes('failed')) {
      return 'danger';
    }

    if (normalized.includes('submitting')) {
      return 'warning';
    }

    return 'info';
  }
}
