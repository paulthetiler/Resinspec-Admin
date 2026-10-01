# ResinSpec Admin — Architecture

Updated: 1 October 2026

## Purpose

ResinSpec Admin is the operating system for ResinSpec Flooring.

It is designed so work can be surveyed, priced, specified, handed to a crew, controlled on site, documented, invoiced and closed without the business depending on information stored in Paul's head or scattered across messages and files.

## Stack

- Frontend / server application: Next.js App Router + TypeScript
- Hosting: Vercel
- Authentication: Supabase Auth
- Database: Supabase Postgres
- Private file storage: Supabase Storage
- Authorisation: application role checks plus Postgres row-level security
- Deployment source: GitHub `paulthetiler/Resinspec-Admin`

## Core project lifecycle

`lead → qualifying → survey → estimating → quoted → won → prestart → live → handover → invoiced → paid → closed`

`lost` is a terminal pipeline outcome.

## Primary records

### Sales and project control

- `clients`
- `sites`
- `projects`
- `surveys`
- `project_actions`
- `quotes`

### Estimating and commercial

- `estimates`
- `estimate_items`
- `project_commercials`
- `variations`
- `invoices`

Internal cost/margin tables are restricted to Owner and Commercial.

Quotes are separate client-facing records so Office can handle customer documents without access to internal margin.

### Workforce

- `profiles`
- `people`
- `people_commercials`
- `project_assignments`
- private `user_roles`

Operational workforce data and pay data are separated.

### Technical

- `technical_systems`

A technical-system row is a revision. Jobs store the exact `system_id`, preserving the actual approved revision used on the project.

### Site controls

- `rams_documents`
- `rams_risks`
- `rams_steps`
- `rams_acknowledgements`
- `documents`
- `document_acknowledgements`
- `qa_records`
- `site_readings`
- `batch_logs`
- `snags`
- `handover_records`

### Audit

- `audit_events`

Operational and commercial changes generate audit events automatically.

Commercial audit events are protected from roles that cannot access commercial data.

## Access model

### Owner

Can see and change everything.

### Office

Can manage enquiries, clients/sites, jobs, surveys, quotes, documents, RAMS and general administration.

Cannot read:

- estimator cost build-up
- workforce pay rates
- project margin
- project internal cost
- variation financials
- invoice/application financials

### Commercial

Can access estimate, margin, commercial job records, variations, applications/invoices and quotes.

### Supervisor

Only assigned project access plus operational people/technical/documents/RAMS/QA/survey/handover controls.

No internal commercial data.

### Installer

Only assigned projects.

Can access the information needed to execute work:

- location / access / known hazards
- approved technical system
- mixing / pot life / coverage / cure
- approved RAMS
- approved/complete controlled documents
- QA
- site readings
- batch logs
- snags

Cannot see drafts, superseded controlled documents or company commercial data.

## Storage security

Bucket: `project-documents`

- Private bucket
- 50 MB file limit
- Object paths start with project UUID
- Read access requires project access and an allowed document status
- Installers can only read approved/complete documents
- Draft upload owners can modify/delete their own draft file
- Management can control project documents

Document metadata and Storage RLS are both enforced. Hiding a file in the UI is not the security boundary.

## RAMS model

RAMS is structured data, not merely a PDF upload.

Each revision contains:

- project controls
- risks
- control measures
- method sequence
- QA hold-point flags
- approval
- crew acknowledgement

Installers can only read an approved RAMS revision.

The standard RAMS generator is a starting draft and must be reviewed against the real project before approval.

## Estimator model

Estimate cost lines currently accept verified manual cost inputs.

Categories include:

- labour
- materials
- equipment
- preparation
- waste
- travel
- accommodation
- subcontract
- other

Calculation:

`direct cost × (1 + contingency %) = risk-adjusted cost`

`risk-adjusted cost ÷ (1 - target margin %) = sell price`

Default contingency is 5%.

No resin production rates or material prices should be hard-coded until validated through training, manufacturer data or completed jobs.

## Quote workflow

A quote is client-facing and separate from internal estimating.

Flow:

`Estimate → Quote Draft → Issued → Accepted / Rejected`

When an issued quote is accepted:

- project moves to `won`
- linked estimate becomes accepted
- linked estimate cost/risk/margin becomes project commercial budget
- quote net price becomes project order value

This happens in the database so it is not dependent on UI role visibility.

## Commercial roll-ups

Approved variations automatically update `project_commercials.variation_value`.

Non-draft/non-cancelled invoices/applications automatically update:

- invoiced value
- paid value
- retention value

Commercial dashboard surfaces overdue and due-soon debtor records.

## Worker experience

Target worker path:

`Jobs → assigned job → Site brief / Technical / RAMS / Files / QA / Handover`

The worker job home is deliberately operational, showing site location/access plus system-critical mixing and timing information before management/commercial information.

## Deliberate exclusions

Do not add feature weight merely because software can.

Current exclusions:

- chat
- payroll
- accounting ledger
- vehicle tracking
- large HR module
- generic CRM clutter
- stock warehouse system
- customer portal
- unvalidated AI automation

## Outstanding foundation items

1. Create the initial Owner auth user.
2. Assign the final admin domain.
3. Role-test with separate dummy Owner/Office/Commercial/Supervisor/Installer accounts.
4. Run end-to-end dummy project tests.
5. Add formal backup/export runbook.
6. Add real manufacturer systems and controlled TDS/SDS after training.
7. Feed completed estimate-versus-actual data back into estimator standards.
