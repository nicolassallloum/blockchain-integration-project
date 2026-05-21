export type WalletStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
export type WalletCurrency = 'LBP' | 'USD' | 'EUR';
export type AdministrationType =
  | 'DIRECTORATE'
  | 'DEPARTMENT'
  | 'PUBLIC_AUTHORITY'
  | 'PUBLIC_INSTITUTION'
  | 'MUNICIPAL_ADMINISTRATION'
  | 'GOVERNORATE_OFFICE'
  | 'OTHER';

export interface PublicAdministrationPayload {
  administrationId: string;
  administrationCode: string;
  administrationName: string;
  arabicName: string;
  parentMinistry: string;
  administrationType: AdministrationType;
  directorName: string;
  contactPerson: string;
  contactEmail: string;
  contactMobile: string;
  country: string;
  governorate: string;
  municipality: string;
  address: string;
  walletAddress: string;
  walletCurrency: WalletCurrency;
  walletStatus: WalletStatus;
  saveToBlockchain: boolean;
  saveToPostgresql: boolean;
}

export interface PublicAdministrationApiResponse {
  success: boolean;
  message: string;
  data?: unknown;
  blockchainTxId?: string;
  postgresRecordId?: string;
}

export interface PublicAdministrationCsvRow {
  administrationId: string;
  administrationCode: string;
  administrationName: string;
  arabicName: string;
  parentMinistry: string;
  administrationType: string;
  directorName: string;
  contactPerson: string;
  contactEmail: string;
  contactMobile: string;
  country: string;
  governorate: string;
  municipality: string;
  address: string;
  walletAddress: string;
  walletCurrency: string;
  walletStatus: string;
}
