import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface CouchDbStatus {
  connected: boolean;
  couchdb: string;
  version: string;
  vendor?: unknown;
}

export interface CouchDbDatabaseCount {
  database: string;
  documentCount: number;
  deletedDocuments: number;
  updateSequence: string | number | null;
  diskSize: number;
  error?: string;
}

export interface CouchDbDocumentsResponse {
  database: string;
  totalRows: number;
  offset: number;
  limit: number;
  skip: number;
  returned: number;
  documents: any[];
}

export interface CouchDbCountsResponse {
  database: string;
  totalRecords: number;
  byDocType: Record<string, number>;
  byStatus: Record<string, number>;
  byCreatedDate: Record<string, number>;
}

@Injectable({
  providedIn: 'root',
})
export class CouchDbExplorerService {
  private readonly apiBaseUrl = 'http://172.31.13.90:3001/api/v1';

  constructor(private http: HttpClient) {}

  getStatus(): Observable<ApiResponse<CouchDbStatus>> {
    return this.http.get<ApiResponse<CouchDbStatus>>(
      `${this.apiBaseUrl}/couchdb/status`
    );
  }

  getDatabases(): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(
      `${this.apiBaseUrl}/couchdb/databases`
    );
  }

  getDatabaseCounts(): Observable<ApiResponse<CouchDbDatabaseCount[]>> {
    return this.http.get<ApiResponse<CouchDbDatabaseCount[]>>(
      `${this.apiBaseUrl}/couchdb/database-counts`
    );
  }

  getDocuments(
    database: string,
    filters: {
      limit?: number;
      skip?: number;
      search?: string;
      documentType?: string;
      status?: string;
    }
  ): Observable<ApiResponse<CouchDbDocumentsResponse>> {
    let params = new HttpParams();

    if (filters.limit !== undefined) {
      params = params.set('limit', String(filters.limit));
    }

    if (filters.skip !== undefined) {
      params = params.set('skip', String(filters.skip));
    }

    if (filters.search) {
      params = params.set('search', filters.search);
    }

    if (filters.documentType) {
      params = params.set('documentType', filters.documentType);
    }

    if (filters.status) {
      params = params.set('status', filters.status);
    }

    return this.http.get<ApiResponse<CouchDbDocumentsResponse>>(
      `${this.apiBaseUrl}/couchdb/${encodeURIComponent(database)}/documents`,
      { params }
    );
  }

  getCounts(database: string): Observable<ApiResponse<CouchDbCountsResponse>> {
    return this.http.get<ApiResponse<CouchDbCountsResponse>>(
      `${this.apiBaseUrl}/couchdb/${encodeURIComponent(database)}/counts`
    );
  }

  getDocumentById(
    database: string,
    documentId: string
  ): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${this.apiBaseUrl}/couchdb/${encodeURIComponent(
        database
      )}/documents/${encodeURIComponent(documentId)}`
    );
  }
}
