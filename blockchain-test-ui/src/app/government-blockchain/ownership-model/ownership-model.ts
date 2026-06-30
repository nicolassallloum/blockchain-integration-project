import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  BlockchainOwnershipArea,
  BlockchainOwnershipModel,
  BlockchainOwnershipValidation,
  GovernmentBlockchainProofApiService
} from '../../services/government-blockchain-proof-api.service';

@Component({
  selector: 'app-ownership-model',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ownership-model.html',
  styleUrl: './ownership-model.scss'
})
export class OwnershipModel implements OnInit {
  model: BlockchainOwnershipModel | null = null;
  validation: BlockchainOwnershipValidation | null = null;

  areaEntries: Array<[string, BlockchainOwnershipArea]> = [];
  selectedAreaKey = '';
  selectedArea: BlockchainOwnershipArea | null = null;

  isLoading = false;
  isValidating = false;
  errorMessage = '';
  validationErrorMessage = '';
  lastLoadedAt: string | null = null;

  constructor(private readonly proofApi: GovernmentBlockchainProofApiService) {}

  ngOnInit(): void {
    this.loadOwnershipModel();
    this.validateOwnershipModel();
  }

  loadOwnershipModel(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.proofApi.getOwnershipModel().subscribe({
      next: (response) => {
        this.model = response.data;
        this.areaEntries = Object.entries(response.data?.ownershipModel || {});

        const defaultArea =
          this.areaEntries.find(([key]) => key === 'postgresqlBusinessData') ||
          this.areaEntries[0];

        if (defaultArea) {
          this.selectArea(defaultArea[0]);
        }

        this.lastLoadedAt = new Date().toISOString();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load ownership model:', error);
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to load Phase 2 ownership model from backend.';
        this.model = null;
        this.areaEntries = [];
        this.selectedArea = null;
        this.selectedAreaKey = '';
        this.isLoading = false;
      }
    });
  }

  validateOwnershipModel(): void {
    this.isValidating = true;
    this.validationErrorMessage = '';

    this.proofApi.validateOwnershipModel().subscribe({
      next: (response) => {
        this.validation = response.data;
        this.isValidating = false;
      },
      error: (error) => {
        console.error('Failed to validate ownership model:', error);
        this.validationErrorMessage =
          error?.error?.message ||
          error?.message ||
          'Failed to validate Phase 2 ownership model.';
        this.validation = null;
        this.isValidating = false;
      }
    });
  }

  refresh(): void {
    this.loadOwnershipModel();
    this.validateOwnershipModel();
  }

  selectArea(areaKey: string): void {
    this.selectedAreaKey = areaKey;
    this.selectedArea = this.model?.ownershipModel?.[areaKey] || null;
  }

  formatAreaLabel(value: string): string {
    return value
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (char) => char.toUpperCase())
      .trim();
  }

  asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  }

  booleanLabel(value: unknown): string {
    if (value === true) {
      return 'Yes';
    }

    if (value === false) {
      return 'No';
    }

    return '-';
  }
}
