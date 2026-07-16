import { finalize, timeout } from 'rxjs';
import { CommonModule } from '@angular/common';
import {Component, OnInit, ChangeDetectorRef} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
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
  stableDocumentModalOpen = false;
  stableDocumentLoading = false;
  stableDocumentError = '';
  stableDocumentData: any = null;

  documentModalOpen = false;

  pageTitle = 'Valoores Audit Logs';
  databases: CouchDbDatabase[] = [];
  selectedDatabase: CouchDbDatabase | null = null;

  documents: CouchDbDocumentRow[] = [];
  selectedDocument: CouchDbDocumentDetailsResponse | null = null;

  
  selectedDocumentLoading = false;
  selectedDocumentError = '';
  selectedDocumentTimeout: ReturnType<typeof setTimeout> | null = null;
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

  constructor(private couchDbExplorerService: CouchDbExplorerService,
    private titleService: Title, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.setPageTitle();
    this.loadDatabases();
  }


  private finishDocumentLoading(): void {
    this.selectedDocumentLoading = false;
  }

  setPageTitle(extra?: string): void {
    const title = extra ? `${this.pageTitle} - ${extra}` : this.pageTitle;
    this.titleService.setTitle(title);
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
        this.selectedDocumentError = error?.error?.message || error?.message || 'Failed to load document details.';
        this.selectedDocumentLoading = false;
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
        this.selectedDocumentLoading = false;
        if (this.selectedDocumentTimeout) { clearTimeout(this.selectedDocumentTimeout); }
    this.setPageTitle(database.name);
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

  private getRealCouchDbDocumentId(row: CouchDbDocumentRow): string {
    const rawId = row?.id || '';
    const summary = (row as any)?.summary || {};

    const auditId =
      summary.auditId ||
      summary.audit_id ||
      rawId.match(/AUDIT-[A-Za-z0-9-]+/)?.[0];

    if (rawId.startsWith('audit_event_proof:')) {
      return rawId;
    }

    if (
      auditId &&
      (
        rawId.includes('auditEventProof') ||
        rawId.includes('AUDIT_EVENT_PROOF') ||
        summary.docType === 'AUDIT_EVENT_PROOF' ||
        summary.doc_type === 'AUDIT_EVENT_PROOF'
      )
    ) {
      return `audit_event_proof:${auditId}`;
    }

    return rawId;
  }

  closeDocumentDetails(): void {
    this.selectedDocument = null;
    this.selectedDocumentError = '';
    this.loadingDocumentDetails = false;
    this.selectedDocumentLoading = false;
    this.setPageTitle(this.selectedDatabase?.name);
  }

  async viewDocument(row: CouchDbDocumentRow): Promise<void> {
    if (!this.selectedDatabase) {
      return;
    }

    const documentId = this.getRealCouchDbDocumentId(row);
    const databaseName = this.selectedDatabase.name;

    this.selectedDocument = null;
    this.selectedDocumentError = '';
    this.loadingDocumentDetails = true;
    this.selectedDocumentLoading = true;
    this.setPageTitle(documentId);

    const url =
      `/api/v1/couchdb-explorer/databases/${encodeURIComponent(databaseName)}` +
      `/documents/${encodeURIComponent(documentId)}`;

    console.log('[Valoores Audit Logs] Direct document fetch', {
      databaseName,
      rawRowId: row.id,
      documentId,
      url
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.message ||
          payload?.error ||
          `Document API failed with HTTP ${response.status}`
        );
      }

      const details = payload?.data ?? payload;

      console.log('[Valoores Audit Logs] Direct document response', details);

      if (!details || !details.doc) {
        this.selectedDocumentError = 'No document details returned from CouchDB.';
        return;
      }

      this.selectedDocument = details as CouchDbDocumentDetailsResponse;
    } catch (error: any) {
      console.error('[Valoores Audit Logs] Direct document fetch failed', error);

      this.selectedDocumentError =
        error?.name === 'AbortError'
          ? 'Document loading timed out after 15 seconds.'
          : error?.message || 'Failed to load document details.';
    } finally {
      clearTimeout(timer);
      this.loadingDocumentDetails = false;
      this.selectedDocumentLoading = false;
    }
  }

  closeDocument(): void {
    this.selectedDocument = null;
    this.detailsTab = 'summary';
    this.setPageTitle(this.selectedDatabase?.name);
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


  openDocumentSafe(document: any): void {
    const rawDocumentId =
      document?._id ||
      document?.id ||
      document?.document_id ||
      document?.doc_id ||
      document?.key ||
      document?.documentId;

    const rawDatabase =
      (this as any).selectedDatabase ||
      (this as any).selectedDatabaseName ||
      (this as any).currentDatabase ||
      'kycchannelnix1_kyc-wallet-chaincode-js';

    const databaseName =
      typeof rawDatabase === 'string'
        ? rawDatabase
        : rawDatabase?.name ||
          rawDatabase?.db_name ||
          rawDatabase?.database_name ||
          rawDatabase?.id ||
          'kycchannelnix1_kyc-wallet-chaincode-js';

    this.documentModalOpen = true;
    this.selectedDocument = null;
    this.selectedDocumentError = '';
    this.loadingDocumentDetails = true;
    this.cdr.detectChanges();

    if (!rawDocumentId) {
      this.selectedDocumentError = 'Document ID was not found for this row.';
      this.loadingDocumentDetails = false;
      this.cdr.detectChanges();
      return;
    }

    const url =
      `/api/v1/couchdb-explorer/databases/${encodeURIComponent(String(databaseName))}` +
      `/documents/${encodeURIComponent(String(rawDocumentId))}?_ts=${Date.now()}`;

    console.log('[Valoores Audit Logs] Safe open document row:', document);
    console.log('[Valoores Audit Logs] Safe open document URL:', url);

    fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    })
      .then(async response => {
        const bodyText = await response.text();

        let payload: any = {};
        try {
          payload = bodyText ? JSON.parse(bodyText) : {};
        } catch {
          payload = { raw: bodyText };
        }

        if (!response.ok) {
          throw new Error(payload?.message || payload?.error?.reason || `HTTP ${response.status}`);
        }
this.selectedDocumentError = '';
      })
      .catch(error => {
        console.error('[Valoores Audit Logs] Safe document load failed:', error);
        this.selectedDocument = null;
        this.selectedDocumentError = error?.message || 'Failed to load document details.';
      })
      .finally(() => {
        this.loadingDocumentDetails = false;
        this.cdr.detectChanges();
      });
  }

  closeDocumentModalSafe(): void {
    this.documentModalOpen = false;
    this.selectedDocument = null;
    this.selectedDocumentError = '';
    this.loadingDocumentDetails = false;
    this.cdr.detectChanges();
  }



  openDocumentStable(document: any): void {
    const rawDocumentId =
      document?._id ||
      document?.id ||
      document?.document_id ||
      document?.doc_id ||
      document?.key ||
      document?.documentId;

    const rawDatabase =
      (this as any).selectedDatabase ||
      (this as any).selectedDatabaseName ||
      (this as any).currentDatabase ||
      'kycchannelnix1_kyc-wallet-chaincode-js';

    const databaseName =
      typeof rawDatabase === 'string'
        ? rawDatabase
        : rawDatabase?.name ||
          rawDatabase?.db_name ||
          rawDatabase?.database_name ||
          rawDatabase?.id ||
          'kycchannelnix1_kyc-wallet-chaincode-js';

    this.stableDocumentModalOpen = true;
    this.stableDocumentLoading = true;
    this.stableDocumentError = '';
    this.stableDocumentData = null;
    this.cdr.detectChanges();

    if (!rawDocumentId) {
      this.stableDocumentLoading = false;
      this.stableDocumentError = 'Document ID was not found for this row.';
      this.cdr.detectChanges();
      return;
    }

    const url =
      `/api/v1/couchdb-explorer/databases/${encodeURIComponent(String(databaseName))}` +
      `/documents/${encodeURIComponent(String(rawDocumentId))}?_ts=${Date.now()}`;

    fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    })
      .then(async response => {
        const bodyText = await response.text();

        let payload: any = {};
        try {
          payload = bodyText ? JSON.parse(bodyText) : {};
        } catch {
          payload = { raw: bodyText };
        }

        if (!response.ok) {
          throw new Error(payload?.message || payload?.error?.reason || `HTTP ${response.status}`);
        }

        this.stableDocumentData =
          payload?.doc ||
          payload?.document ||
          payload?.data ||
          payload?.result ||
          payload;

        this.stableDocumentError = '';
      })
      .catch(error => {
        this.stableDocumentData = null;
        this.stableDocumentError = error?.message || 'Failed to load document details.';
      })
      .finally(() => {
        this.stableDocumentLoading = false;
        this.cdr.detectChanges();
      });
  }

  closeDocumentStable(): void {
    this.stableDocumentModalOpen = false;
    this.stableDocumentLoading = false;
    this.stableDocumentError = '';
    this.stableDocumentData = null;
    this.cdr.detectChanges();
  }

}
