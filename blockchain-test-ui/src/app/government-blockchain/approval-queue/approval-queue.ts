import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

type ApprovalStatus = 'AUTO_APPROVED' | 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED';
type ApprovalRule = 'AUTO_APPROVE' | 'MANUAL_REVIEW';

interface ApprovalTransaction {
  id: string;
  transactionId: string;
  residentName: string;
  serviceName: string;
  ministryName: string;
  amountGov: number;
  currency: string;
  approvalRule: ApprovalRule;
  status: ApprovalStatus;
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

  readonly manualApprovalAmountLimit = 10000000;

  loading = signal(false);
  errorMessage = signal('');

  searchText = signal('');
  ministryFilter = signal('ALL');
  statusFilter = signal('ALL');
  approvalTypeFilter = signal('ALL');
  minAmount = signal<number | null>(null);
  maxAmount = signal<number | null>(null);

  transactions = signal<ApprovalTransaction[]>([]);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.http
      .get<any>(`${this.API_BASE}/government-blockchain/transactions`)
      .subscribe({
        next: (res) => {
          const rows = Array.isArray(res)
            ? res
            : Array.isArray(res?.data)
              ? res.data
              : Array.isArray(res?.transactions)
                ? res.transactions
                : Array.isArray(res?.rows)
                  ? res.rows
                  : [];

          const mapped = rows.map((row: any, index: number) =>
            this.mapTransaction(row, index)
          );

          this.transactions.set(mapped);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('[APPROVAL QUEUE LOAD ERROR]', err);
          this.errorMessage.set(
            'Failed to load transactions from database. Showing sample data.'
          );

          this.transactions.set(this.sampleTransactions());
          this.loading.set(false);
        },
      });
  }

  private mapTransaction(row: any, index: number): ApprovalTransaction {
    const serviceName =
      row.service_name ??
      row.government_service_name ??
      row.serviceName ??
      row.service?.service_name ??
      row.service?.serviceName ??
      row.service?.name ??
      row.service_title ??
      row.description ??
      'Government Service';

    const amount =
      Number(
        row.amount_gov ??
          row.amountGov ??
          row.gov_amount ??
          row.transaction_amount ??
          row.transactionAmount ??
          row.total_amount ??
          row.totalAmount ??
          row.payment_amount ??
          row.paymentAmount ??
          row.fee_amount ??
          row.feeAmount ??
          row.amount ??
          row.service?.fee_amount ??
          0
      ) || 0;

    const ministry = this.resolveMinistryName(row, serviceName);
    const rule = this.getApprovalRule(amount, ministry);

    const backendStatus = String(
      row.approval_status ??
        row.approvalStatus ??
        row.status ??
        row.transaction_status ??
        row.transactionStatus ??
        ''
    ).toUpperCase();

    let status: ApprovalStatus;

    if (backendStatus.includes('REJECT')) {
      status = 'REJECTED';
    } else if (backendStatus.includes('PENDING') || backendStatus.includes('REVIEW')) {
      status = rule === 'AUTO_APPROVE' ? 'AUTO_APPROVED' : 'PENDING_REVIEW';
    } else if (backendStatus.includes('APPROVED') || backendStatus.includes('SUCCESS')) {
      status = rule === 'AUTO_APPROVE' ? 'AUTO_APPROVED' : 'APPROVED';
    } else {
      status = rule === 'AUTO_APPROVE' ? 'AUTO_APPROVED' : 'PENDING_REVIEW';
    }

    return {
      id: String(
        row.id ??
          row.transaction_id ??
          row.transactionId ??
          row.transaction_public_id ??
          row.transaction_code ??
          index + 1
      ),
      transactionId:
        row.transaction_public_id ??
        row.transaction_code ??
        row.transaction_reference ??
        row.transactionRef ??
        row.transactionId ??
        row.transaction_id ??
        `TXN-${String(index + 1).padStart(6, '0')}`,
      residentName:
        row.resident_full_name ??
        row.resident_name ??
        row.full_name ??
        row.fullName ??
        row.residentName ??
        row.resident?.full_name ??
        row.resident?.fullName ??
        'Unknown Resident',
      serviceName,
      ministryName: ministry,
      amountGov: amount,
      currency: row.currency_code ?? row.currencyCode ?? row.currency ?? 'GOV',
      approvalRule: rule,
      status,
      selected: false,
    };
  }

  private resolveMinistryName(row: any, serviceName: string): string {
    const directMinistry =
      row.ministry_name ??
      row.ministryName ??
      row.ministry ??
      row.ministry_english_name ??
      row.english_name ??
      row.government_ministry_name ??
      row.government_ministry ??
      row.organization_name ??
      row.organizationName ??
      row.service_ministry_name ??
      row.serviceMinistryName ??
      row.service?.ministry_name ??
      row.service?.ministryName ??
      row.service?.ministry ??
      row.service?.government_ministry_name ??
      row.service?.government_ministry?.ministry_name ??
      row.service?.government_ministry?.english_name ??
      row.service?.governmentMinistry?.ministryName ??
      row.service?.governmentMinistry?.englishName ??
      row.ministry_data?.ministry_name ??
      row.ministry_data?.english_name ??
      row.ministryData?.ministryName ??
      row.ministryData?.englishName;

    if (directMinistry && String(directMinistry).trim() !== '') {
      return String(directMinistry).trim();
    }

    return this.extractMinistryFromServiceName(serviceName) ?? 'Unknown Ministry';
  }

  private extractMinistryFromServiceName(serviceName: string): string | null {
    const value = String(serviceName || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    if (!value) {
      return null;
    }

    if (value.includes('MINISTRY OF FINANCE') || value.includes('FINANCE TAX')) {
      return 'Ministry of Finance';
    }

    if (
      value.includes('MINISTRY OF INTERIOR') ||
      value.includes('MINISTRY OF INTERN') ||
      value.includes('INTERIOR')
    ) {
      return 'Ministry of Interior';
    }

    if (
      value.includes('MINISTRY OF DEFENCE') ||
      value.includes('MINISTRY OF DEFENSE') ||
      value.includes('DEFENCE') ||
      value.includes('DEFENSE')
    ) {
      return 'Ministry of Defence';
    }

    if (value.includes('MINISTRY OF HEALTH') || value.includes('HEALTH')) {
      return 'Ministry of Health';
    }

    if (value.includes('MINISTRY OF EDUCATION') || value.includes('EDUCATION')) {
      return 'Ministry of Education';
    }

    if (value.includes('MINISTRY OF LABOUR') || value.includes('MINISTRY OF LABOR')) {
      return 'Ministry of Labour';
    }

    if (value.includes('MINISTRY OF JUSTICE') || value.includes('JUSTICE')) {
      return 'Ministry of Justice';
    }

    if (
      value.includes('MINISTRY OF ENVIRONMENT') ||
      value.includes('ENVIRONMENT')
    ) {
      return 'Ministry of Environment';
    }

    if (value.includes('GENERAL SECURITY')) {
      return 'General Security';
    }

    if (value.includes('MUNICIPAL') || value.includes('MUNICIPALITIES')) {
      return 'Department of Municipalities';
    }

    return null;
  }

  private getApprovalRule(amount: number, ministryName: string): ApprovalRule {
    const normalizedMinistry = ministryName.toLowerCase();

    const isInterior =
      normalizedMinistry.includes('ministry of interior') ||
      normalizedMinistry.includes('intern') ||
      normalizedMinistry.includes('interior');

    const isDefence =
      normalizedMinistry.includes('ministry of defence') ||
      normalizedMinistry.includes('ministry of defense') ||
      normalizedMinistry.includes('defence') ||
      normalizedMinistry.includes('defense');

    if (amount > this.manualApprovalAmountLimit || isInterior || isDefence) {
      return 'MANUAL_REVIEW';
    }

    return 'AUTO_APPROVE';
  }

  filteredTransactions = computed(() => {
    const search = this.searchText().trim().toLowerCase();
    const ministry = this.ministryFilter();
    const status = this.statusFilter();
    const approvalType = this.approvalTypeFilter();
    const min = this.minAmount();
    const max = this.maxAmount();

    return this.transactions().filter((tx) => {
      const matchesSearch =
        !search ||
        tx.transactionId.toLowerCase().includes(search) ||
        tx.residentName.toLowerCase().includes(search) ||
        tx.serviceName.toLowerCase().includes(search) ||
        tx.ministryName.toLowerCase().includes(search);

      const matchesMinistry =
        ministry === 'ALL' || tx.ministryName === ministry;

      const matchesStatus = status === 'ALL' || tx.status === status;

      const matchesApprovalType =
        approvalType === 'ALL' || tx.approvalRule === approvalType;

      const matchesMinAmount = min === null || tx.amountGov >= min;
      const matchesMaxAmount = max === null || tx.amountGov <= max;

      return (
        matchesSearch &&
        matchesMinistry &&
        matchesStatus &&
        matchesApprovalType &&
        matchesMinAmount &&
        matchesMaxAmount
      );
    });
  });

  ministries = computed(() => {
    return Array.from(
      new Set(this.transactions().map((tx) => tx.ministryName))
    ).sort();
  });

  totalTransactions = computed(() => this.transactions().length);

  requiresApproval = computed(
    () =>
      this.transactions().filter((tx) => tx.status === 'PENDING_REVIEW').length
  );

  autoApproved = computed(
    () =>
      this.transactions().filter(
        (tx) => tx.status === 'AUTO_APPROVED' || tx.status === 'APPROVED'
      ).length
  );

  rejectedToday = computed(
    () => this.transactions().filter((tx) => tx.status === 'REJECTED').length
  );

  hasSelectedPending = computed(() =>
    this.filteredTransactions().some(
      (tx) => tx.selected && tx.status === 'PENDING_REVIEW'
    )
  );

  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const visibleIds = new Set(this.filteredTransactions().map((tx) => tx.id));

    this.transactions.update((items) =>
      items.map((tx) => {
        if (visibleIds.has(tx.id) && tx.status === 'PENDING_REVIEW') {
          return { ...tx, selected: checked };
        }

        return tx;
      })
    );
  }

  approve(tx: ApprovalTransaction): void {
    if (tx.status !== 'PENDING_REVIEW') return;

    this.updateLocalStatus(tx.id, 'APPROVED');

    this.http
      .patch(`${this.API_BASE}/government-blockchain/transactions/${tx.id}/approval`, {
        approvalStatus: 'APPROVED',
        approvalDecision: 'APPROVE',
      })
      .subscribe({
        error: (err) => {
          console.warn('[APPROVE API WARNING]', err);
        },
      });
  }

  reject(tx: ApprovalTransaction): void {
    if (tx.status !== 'PENDING_REVIEW') return;

    this.updateLocalStatus(tx.id, 'REJECTED');

    this.http
      .patch(`${this.API_BASE}/government-blockchain/transactions/${tx.id}/approval`, {
        approvalStatus: 'REJECTED',
        approvalDecision: 'REJECT',
      })
      .subscribe({
        error: (err) => {
          console.warn('[REJECT API WARNING]', err);
        },
      });
  }

  approveSelected(): void {
    const selected = this.transactions().filter(
      (tx) => tx.selected && tx.status === 'PENDING_REVIEW'
    );

    selected.forEach((tx) => this.approve(tx));
  }

  private updateLocalStatus(id: string, status: ApprovalStatus): void {
    this.transactions.update((items) =>
      items.map((tx) =>
        tx.id === id
          ? {
              ...tx,
              status,
              selected: false,
            }
          : tx
      )
    );
  }

  clearFilters(): void {
    this.searchText.set('');
    this.ministryFilter.set('ALL');
    this.statusFilter.set('ALL');
    this.approvalTypeFilter.set('ALL');
    this.minAmount.set(null);
    this.maxAmount.set(null);
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  approvalRuleLabel(rule: ApprovalRule): string {
    return rule === 'AUTO_APPROVE' ? 'Auto Approve' : 'Manual Review';
  }

  statusLabel(status: ApprovalStatus): string {
    switch (status) {
      case 'AUTO_APPROVED':
        return 'Auto Approved';
      case 'APPROVED':
        return 'Approved';
      case 'PENDING_REVIEW':
        return 'Pending Review';
      case 'REJECTED':
        return 'Rejected';
      default:
        return status;
    }
  }

  private sampleTransactions(): ApprovalTransaction[] {
    const rows = [
      {
        id: '1',
        transactionId: 'TXN-0002451',
        residentName: 'Rami Haddad',
        serviceName: 'Driving License Renewal',
        ministryName: 'Ministry of Health',
        amountGov: 4250000,
      },
      {
        id: '2',
        transactionId: 'TXN-0002452',
        residentName: 'Nour Salem',
        serviceName: 'Birth Certificate',
        ministryName: 'Ministry of Education',
        amountGov: 2150000,
      },
      {
        id: '3',
        transactionId: 'TXN-0002453',
        residentName: 'Karim Mansour',
        serviceName: 'Business License',
        ministryName: 'Department of Economic Development',
        amountGov: 12750000,
      },
      {
        id: '4',
        transactionId: 'TXN-0002454',
        residentName: 'Layla Khoury',
        serviceName: 'Passport Renewal',
        ministryName: 'Ministry of Interior',
        amountGov: 3200000,
      },
      {
        id: '5',
        transactionId: 'TXN-0002455',
        residentName: 'Khalil Haddad',
        serviceName: 'Residence Visa',
        ministryName: 'Ministry of Labour',
        amountGov: 6800000,
      },
      {
        id: '6',
        transactionId: 'TXN-0002456',
        residentName: 'Hasan Bloushi',
        serviceName: 'Contract Registration',
        ministryName: 'Housing Authority',
        amountGov: 950000,
      },
      {
        id: '7',
        transactionId: 'TXN-0002457',
        residentName: 'Saeed Maktoum',
        serviceName: 'Vehicle Registration',
        ministryName: 'Ministry of Defence',
        amountGov: 2450000,
      },
      {
        id: '8',
        transactionId: 'TXN-0002458',
        residentName: 'Noora Muhairi',
        serviceName: 'Land Ownership Transfer',
        ministryName: 'Department of Municipalities',
        amountGov: 15900000,
      },
      {
        id: '9',
        transactionId: 'TXN-0002459',
        residentName: 'Yousef Kaabi',
        serviceName: 'Professional License',
        ministryName: 'Department of Economic Development',
        amountGov: 8750000,
      },
      {
        id: '10',
        transactionId: 'TXN-0002460',
        residentName: 'Mariam Shamsi',
        serviceName: 'Import Permit',
        ministryName: 'Ministry of Environment',
        amountGov: 11200000,
      },
    ];

    return rows.map((row, index) => {
      const rule = this.getApprovalRule(row.amountGov, row.ministryName);

      return {
        ...row,
        currency: 'GOV',
        approvalRule: rule,
        status:
          index === 9
            ? 'REJECTED'
            : rule === 'AUTO_APPROVE'
              ? 'AUTO_APPROVED'
              : 'PENDING_REVIEW',
        selected: false,
      };
    });
  }
}
