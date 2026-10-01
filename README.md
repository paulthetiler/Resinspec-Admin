# ResinSpec Admin

Private operations application for ResinSpec Flooring.

## Current stage

Deployment trigger: Git-connected Vercel project.

The operational foundation is connected to a dedicated Supabase project.

Implemented:
- Next.js 16 / React 19 application structure
- ResinSpec admin visual system
- Supabase SSR authentication foundation
- Owner / Office / Commercial / Supervisor / Installer roles
- Row-level database security
- Role-aware navigation and route protection
- Today dashboard shell
- Live Jobs register
- New Project workflow
- Automatic human-readable project references
- Project detail page
- Technical system data structure
- Documents / RAMS / QA data structure
- People / assignment data structure
- Commercial data isolated from normal office / installer access
- Estimator placeholder
- Audit-event data structure
- CI build-verification workflow

## Core architecture

One project record is the source of truth.

Survey, client/site information, system selection, crew allocation, RAMS, QA, photos, commercial records and handover all attach to the same project rather than becoming separate disconnected systems.

## Access model

- Owner: full access
- Office: operational access without company financials
- Commercial: estimating / commercial / job access
- Supervisor: assigned jobs, technical, documents and QA
- Installer: assigned jobs, technical instructions, documents and QA

Database row-level security backs up the UI permissions.

## Authentication

The initial owner bootstrap address is `paul@resinspec.uk`.

Unknown addresses cannot create accounts through the app. Once the owner account exists, future staff access should be issued deliberately.

## Deployment requirements

The deployment needs:

```env
NEXT_PUBLIC_SUPABASE_URL=<ResinSpec Admin project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Do not commit secrets, service-role keys, live personnel records or private project documents to GitHub.

## Remaining before first live login

1. Deploy/connect this repo to its Vercel project.
2. Add the two public Supabase environment values to Vercel.
3. Configure the Supabase Auth Site URL / redirect URL for the deployed admin domain.
4. Configure the Supabase magic-link email template for the SSR confirmation route.
5. Sign in once with `paul@resinspec.uk` to bootstrap the Owner account.

## Next build phases

1. Client and site records
2. Project editing and crew assignment
3. Technical-system library UI
4. Private project document storage
5. RAMS / QA workflows
6. People / competence / expiry controls
7. Commercial job record
8. Estimator
9. Variations / applications / invoices
10. Management reporting and cash-runway dashboard
