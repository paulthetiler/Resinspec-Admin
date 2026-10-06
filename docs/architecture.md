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

### Survey & pre-start control

The technical survey is controlled rather than treated as a free-form note.

Survey flow:

`draft → complete → released / blocked`

- editing a survey resets any previous technical release
- completion requires all risk-relevant survey fields to be explicitly answered; use N/A rather than leaving assumptions blank
- at least three survey photos are required before completion
- only Owner or Supervisor can technically release the survey
- only a `suitable` technical outcome can be released for pre-start
- survey photos live in the private project bucket and are linked to the survey record rather than the general document list

Pre-start release is a start-work gate. It checks:

1. job authorised / won
2. client, site, area and scope confirmed
3. programme dates confirmed
4. technical survey released
5. approved technical system assigned
6. latest RAMS approved
7. crew assigned

A released pre-start record stores the controlled inputs it was based on: survey version timestamp, system record timestamp, RAMS record timestamp, site timestamp, programme, area, scope and the actual crew assignment fingerprint. If any of those inputs change, the release becomes stale and must be re-issued.

QA Gate 1 cannot be completed unless the current project inputs have a valid pre-start release.

### Site controls

- `rams_documents`
- `rams_risks`
- `rams_steps`
- `rams_acknowledgements`
- `documents`
- `document_acknowledgements`
- `qa_records`
- QA photo evidence linked through `documents.qa_record_id`
- `site_readings`
- `batch_logs`
- `snags`
- `handover_records`

### QA Gate System

The QA layer is a sequential failure-prevention workflow, not a loose checklist.

Standard gates:

1. Substrate accepted
2. Preparation complete
3. Repairs and movement joints addressed
4. Pre-application conditions accepted
5. Primer / first application accepted
6. Batch and coverage control complete
7. Final finish inspection
8. Snags closed and handover ready

A later gate remains locked until every earlier gate is accepted or explicitly marked not applicable by an authorised reviewer.

Additional controls:

- evidence notes are required at judgement-based gates
- photos are stored in the existing private project bucket but linked to the individual QA gate, so they do not float in the general document list
- visual QA gates require at least one photo: substrate, preparation, repairs (unless N/A), primer / first application (unless N/A) and final finish
- Gate 4 requires an approved technical-system revision plus moisture, ambient temperature, slab temperature and relative-humidity readings
- Gate 6 requires batch / mix evidence
- Gate 8 requires all snags to be accepted
- only Owner or Supervisor can accept / reject QA gates
- handover cannot move beyond draft until the complete QA sequence is released
- completion and review actor / timestamps remain attached to the QA record
- QA changes continue into the project audit trail
- the printable QA / handover report is assembled from the same live project records; it is not a duplicate form or separate data store
- reports remain visibly draft until all QA gates are released and handover is issued or accepted
- the report contains no restricted commercial data

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

Estimator line entry is protected against repeat submissions. Each rendered add-line form carries a submission key, and the database accepts that key only once per estimate. The UI disables the submit control immediately and shows a pending state while the server action runs. Estimate-item writes are also restricted at RLS level to draft estimates.

Successful line adds/removals revalidate only the active estimate instead of redirecting through the full commercial workflow. Exact duplicate lines are surfaced to the user with an explicit cleanup action; they are never deleted automatically.

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

## Site workflow UX

### Friction controls

- Jobs, Pipeline and Documents & QA have project search.
- Jobs and Documents & QA switch to large workflow cards on tablet.
- Survey risk fields use tap-first common answers while keeping the stored text editable for unusual conditions.
- QA evidence notes offer optional quick phrases; nothing is pre-selected, so the installer still has to affirm what was actually checked.
- Site Workflow deep-links directly to the current QA gate.
- Touch targets on QA, pre-start and row actions are enlarged at tablet widths.


The job page is the operational entry point for site staff.

The workflow is derived from controlled project state rather than relying on a manually typed next-action field. It presents:

- one dominant **Next action**
- large touch targets for Survey, System, RAMS, Crew, Pre-start, Installation QA and Handover
- live QA gate progress
- locked / blocked / current / complete visual states
- a sticky next-action control on tablet and small screens
- supporting admin tools collapsed beneath the workflow instead of competing with it

At tablet widths the desktop sidebar gives way to the bottom navigation so an 8-inch site tablet has the full screen available for the workflow.

The Documents & QA overview also switches from the wide desktop table to job cards with a single large **Open job workflow** action.

The manual `projects.next_action` field remains available for office/admin notes, but it is not the source of truth for the site installation sequence.

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

1. Assign the final admin domain.
2. Role-test with separate dummy Owner/Office/Commercial/Supervisor/Installer accounts.
3. Run end-to-end dummy project tests.
4. Add formal backup/export runbook.
5. Add real manufacturer systems and controlled TDS/SDS after training.
6. Feed completed estimate-versus-actual data back into estimator standards.
