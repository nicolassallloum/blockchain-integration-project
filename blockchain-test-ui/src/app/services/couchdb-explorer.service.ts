import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface CouchDbDatabase {
  name: string;
  doc_count: number;
  doc_del_count: number;
  update_seq: string;
  compact_running: boolean;
  partitioned: boolean;
  sizes: {
    active?: number;
    external?: number;
    file?: number;
  };
  disk_size: number;
  data_size: number;
  error?: string;
}

export interface CouchDbDatabasesResponse {
  defaultDatabase: string;
  total: number;
  databases: CouchDbDatabase[];
}

export interface CouchDbDocumentSummary {
  _id: string;
  _rev: string;
  docType: string;
  auditId: string;
  blockchainKey: string;
  auditEventHash: string;
  changedFieldsHash: string;
  primaryKeyHash: string;
  schemaHash: string;
  tableHash: string;
  txId: string;
  submittedBy: string;
  sourceSystem: string;
  createdAt: string;
}

export interface CouchDbDocumentRow {
  id: string;
  key: string;
  value: any;
  summary: CouchDbDocumentSummary;
  doc: any;
}

export interface CouchDbDocumentsResponse {
  database: string;
  limit: number;
  skip: number;
  total: number | null;
  rows: CouchDbDocumentRow[];
  warning?: string;
}

export interface CouchDbDocumentDetailsResponse {
  database: string;
  id: string;
  summary: CouchDbDocumentSummary;
  doc: any;
}

export interface CouchDbDocumentFilters {
  search?: string;
  docType?: string;
  auditId?: string;
  limit?: number;
  skip?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CouchDbExplorerService {
  private readonly baseUrl = '/api/v1/couchdb-explorer';

  constructor(private http: HttpClient) {}

  health(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/health`);
  }

  getDatabases(): Observable<CouchDbDatabasesResponse> {
    return this.http.get<CouchDbDatabasesResponse>(`${this.baseUrl}/databases`);
  }

  getDocuments(
    database: string,
    filters: CouchDbDocumentFilters = {}
  ): Observable<CouchDbDocumentsResponse> {
    let params = new HttpParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<CouchDbDocumentsResponse>(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/documents`,
      { params }
    );
  }

  getDocument(database: string, documentId: string): Observable<CouchDbDocumentDetailsResponse> {
    return this.http.get<CouchDbDocumentDetailsResponse>(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/documents/${encodeURIComponent(
        documentId
      )}`
    );
  }

  getChanges(database: string, limit = 50): Observable<any> {
    const params = new HttpParams().set('limit', String(limit));

    return this.http.get<any>(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/changes`,
      { params }
    );
  }
}
