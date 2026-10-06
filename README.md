# ResinSpec Admin

Private operations system for ResinSpec Flooring.

## Current state

The backend foundation is live in a dedicated Supabase project and deploys automatically from `main` to the canonical Vercel project `resinspec-admin`.

Implemented:

- Next.js 16 / React 19 application
- Supabase SSR authentication foundation
- Owner / Office / Commercial / Supervisor / Installer roles
- Row-level database security
- Role-aware navigation and route protection
- Live Today exception dashboard
- Pipeline
- Clients and sites
- Resin technical survey
- Versioned estimator
- Client quote workflow and printable quote view
- Live Jobs register
- Project editing
- Crew allocation
- Worker-facing site brief
- Versioned technical-system library
- Private project document storage
- Document revision / approval / supersede workflow
- Structured RAMS with approval and crew acknowledgement
- Touch-first Site Workflow with derived next actions for tablet/site use
- Tap-first survey answers, quick QA notes and searchable project registers for tablet use
- Technical survey completion / release control with survey-linked photo evidence
- Pre-start readiness gate with controlled release snapshot before installation
- Sequential ResinSpec QA Gate System with supervisor release between critical stages
- Gate-linked private photo evidence, with mandatory photos at visual hold points
- Moisture / environmental readings enforced before pre-application release
- Batch / mix traceability enforced before batch-control release
- People / workforce records
- Owner-issued staff app access
- Forced password change for new staff
- Variations
- Applications / invoices
- Debtor and overdue visibility
- Snag register
- Handover record locked until all QA gates are released
- Auto-built client-facing QA & handover report with gate photos, readings, batch traceability, snags and acceptance
- Restricted commercial job controls
- Automatic 5% estimator contingency default
- Automatic commercial roll-ups
- Automatic project audit trail

## Architecture principle

One project record is the source of truth.

Enquiry, survey, estimate, quote, client/site information, technical-system revision, crew, RAMS, documents, QA, batches, variations, invoicing, handover and audit history all attach to the same project.

Do not rebuild any of these as isolated spreadsheets or disconnected mini-apps unless there is a strong integration reason.

## Roles

- **Owner** — full system access.
- **Office** — pipeline, customers, jobs, survey, quote, documents, RAMS and operational controls. No internal commercial/margin access.
- **Commercial** — estimating, quote, project commercial data, variations, applications/invoices and operational job access.
- **Supervisor** — assigned jobs, survey, technical, documents, RAMS, QA, crew execution and handover controls.
- **Installer** — assigned jobs only, site brief, approved survey/technical information, approved documents/RAMS, QA, readings, batch logs and snags.

UI permissions are backed by Supabase RLS. Sensitive data is not protected merely by hiding menu items.

## Authentication

There is no public signup.

Future staff accounts are created from the Owner's People area. New staff receive a temporary password and are forced to replace it at first sign-in.

The initial Owner auth account is bootstrapped, email-confirmed and active.

## Deployment

Canonical Vercel project:

`resinspec-admin`

Deployments are triggered automatically from GitHub `main`.

Supabase project:

`ResinSpec Admin` in `eu-west-2`.

The repository contains only public Supabase connection values. Never commit service-role / secret keys, passwords, private project documents or personnel-sensitive data.

## Commercial rules already encoded

- Estimator contingency defaults to 5%.
- Sell price is calculated from risk-adjusted cost and target margin.
- Approved variations roll into project value.
- Issued invoice/application totals and payments roll into project commercial totals.
- Accepted quotes move the project to Won.
- Accepted quotes created from an estimate adopt that estimate as the job commercial budget.
- Office users cannot read internal cost or margin data.

## Still intentionally not built

- Full accounting package / bank integration
- Payroll
- Fleet / GPS tracking
- Stock-control system
- General internal chat
- Large HR suite
- Customer portal
- AI features without a concrete operational use
- Manufacturer/system pricing assumptions that have not been validated through training or live jobs

## Next practical work

- Put the final admin domain on the canonical Vercel project.
- Load verified manufacturer systems after training.
- Test the complete workflow using dummy projects and each user role.
- Add backup/export procedures.
- Refine estimator categories and production rates from actual completed jobs.
