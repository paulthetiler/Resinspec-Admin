# ResinSpec Admin

Private operations application for ResinSpec Flooring.

## Current stage

Foundation shell only. No live business data is stored yet.

Implemented:
- Next.js 16 / React 19 application structure
- ResinSpec admin visual system
- Today dashboard shell
- Pipeline
- Jobs
- Technical
- Documents & QA
- People
- Commercial area
- Estimator placeholder
- Role/permission model
- CI build verification

Next:
1. Dedicated ResinSpec Supabase project
2. Authentication
3. Database schema and row-level security
4. Real project records
5. Staff/job assignment
6. Documents and QA workflow
7. Commercial data and estimator

## Security rule

Never commit passwords, API secrets, service-role keys, live personnel records or private project documents to GitHub.
Environment secrets belong in deployment environment variables.

## Architecture principle

One project record is the source of truth. Survey, system selection, crew allocation, RAMS, QA, photos, variations, financial records and handover will link back to that project rather than becoming separate disconnected systems.
