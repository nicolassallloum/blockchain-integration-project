/**
 * Shared models for Blockchain Full KYC module.
 * Used by State Institution screens, KYC workflow screens, dashboards,
 * reports, audit screens, and API services.
 */

/* ======================================================
 * Shared Union Types
 * ====================================================== */

export type KycStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'REQUIRES_UPDATE'
  | 'EXPIRED'
  | 'SUSPENDED';

export type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH';

export type BlockchainStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'MISMATCH';

export type DuplicateResult =
  | 'NO_DUPLICATE'
  | 'POSSIBLE_DUPLICATE'
  | 'CONFIRMED_DUPLICATE'
  | 'NEEDS_MANUAL_REVIEW';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'STATE_ADMIN'
  | 'DEPARTMENT_MANAGER'
  | 'KYC_OFFICER'
  | 'KYC_REVIEWER'
  | 'COMPLIANCE_OFFICER'
  | 'AUDITOR'
  | 'REPORT_VIEWER'
  | 'READ_ONLY';

export type DocumentType =
  | 'NATIONAL_ID_FRONT'
  | 'NATIONAL_ID_BACK'
  | 'PASSPORT'
  | 'BIRTH_CERTIFICATE'
  | 'PROOF_OF_ADDRESS'
  | 'RESIDENCY_CERTIFICATE'
  | 'FAMILY_REGISTRY'
  | 'SERVICE_SUPPORTING_DOCUMENT'
  | 'OTHER';

export type DocumentStatus =
  | 'UPLOADED'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED';

export type ReportStatus =
  | 'REQUESTED'
  | 'GENERATING'
  | 'GENERATED'
  | 'FAILED'
  | 'EXPIRED';

export type ReportFormat = 'PDF' | 'EXCEL' | 'CSV';

export type ServiceEligibilityStatus =
  | 'ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'REQUIRES_REVIEW'
  | 'BLOCKED';

export type InstitutionStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';

export type PublicServiceStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/* ======================================================
 * State Institution Models
 * ====================================================== */

export interface StateInstitution {
  institutionId: string;

  /**
   * Official state institution code.
   * Example: MOF, MOI, MOPH, MOSA.
   */
  institutionCode: string;

  institutionName: string;

  institutionNameAr?: string;

  institutionType?: string;

  countryCode?: string;

  city?: string;

  address?: string;

  contactEmail?: string;

  contactPhone?: string;

  status: InstitutionStatus;

  createdAt: string;

  updatedAt?: string;

  createdBy?: string;

  updatedBy?: string;
}

export interface StateDepartment {
  departmentId: string;

  institutionId: string;

  /**
   * Department code inside the state institution.
   */
  departmentCode: string;

  departmentName: string;

  departmentNameAr?: string;

  description?: string;

  managerUserId?: string;

  status: DepartmentStatus;

  createdAt: string;

  updatedAt?: string;

  createdBy?: string;

  updatedBy?: string;
}

export interface PublicService {
  serviceId: string;

  institutionId: string;

  departmentId?: string;

  /**
   * Unique public service code.
   * Example: PASSPORT_RENEWAL, SOCIAL_AID, TAX_CLEARANCE.
   */
  serviceCode: string;

  serviceName: string;

  serviceNameAr?: string;

  description?: string;

  requiresKyc: boolean;

  requiresBlockchainProof: boolean;

  minimumKycStatus?: KycStatus;

  allowedRiskCategories?: RiskCategory[];

  status: PublicServiceStatus;

  createdAt: string;

  updatedAt?: string;

  createdBy?: string;

  updatedBy?: string;
}

/* ======================================================
 * Citizen KYC Profile Models
 * ====================================================== */

export interface CitizenKycProfile {
  kycId: string;

  /**
   * Internal citizen identifier used by the state institution.
   */
  citizenId: string;

  /**
   * National ID or passport number.
   * Prefer storing masked or encrypted values in UI/API responses.
   */
  nationalId?: string;

  passportNumber?: string;

  firstName: string;

  fatherName?: string;

  lastName: string;

  fullName: string;

  fullNameAr?: string;

  dateOfBirth?: string;

  placeOfBirth?: string;

  gender?: 'MALE' | 'FEMALE' | 'OTHER';

  nationality?: string;

  countryCode?: string;

  maritalStatus?: string;

  mobileNumber?: string;

  email?: string;

  address?: string;

  city?: string;

  district?: string;

  governorate?: string;

