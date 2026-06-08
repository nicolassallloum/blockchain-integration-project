import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface KycDocument {
  id: number;
  resident_id: string;
  resident_name: string;
  document_type: string;
  document_number: string | null;
  expiry_date: string | null;
  file_name: string;
  original_file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  kyc_status: 'Pending' | 'Verified' | 'Rejected' | 'Expired';
  rejection_reason?: string | null;
  uploaded_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface KycSummary {
  total_documents: number;
  verified: number;
  pending: number;
  rejected: number;
}

@Component({
  selector: 'app-documents-kyc',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './documents-kyc.html',
  styleUrl: './documents-kyc.scss'
})
export class DocumentsKycComponent implements OnInit {
  private apiBaseUrl = 'http://172.31.13.90:3001/api/v1/government-blockchain/documents-kyc';

  documents: KycDocument[] = [];
  filteredDocuments: KycDocument[] = [];

  summary: KycSummary = {
    total_documents: 0,
    verified: 0,
    pending: 0,
    rejected: 0
  };

  loading = false;
  uploading = false;
  errorMessage = '';
  successMessage = '';

  searchText = '';
  statusFilter = 'All';

  showUploadModal = false;

  uploadForm = {
    resident_id: '',
    resident_name: '',
    document_type: '',
    document_number: '',
    expiry_date: '',
    uploaded_by: 'Officer'
  };

  selectedFile: File | null = null;

  documentTypes = [
    'National ID',
    'Passport',
    'Residency Document',
    'Driving License',
    'Family Civil Extract',
    'Individual Civil Extract',
    'Proof of Address',
    'Other'
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    console.log('[DOCUMENTS KYC COMPONENT LOADED]');
    console.log('[DOCUMENTS KYC API]', this.apiBaseUrl);

    this.refreshData();
  }

  refreshData(): void {
    this.loadDocuments();
    this.loadSummary();
  }

  loadDocuments(): void {
    this.loading = true;

    this.http.get<any>(this.apiBaseUrl).subscribe({
      next: (res) => {
        console.log('[KYC DOCUMENTS LIST]', res);

        this.documents = (res.data || []).map((doc: any) => ({
          ...doc,
          id: Number(doc.id),
          file_size: Number(doc.file_size || 0)
        }));

        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('[KYC DOCUMENTS LIST ERROR]', err);

        this.errorMessage =
          err.error?.error ||
          err.error?.detail ||
          err.error?.message ||
          'Failed to load KYC documents from database';

        this.documents = [];
        this.filteredDocuments = [];
        this.loading = false;
      }
    });
  }

  loadSummary(): void {
    this.http.get<any>(`${this.apiBaseUrl}/summary`).subscribe({
      next: (res) => {
        console.log('[KYC SUMMARY]', res);

        if (res.data) {
          this.summary = {
            total_documents: Number(res.data.total_documents || 0),
            verified: Number(res.data.verified || 0),
            pending: Number(res.data.pending || 0),
            rejected: Number(res.data.rejected || 0)
          };
        }
      },
      error: (err) => {
        console.error('[KYC SUMMARY ERROR]', err);

        this.summary = {
          total_documents: 0,
          verified: 0,
          pending: 0,
          rejected: 0
        };
      }
    });
  }

  applyFilters(): void {
    const search = this.searchText.toLowerCase().trim();

    this.filteredDocuments = this.documents.filter((doc) => {
      const matchesSearch =
        !search ||
        doc.resident_id?.toLowerCase().includes(search) ||
        doc.resident_name?.toLowerCase().includes(search) ||
        doc.document_type?.toLowerCase().includes(search) ||
        doc.document_number?.toLowerCase().includes(search) ||
        doc.original_file_name?.toLowerCase().includes(search);

      const matchesStatus =
        this.statusFilter === 'All' || doc.kyc_status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  openUploadModal(): void {
    this.showUploadModal = true;
    this.successMessage = '';
    this.errorMessage = '';
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
    this.uploading = false;
    this.selectedFile = null;

    this.uploadForm = {
      resident_id: '',
      resident_name: '',
      document_type: '',
      document_number: '',
      expiry_date: '',
      uploaded_by: 'Officer'
    };
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;

    if (!file) {
      this.selectedFile = null;
      return;
    }

    this.selectedFile = file;
  }

  uploadDocument(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.uploading) {
      return;
    }

    if (!this.uploadForm.resident_id || !this.uploadForm.resident_name || !this.uploadForm.document_type) {
      this.errorMessage = 'Resident ID, Resident Name, and Document Type are required';
      return;
    }

    if (!this.selectedFile) {
      this.errorMessage = 'Please select a document file';
      return;
    }

    const formData = new FormData();
    formData.append('resident_id', this.uploadForm.resident_id.trim());
    formData.append('resident_name', this.uploadForm.resident_name.trim());
    formData.append('document_type', this.uploadForm.document_type.trim());
    formData.append('document_number', this.uploadForm.document_number?.trim() || '');
    formData.append('expiry_date', this.uploadForm.expiry_date || '');
    formData.append('uploaded_by', this.uploadForm.uploaded_by || 'Officer');
    formData.append('document', this.selectedFile, this.selectedFile.name);

    this.uploading = true;

    this.http.post<any>(`${this.apiBaseUrl}/upload`, formData).subscribe({
      next: (res) => {
        console.log('[KYC UPLOAD SUCCESS]', res);

        this.uploading = false;
        this.errorMessage = '';
        this.successMessage = res?.message || 'Document uploaded successfully';

        this.closeUploadModal();

        setTimeout(() => {
          this.refreshData();
        }, 300);
      },
      error: (err) => {
        console.error('[KYC UPLOAD ERROR]', err);

        this.uploading = false;
        this.successMessage = '';

        this.errorMessage =
          err.error?.error ||
          err.error?.detail ||
          err.error?.message ||
          err.message ||
          'Failed to upload document';
      }
    });
  }

  updateStatus(doc: KycDocument, status: 'Pending' | 'Verified' | 'Rejected' | 'Expired'): void {
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      kyc_status: status,
      reviewed_by: 'Officer',
      rejection_reason: status === 'Rejected' ? 'Rejected after officer review' : null
    };

    this.http.patch<any>(`${this.apiBaseUrl}/${doc.id}/status`, payload).subscribe({
      next: (res) => {
        console.log('[KYC STATUS UPDATE SUCCESS]', res);

        this.errorMessage = '';
        this.successMessage = res?.message || `Document marked as ${status}`;

        this.refreshData();
      },
      error: (err) => {
        console.error('[KYC STATUS UPDATE ERROR]', err);

        this.successMessage = '';

        this.errorMessage =
          err.error?.error ||
          err.error?.detail ||
          err.error?.message ||
          err.message ||
          'Failed to update document status';
      }
    });
  }

  downloadDocument(doc: KycDocument): void {
    window.open(`${this.apiBaseUrl}/${doc.id}/download`, '_blank');
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Verified':
        return 'status verified';
      case 'Pending':
        return 'status pending';
      case 'Rejected':
        return 'status rejected';
      case 'Expired':
        return 'status expired';
      default:
        return 'status';
    }
  }

  formatFileSize(size: number): string {
    if (!size) {
      return '-';
    }

    const kb = Number(size) / 1024;

    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }

    return `${(kb / 1024).toFixed(1)} MB`;
  }
}
