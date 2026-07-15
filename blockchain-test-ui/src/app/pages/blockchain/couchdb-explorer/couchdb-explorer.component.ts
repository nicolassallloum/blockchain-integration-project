import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CouchDbDatabase,
  CouchDbDocumentDetailsResponse,
  CouchDbDocumentRow,
  CouchDbExplorerService,
} from '../../../services/couchdb-explorer.service';

type DetailsTab = 'summary' | 'metadata' | 'json';

@Component({
  selector: 'app-couchdb-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './couchdb-explorer.component.html',
  styleUrls: ['./couchdb-explorer.component.scss'],
})
export class CouchdbExplorerComponent implements OnInit {
  databases: CouchDbDatabase[] = [];
  selectedDatabase: CouchDbDatabase | null = null;

  documents: CouchDbDocumentRow[] = [];
  selectedDocument: CouchDbDocumentDetailsResponse | null = null;

  defaultDatabase = '';
  activePanel: 'databases' | 'documents' | 'changes' = 'databases';
  detailsTab: DetailsTab = 'summary';

  loadingDatabases = false;
  loadingDocuments = false;
  loadingDocumentDetails = false;

  errorMessage = '';
  successMessage = '';
  warningMessage = '';

  search = '';
  docType = '';
  auditId = '';

  limit = 100;
  skip = 0;
  total: number | null = null;

  readonly docTypeOptions = [
    '',
    'AUDIT_EVENT_PROOF',
    'AUDIT_BATCH_PROOF',
    'KYC_PROOF',
    'AML_RULE_PROOF',
    'CUSTOMER_KYC_PROOF',
  ];

  constructor(private couchDbExplorerService: CouchDbExplorerService) {}

  ngOnInit(): void {
    this.loadDatabases();
  }

  loadDatabases(): void {
    this.loadingDatabases = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.couchDbExplorerService.getDatabases().subscribe({
      next: (response) => {
        this.databases = response.databases || [];
        this.defaultDatabase = response.defaultDatabase || '';
        this.loadingDatabases = false;

        const defaultDb = this.databases.find((db) => db.name === this.defaultDatabase);
        if (defaultDb) {
          this.openDatabase(defaultDb);
        }
      },
      error: (error) => {
        console.error('Failed to load CouchDB databases', error);
        this.errorMessage = error?.error?.message || 'Failed to load CouchDB databases';
        this.loadingDatabases = false;
      },
    });
  }

  openDatabase(database: CouchDbDatabase): void {
    this.selectedDatabase = database;
    this.activePanel = 'documents';
    this.skip = 0;
    this.documents = [];
    this.selectedDocument = null;
    this.loadDocuments();
  }

  loadDocuments(): void {
    if (!this.selectedDatabase) {
      return;
    }

    this.loadingDocuments = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.warningMessage = '';

    this.couchDbExplorerService
      .getDocuments(this.selectedDatabase.name, {
        search: this.search.trim(),
        docType: this.docType,
        auditId: this.auditId.trim(),
        limit: Number(this.limit),
        skip: Number(this.skip),
      })
      .subscribe({
        next: (response) => {
          this.documents = response.rows || [];
          this.total = response.total;
          this.warningMessage = response.warning || '';
          this.loadingDocuments = false;
        },
        error: (error) => {
          console.error('Failed to load CouchDB documents', error);
          this.errorMessage = error?.error?.message || 'Failed to load CouchDB documents';
          this.documents = [];
          this.loadingDocuments = false;
        },
      });
  }

  applyFilters(): void {
    this.skip = 0;
    this.loadDocuments();
  }

  resetFilters(): void {
    this.search = '';
    this.docType = '';
    this.auditId = '';
    this.skip = 0;
    this.loadDocuments();
  }

  nextPage(): void {
    this.skip = Number(this.skip) + Number(this.limit);
    this.loadDocuments();
  }

  previousPage(): void {
    this.skip = Math.max(0, Number(this.skip) - Number(this.limit));
    this.loadDocuments();
  }

  viewDocument(row: CouchDbDocumentRow): void {
    if (!this.selectedDatabase) {
      return;
    }

    this.loadingDocumentDetails = true;
    this.selectedDocument = null;
    this.detailsTab = 'summary';

    this.couchDbExplorerService.getDocument(this.selectedDatabase.name, row.id).subscribe({
      next: (response) => {
        this.selectedDocument = response;
        this.loadingDocumentDetails = false;
      },
      error: (error) => {
        console.error('Failed to load document details', error);
        this.errorMessage = error?.error?.message || 'Failed to load document details';
        this.loadingDocumentDetails = false;
      },
    });
  }

  closeDocument(): void {
    this.selectedDocument = null;
    this.detailsTab = 'summary';
  }

  setDetailsTab(tab: DetailsTab): void {
    this.detailsTab = tab;
  }

  copyText(value: string | undefined | null): void {
    const text = value || '';

    if (!text) {
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.successMessage = 'Copied to clipboard';
        setTimeout(() => (this.successMessage = ''), 1800);
      })
      .catch(() => {
        this.errorMessage = 'Copy failed';
      });
  }

  copyJson(value: any): void {
    this.copyText(this.formatJson(value));
  }

  formatJson(value: any): string {
    if (value === undefined || value === null) {
      return '-';
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  formatBytes(value: number | undefined | null): string {
    const bytes = Number(value || 0);

    if (bytes === 0) {
      return '0 bytes';
    }

    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, index);

    return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  shortHash(value: string | undefined | null, left = 12, right = 8): string {
    const text = value || '';

    if (!text) {
      return '-';
    }

    if (text.length <= left + right + 3) {
      return text;
    }

    return `${text.slice(0, left)}...${text.slice(-right)}`;
  }

  docLabel(row: CouchDbDocumentRow): string {
    return row.summary?.docType || row.doc?.docType || 'DOCUMENT';
  }

  trackByDatabase(index: number, item: CouchDbDatabase): string {
    return item.name;
  }

  trackByDocument(index: number, item: CouchDbDocumentRow): string {
    return item.id;
  }
}