  postalCode?: string;

  occupation?: string;

  employerName?: string;

  monthlyIncomeRange?: string;

  sourceOfFunds?: string;

  /**
   * Current KYC lifecycle status.
   */
  kycStatus: KycStatus;

  /**
   * Overall risk category calculated from duplicate check,
   * sanctions, PEP, country risk, occupation risk, and service behavior.
   */
  riskCategory: RiskCategory;

  /**
   * Current blockchain submission/confirmation status.
   */
  blockchainStatus: BlockchainStatus;

  assignedInstitutionId?: string;

  assignedDepartmentId?: string;

  assignedOfficerUserId?: string;

  submittedAt?: string;

  reviewedAt?: string;

  approvedAt?: string;

  rejectedAt?: string;

  expiredAt?: string;

  suspendedAt?: string;

  approvedBy?: string;

  rejectedBy?: string;

  rejectionReason?: string;

  requiresUpdateReason?: string;

  notes?: string;

  createdAt: string;

  updatedAt?: string;

  createdBy?: string;

  updatedBy?: string;
}

export interface CitizenKycDocument {
  documentId: string;

  kycId: string;

  citizenId: string;

  documentType: DocumentType;

  documentName: string;

  /**
   * File path, object storage key, or secure document reference.
   */
  fileReference: string;

  fileName?: string;

  fileMimeType?: string;

  fileSizeBytes?: number;

  documentNumber?: string;

  issuedBy?: string;

  issuedAt?: string;

  expiresAt?: string;

  status: DocumentStatus;

  verifiedAt?: string;

  verifiedBy?: string;

  rejectionReason?: string;

  /**
   * Hash of the document file for integrity validation.
   */
  documentHash?: string;

  createdAt: string;

  updatedAt?: string;

  createdBy?: string;

  updatedBy?: string;
}

export interface CitizenKycWorkflowLog {
  workflowLogId: string;

  kycId: string;

  citizenId: string;

  previousStatus?: KycStatus;

  newStatus: KycStatus;

  /**
   * Human-readable workflow action.
   * Example: SUBMIT_KYC, APPROVE_KYC, REJECT_KYC.
   */
  action: string;

  comments?: string;

  performedBy: string;

  performedByName?: string;

  performedByRole?: UserRole;

  performedAt: string;

  institutionId?: string;

  departmentId?: string;
}

/* ======================================================
 * Blockchain Record Models
 * ====================================================== */

export interface CitizenKycBlockchainRecord {
  blockchainRecordId: string;

  kycId: string;

  citizenId: string;

  /**
   * Hash of the approved KYC profile stored on-chain.
   * Full KYC details remain off-chain.
   */
  kycHash: string;

  /**
   * Optional hash of all verified documents combined.
   */
  documentsHash?: string;

  blockchainStatus: BlockchainStatus;

  channelName?: string;

  chaincodeName?: string;

  transactionId?: string;

  blockNumber?: number;

  ledgerReference?: string;

  submittedAt?: string;

  confirmedAt?: string;

  failedAt?: string;

  failureReason?: string;

  /**
   * Used when off-chain data and on-chain hash do not match.
   */
  mismatchReason?: string;

  createdAt: string;

  updatedAt?: string;

  createdBy?: string;
}

/* ======================================================
 * Screening, Duplicate Check, and Eligibility Models
 * ====================================================== */

export interface CitizenDuplicateCheck {
  duplicateCheckId: string;

  kycId: string;

  citizenId: string;

  result: DuplicateResult;

  /**
   * Matching confidence from 0 to 100.
   */
  matchScore?: number;

  matchedCitizenId?: string;

  matchedKycId?: string;

  matchedNationalIdMasked?: string;

  matchedFullName?: string;

  matchReasons?: string[];

  requiresManualReview: boolean;

  reviewedAt?: string;

  reviewedBy?: string;

  reviewDecision?: DuplicateResult;

  reviewNotes?: string;

  checkedAt: string;

  checkedBy?: string;
}

export interface CitizenRiskScreening {
  riskScreeningId: string;

  kycId: string;

  citizenId: string;

  riskCategory: RiskCategory;

  /**
   * Total risk score from 0 to 100.
   */
  riskScore?: number;

  pepFlag: boolean;

  sanctionMatch: boolean;

  watchlistMatch?: boolean;

  adverseMediaMatch?: boolean;

  countryRisk?: RiskCategory;

  occupationRisk?: RiskCategory;

