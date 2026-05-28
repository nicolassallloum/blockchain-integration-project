import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CouchDbCountsResponse,
  CouchDbDatabaseCount,
  CouchDbExplorerService,
  CouchDbStatus,
} from '../services/couchdb-explorer.service';

@Component({
  selector: 'app-couchdb-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './couchdb-explorer.component.html',
  styleUrl: './couchdb-explorer.component.scss',
})
export class CouchDbExplorerComponent implements OnInit {
  loading = false;
  statusLoading = false;
  countsLoading = false;

  errorMessage = '';

  couchStatus: CouchDbStatus | null = null;
  databases: string[] = [];
  databaseCounts: CouchDbDatabaseCount[] = [];

  selectedDatabase = '';

  records: any[] = [];
  selectedRecord: any = null;

  counts: CouchDbCountsResponse | null = null;

  totalRows = 0;
  returned = 0;

  searchText = '';
  documentType = '';
  status = '';

  limit = 25;
  skip = 0;

  activeQuickFilter = 'ALL';
  sortField: 'createdAt' = 'createdAt';
  sortDirection: 'DESC' | 'ASC' = 'DESC';
  constructor(private couchDbService: CouchDbExplorerService) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loadStatus();
    this.loadDatabases();
    this.loadDatabaseCounts();
  }

  loadStatus(): void {
    this.statusLoading = true;

    this.couchDbService.getStatus().subscribe({
      next: (response) => {
        this.couchStatus = response.data;
        this.statusLoading = false;
      },
      error: () => {
        this.couchStatus = null;
        this.statusLoading = false;
      },
    });
  }

  loadDatabases(): void {
    this.loading = true;
    this.errorMessage = '';

    this.couchDbService.getDatabases().subscribe({
      next: (response) => {
        this.databases = response.data || [];

        if (this.databases.length > 0 && !this.selectedDatabase) {
          const mainLedgerDb = this.databases.find((db) =>
            db.includes('kyc-wallet-chaincode-js')
          );

          this.selectedDatabase = mainLedgerDb || this.databases[0];

          this.loadRecords();
          this.loadCounts();
        }

        this.loading = false;
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message ||
          'Failed to load CouchDB databases. Please check backend and CouchDB connection.';
        this.loading = false;
      },
    });
  }

  loadDatabaseCounts(): void {
    this.couchDbService.getDatabaseCounts().subscribe({
      next: (response) => {
        this.databaseCounts = response.data || [];
      },
      error: () => {
        this.databaseCounts = [];
      },
    });
  }

  onDatabaseChange(): void {
    this.skip = 0;
    this.records = [];
    this.selectedRecord = null;
    this.totalRows = 0;
    this.returned = 0;
    this.activeQuickFilter = 'ALL';
    this.searchText = '';
    this.documentType = '';
    this.status = '';

    this.loadRecords();
    this.loadCounts();
  }

  loadRecords(): void {
    if (!this.selectedDatabase) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.couchDbService
      .getDocuments(this.selectedDatabase, {
        limit: this.limit,
        skip: this.skip,
        search: this.searchText,
        documentType: this.documentType,
        status: this.status,
      })
      .subscribe({
        next: (response) => {
          this.records = this.sortRecordsByCreatedAt(response.data.documents || []);
          this.totalRows = response.data.totalRows || 0;
          this.returned = this.records.length;
          this.loading = false;
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.message ||
            'Failed to load CouchDB records. Please verify the selected database.';
          this.loading = false;
        },
      });
  }

  loadCounts(): void {
    if (!this.selectedDatabase) {
      return;
    }

    this.countsLoading = true;

    this.couchDbService.getCounts(this.selectedDatabase).subscribe({
      next: (response) => {
        this.counts = response.data;
        this.countsLoading = false;
      },
      error: () => {
        this.counts = null;
        this.countsLoading = false;
      },
    });
  }

  applyFilters(): void {
    this.skip = 0;
    this.activeQuickFilter = 'CUSTOM';
    this.loadRecords();
  }

  resetFilters(): void {
    this.searchText = '';
    this.documentType = '';
    this.status = '';
    this.skip = 0;
    this.activeQuickFilter = 'ALL';
    this.loadRecords();
  }

  applyQuickFilter(filter: string): void {
    this.activeQuickFilter = filter;
    this.searchText = '';
    this.documentType = '';
    this.status = '';
    this.skip = 0;

    if (filter === 'ALL') {
      this.documentType = '';
      this.status = '';
    }

    if (filter === 'WALLETS') {
      this.documentType = 'wallet';
    }

    if (filter === 'TRANSACTIONS') {
      this.documentType = 'transaction';
    }

    if (filter === 'ORGANIZATIONS') {
      this.documentType = 'organization';
    }

    if (filter === 'UNKNOWN') {
      this.documentType = 'UNKNOWN';
    }

    this.loadRecords();
  }

  refresh(): void {
    this.loadStatus();
    this.loadDatabaseCounts();
    this.loadRecords();
    this.loadCounts();
  }

  nextPage(): void {
    if (this.skip + this.limit >= this.totalRows) {
      return;
    }

    this.skip = this.skip + this.limit;
    this.loadRecords();
  }

  previousPage(): void {
    this.skip = Math.max(0, this.skip - this.limit);
    this.loadRecords();
  }

  viewRecord(record: any): void {
    this.selectedRecord = record;
  }

  closeRecord(): void {
    this.selectedRecord = null;
  }

  getRecordId(record: any): string {
    return record?._id || record?.id || record?.documentId || 'N/A';
  }

  getRecordType(record: any): string {
    return (
      record?._ui_docType ||
      record?.docType ||
      record?.type ||
      record?.objectType ||
      record?.recordType ||
      record?.documentType ||
      record?.assetType ||
      'UNKNOWN'
    );
  }

  getRecordStatus(record: any): string {
    return (
      record?._ui_status ||
      record?.status ||
      record?.blockchainStatus ||
      record?.transactionStatus ||
      record?.walletStatus ||
      record?.institutionStatus ||
      record?.approvalStatus ||
      'UNKNOWN'
    );
  }

  getCreatedAt(record: any): string {
    return (
      record?._ui_createdAt ||
      record?.createdAt ||
      record?.created_at ||
      record?.timestamp ||
      record?.txTimestamp ||
      record?.createdDate ||
      record?.createdOn ||
      'N/A'
    );
  }

  getRevision(record: any): string {
    return record?._rev || 'N/A';
  }

  getJson(value: any): string {
    return JSON.stringify(value, null, 2);
  }

  getObjectKeys(value: Record<string, number> | undefined | null): string[] {
    if (!value) {
      return [];
    }

    return Object.keys(value);
  }

  getDatabaseDocumentCount(database: string): number {
    const found = this.databaseCounts.find((item) => item.database === database);
    return found?.documentCount || 0;
  }

  getDocTypeCount(type: string): number {
    return this.counts?.byDocType?.[type] || 0;
  }

  getStatusCount(status: string): number {
    return this.counts?.byStatus?.[status] || 0;
  }

  getWalletRecordsCount(): number {
    return this.getDocTypeCount('wallet');
  }

  getTransactionRecordsCount(): number {
    return this.getDocTypeCount('transaction');
  }

  getOrganizationRecordsCount(): number {
    return this.getDocTypeCount('organization');
  }

  getUnknownRecordsCount(): number {
    return this.getDocTypeCount('UNKNOWN');
  }

  getActiveRecordsCount(): number {
    return this.getStatusCount('ACTIVE');
  }

  getSuccessfulTransactionsCount(): number {
    return this.getStatusCount('SUCCESS');
  }


  sortRecordsByCreatedAt(records: any[]): any[] {
    return [...records].sort((a, b) => {
      const dateA = this.getCreatedAtTimestamp(a);
      const dateB = this.getCreatedAtTimestamp(b);

      if (this.sortDirection === 'ASC') {
        return dateA - dateB;
      }

      return dateB - dateA;
    });
  }

  getCreatedAtTimestamp(record: any): number {
    const createdAt =
      record?._ui_createdAt ||
      record?.createdAt ||
      record?.created_at ||
      record?.timestamp ||
      record?.txTimestamp ||
      record?.createdDate ||
      record?.createdOn;

    if (!createdAt || createdAt === 'N/A') {
      return 0;
    }

    const timestamp = new Date(createdAt).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

toggleCreatedAtSort(): void {
  this.sortDirection = this.sortDirection === 'DESC' ? 'ASC' : 'DESC';
  this.records = this.sortRecordsByCreatedAt(this.records);
}


  copyJson(): void {
    if (!this.selectedRecord) {
      return;
    }

    navigator.clipboard.writeText(this.getJson(this.selectedRecord));
  }

  exportJson(): void {
    if (!this.records || this.records.length === 0) {
      alert('No records available to export.');
      return;
    }

    const exportPayload = {
      database: this.selectedDatabase,
      exportedAt: new Date().toISOString(),
      totalRows: this.totalRows,
      displayedRecords: this.records.length,
      activeQuickFilter: this.activeQuickFilter,
      filters: {
        searchText: this.searchText,
        documentType: this.documentType,
        status: this.status,
        limit: this.limit,
        skip: this.skip,
      },
      records: this.records,
    };

    const jsonContent = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonContent], {
      type: 'application/json;charset=utf-8;',
    });

    this.downloadFile(
      blob,
      `couchdb-export-${this.selectedDatabase}-${this.getExportTimestamp()}.json`
    );
  }

  exportCsv(): void {
    if (!this.records || this.records.length === 0) {
      alert('No records available to export.');
      return;
    }

    const headers = [
      'Document ID',
      'Document Type',
      'Status',
      'Created At',
      'Revision',
      'Transaction ID',
      'Wallet Address',
      'Customer ID',
      'Organization ID',
      'Amount',
      'Currency',
      'Transaction Type',
    ];

    const rows = this.records.map((record) => {
      return [
        this.getRecordId(record),
        this.getRecordType(record),
        this.getRecordStatus(record),
        this.getCreatedAt(record),
        this.getRevision(record),
        record?.transactionId || '',
        record?.walletAddress || record?.toWalletAddress || record?.fromWalletAddress || '',
        record?.customerId || '',
        record?.organizationId || '',
        record?.amount ?? '',
        record?.currency || '',
        record?.transactionType || '',
      ];
    });

    const csvContent = [
      headers,
      ...rows,
    ]
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    this.downloadFile(
      blob,
      `couchdb-export-${this.selectedDatabase}-${this.getExportTimestamp()}.csv`
    );
  }

  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value).replace(/"/g, '""');

    return `"${stringValue}"`;
  }

  private downloadFile(blob: Blob, filename: string): void {
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = downloadUrl;
    link.download = filename;
    link.click();

    window.URL.revokeObjectURL(downloadUrl);
  }

  private getExportTimestamp(): string {
    return new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-');
  }
}