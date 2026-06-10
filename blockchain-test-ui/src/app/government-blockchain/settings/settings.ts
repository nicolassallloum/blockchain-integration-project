import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type SettingStatus = 'Connected' | 'Online' | 'Running' | 'Disconnected' | 'Offline' | 'Failed' | 'Checking' | string;

interface SettingsPayload {
  blockchain: {
    blockchainNetwork: string;
    channelName: string;
    chaincodeName: string;
    organizationMsp: string;
  };
  api: {
    apiBaseUrl: string;
    environment: string;
    requestTimeoutMs: number;
    corsStatus: string;
  };
  security: {
    passwordPolicy: string;
    jwtExpiry: string;
    twoFactorAuthentication: string;
    auditLogging: string;
  };
}

interface SystemStatusItem {
  label: string;
  status: SettingStatus;
  error?: string;
  channel?: string;
  chaincode?: string;
  organizationMsp?: string;
}

interface SystemStatusPayload {
  postgresqlDatabase: SystemStatusItem;
  fabricPeer: SystemStatusItem;
  couchDb: SystemStatusItem;
  apiMiddleware: SystemStatusItem;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/government-blockchain/settings`;

  loading = false;
  saving = false;
  refreshingStatus = false;

  successMessage = '';
  errorMessage = '';
  lastCheckedAt = '';

  environmentOptions = ['Production', 'Staging', 'Development'];
  enabledDisabledOptions = ['Enabled', 'Disabled'];
  passwordPolicyOptions = ['Strong', 'Medium', 'Basic'];
  jwtExpiryOptions = ['1 Hour', '8 Hours', '12 Hours', '24 Hours', '7 Days', '30 Days'];

  settings: SettingsPayload = {
    blockchain: {
      blockchainNetwork: 'Hyperledger Fabric',
      channelName: '',
      chaincodeName: '',
      organizationMsp: '',
    },
    api: {
      apiBaseUrl: '',
      environment: 'Production',
      requestTimeoutMs: 30000,
      corsStatus: 'Enabled',
    },
    security: {
      passwordPolicy: 'Strong',
      jwtExpiry: '24 Hours',
      twoFactorAuthentication: 'Enabled',
      auditLogging: 'Enabled',
    },
  };

  systemStatus: SystemStatusPayload = {
    postgresqlDatabase: {
      label: 'PostgreSQL Database',
      status: 'Checking',
    },
    fabricPeer: {
      label: 'Fabric Peer',
      status: 'Checking',
    },
    couchDb: {
      label: 'CouchDB',
      status: 'Checking',
    },
    apiMiddleware: {
      label: 'API Middleware',
      status: 'Checking',
    },
  };

  ngOnInit(): void {
    this.loadSettings();
    this.loadSystemStatus();
  }

  loadSettings(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.get<any>(this.baseUrl).subscribe({
      next: (response) => {
        if (response?.success && response?.data) {
          this.settings = {
            blockchain: {
              blockchainNetwork: response.data.blockchain?.blockchainNetwork || 'Hyperledger Fabric',
              channelName: response.data.blockchain?.channelName || '',
              chaincodeName: response.data.blockchain?.chaincodeName || '',
              organizationMsp: response.data.blockchain?.organizationMsp || '',
            },
            api: {
              apiBaseUrl: response.data.api?.apiBaseUrl || '',
              environment: response.data.api?.environment || 'Production',
              requestTimeoutMs: Number(response.data.api?.requestTimeoutMs || 30000),
              corsStatus: response.data.api?.corsStatus || 'Enabled',
            },
            security: {
              passwordPolicy: response.data.security?.passwordPolicy || 'Strong',
              jwtExpiry: response.data.security?.jwtExpiry || '24 Hours',
              twoFactorAuthentication: response.data.security?.twoFactorAuthentication || 'Enabled',
              auditLogging: response.data.security?.auditLogging || 'Enabled',
            },
          };
        } else {
          this.errorMessage = response?.message || 'Failed to load settings.';
        }

        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load settings from backend.';
        this.loading = false;
      },
    });
  }

  loadSystemStatus(): void {
    this.refreshingStatus = true;

    this.http.get<any>(`${this.baseUrl}/status`).subscribe({
      next: (response) => {
        if (response?.success && response?.data) {
          this.systemStatus = response.data;
          this.lastCheckedAt = response?.meta?.checkedAt || response?.timestamp || new Date().toISOString();
        } else {
          this.errorMessage = response?.message || 'Failed to load system status.';
        }

        this.refreshingStatus = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load system status.';
        this.refreshingStatus = false;
      },
    });
  }

  saveSettings(): void {
    this.successMessage = '';
    this.errorMessage = '';

    const validationError = this.validateSettings();
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.saving = true;

    this.http.put<any>(this.baseUrl, this.settings).subscribe({
      next: (response) => {
        if (response?.success) {
          this.successMessage = response.message || 'Settings updated successfully.';
          if (response.data) {
            this.settings = response.data;
          }
          this.loadSystemStatus();
        } else {
          this.errorMessage = response?.message || 'Failed to save settings.';
        }

        this.saving = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to save settings.';
        this.saving = false;
      },
    });
  }

  refreshAll(): void {
    this.loadSettings();
    this.loadSystemStatus();
  }

  getStatusClass(status: SettingStatus): string {
    const normalized = String(status || '').toLowerCase();

    if (['connected', 'online', 'running', 'success'].includes(normalized)) {
      return 'status-ok';
    }

    if (['checking', 'pending'].includes(normalized)) {
      return 'status-checking';
    }

    return 'status-error';
  }

  getStatusIcon(status: SettingStatus): string {
    const normalized = String(status || '').toLowerCase();

    if (['connected', 'online', 'running', 'success'].includes(normalized)) {
      return '●';
    }

    if (['checking', 'pending'].includes(normalized)) {
      return '●';
    }

    return '●';
  }

  private validateSettings(): string {
    if (!this.settings.blockchain.blockchainNetwork?.trim()) {
      return 'Blockchain Network is required.';
    }

    if (!this.settings.blockchain.channelName?.trim()) {
      return 'Channel Name is required.';
    }

    if (!this.settings.blockchain.chaincodeName?.trim()) {
      return 'Chaincode Name is required.';
    }

    if (!this.settings.blockchain.organizationMsp?.trim()) {
      return 'Organization MSP is required.';
    }

    if (!this.settings.api.apiBaseUrl?.trim()) {
      return 'API Base URL is required.';
    }

    if (!Number.isFinite(Number(this.settings.api.requestTimeoutMs)) || Number(this.settings.api.requestTimeoutMs) <= 0) {
      return 'Request Timeout must be a valid positive number.';
    }

    return '';
  }
}