  serviceUsageRisk?: RiskCategory;

  duplicateRisk?: RiskCategory;

  screeningProvider?: string;

  screeningReference?: string;

  screeningDetails?: string;

  screenedAt: string;

  screenedBy?: string;

  reviewedAt?: string;

  reviewedBy?: string;

  reviewNotes?: string;
}

export interface CitizenServiceEligibility {
  eligibilityId: string;

  kycId: string;

  citizenId: string;

  serviceId: string;

  institutionId: string;

  departmentId?: string;

  status: ServiceEligibilityStatus;

  /**
   * Explains why the citizen is eligible, blocked, or requires review.
   */
  eligibilityReason?: string;

  requiredKycStatus?: KycStatus;

  actualKycStatus: KycStatus;

  requiredBlockchainStatus?: BlockchainStatus;

  actualBlockchainStatus?: BlockchainStatus;

  riskCategory: RiskCategory;

  checkedAt: string;

  checkedBy?: string;
}

/* ======================================================
 * Audit Models
 * ====================================================== */

export interface CitizenKycAuditLog {
  auditLogId: string;

  kycId?: string;

  citizenId?: string;

  institutionId?: string;

  departmentId?: string;

  userId?: string;

  username?: string;

  userRole?: UserRole;

  /**
   * Audit action.
   * Example: CREATE_KYC, UPDATE_KYC, VIEW_DOCUMENT, APPROVE_KYC.
   */
  action: string;

  entityType?: string;

  entityId?: string;

  oldValue?: unknown;

  newValue?: unknown;

  ipAddress?: string;

  userAgent?: string;

  requestId?: string;

  correlationId?: string;

  sourceSystem?: string;

  createdAt: string;
}

/* ======================================================
 * Dashboard Models
 * ====================================================== */

export interface DashboardSummary {
  totalKycProfiles: number;

  totalSubmitted: number;

  totalPendingReview: number;

  totalApproved: number;

  totalRejected: number;

  totalRequiresUpdate: number;

  totalExpired: number;

  totalSuspended: number;

  totalHighRisk: number;

  totalMediumRisk: number;

  totalLowRisk: number;

  totalBlockchainSubmitted: number;

  totalBlockchainConfirmed: number;

  totalBlockchainFailed: number;

  totalBlockchainMismatch: number;

  totalPossibleDuplicates: number;

  totalConfirmedDuplicates: number;

  todayCreatedProfiles: number;

  todaySubmittedProfiles: number;

  todayApprovedProfiles: number;

  todayRejectedProfiles: number;

  lastUpdatedAt: string;
}

export interface DashboardStatusDistribution {
  label: string;

  status: KycStatus | BlockchainStatus | RiskCategory | DuplicateResult | string;

  count: number;

  percentage?: number;
}

/* ======================================================
 * Reports Models
 * ====================================================== */

export interface ReportFilter {
  institutionId?: string;

  departmentId?: string;

  serviceId?: string;

  kycStatus?: KycStatus;

  riskCategory?: RiskCategory;

  blockchainStatus?: BlockchainStatus;

  duplicateResult?: DuplicateResult;

  dateFrom?: string;

  dateTo?: string;

  citizenId?: string;

  nationalId?: string;

  createdBy?: string;

  approvedBy?: string;

  format?: ReportFormat;
}

export interface GeneratedReport {
  reportId: string;

  reportName: string;

  reportType: string;

  status: ReportStatus;

  format: ReportFormat;

  filters?: ReportFilter;

  fileReference?: string;

  fileName?: string;

  fileSizeBytes?: number;

  generatedBy: string;

  generatedByName?: string;

  requestedAt: string;

  generatedAt?: string;

  expiresAt?: string;

  failureReason?: string;
}

/* ======================================================
 * User and Reference Data Models
 * ====================================================== */

export interface StateUser {
  userId: string;

  username: string;

  fullName: string;

  email?: string;

  mobileNumber?: string;

  role: UserRole;

  institutionId?: string;

  departmentId?: string;

  isActive: boolean;

  lastLoginAt?: string;

  createdAt: string;

  updatedAt?: string;

  createdBy?: string;

  updatedBy?: string;
}

export interface ReferenceDataItem {
  id: string;

  code: string;

  name: string;

  nameAr?: string;

  description?: string;

  category?: string;

  parentCode?: string;

  sortOrder?: number;

  isActive: boolean;

  metadata?: Record<string, unknown>;
}
