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

  limit = 50;
  skip = 0;

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
          this.selectedDatabase = this.databases[0];
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
          this.records = response.data.documents || [];
          this.totalRows = response.data.totalRows || 0;
          this.returned = response.data.returned || 0;
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
    this.loadRecords();
  }

  resetFilters(): void {
    this.searchText = '';
    this.documentType = '';
    this.status = '';
    this.skip = 0;
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
      'Not Defined'
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
      'Not Defined'
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

  copyJson(): void {
    if (!this.selectedRecord) {
      return;
    }

    navigator.clipboard.writeText(this.getJson(this.selectedRecord));
  }
}
