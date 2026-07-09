# Phase 40 — Security and Privacy Readiness

## Privacy Position

The blockchain layer must not store raw PII, raw customer data, or sensitive business payloads.

The blockchain layer stores proof values only.

## Allowed On-Chain Data

- Blockchain key
- Stable hash
- Hash version
- Source module name
- Source record reference
- Proof metadata
- Audit proof metadata
- Batch proof metadata
- Timestamps
- Transaction identifiers

## Not Allowed On-Chain

- Full customer name
- National ID
- Email
- Phone number
- Address
- Raw KYC payload
- Raw AML payload
- Raw business record payload
- Sensitive financial details
- Unmasked personal fields

## Security Controls

- Backend APIs must remain protected.
- Approval flows must be role-controlled.
- Sensitive changes must require manual approval.
- Invalid records must enter review workflow.
- Evidence exports must be generated only for authorized users.
- Production deployment must not proceed if validation fails.

## Final Status

Security and privacy readiness is acceptable for final audit readiness review.
