#!/usr/bin/env bash
# Capture the live ResinSpec Supabase database STRUCTURE as a version-controlled
# baseline. Schema only: no table data, no storage objects, no auth users.
#
# Requires: SUPABASE_DB_URL (read-only role is sufficient) in the environment.
# Never commit the URL itself.
#
# Output:
#   supabase/migrations/<timestamp>_remote_baseline.sql   schema (public + private)
#   supabase/audit/catalog_inventory.out.txt              policies, grants, functions,
#                                                         triggers, storage buckets/policies
#
# After running: review the diff, then run scripts/secret-scan.sh before committing.
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is not set. Add it as an environment secret; do not paste it into files." >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
stamp="$(date -u +%Y%m%d%H%M%S)"
migration="$root/supabase/migrations/${stamp}_remote_baseline.sql"
mkdir -p "$root/supabase/migrations" "$root/supabase/audit"

# 1. Schema dump. Prefer the Supabase CLI (matches the server's pg_dump version
#    and strips Supabase-managed objects); fall back to local pg_dump.
if npx --yes supabase@latest db dump --db-url "$SUPABASE_DB_URL" --schema public,private -f "$migration"; then
  echo "Schema captured with Supabase CLI -> $migration"
else
  echo "Supabase CLI dump failed; falling back to local pg_dump." >&2
  pg_dump "$SUPABASE_DB_URL" \
    --schema-only \
    --no-owner \
    --schema=public \
    --schema=private \
    --file="$migration"
  echo "Schema captured with pg_dump -> $migration"
fi

# 2. Policies / grants / functions / triggers / storage configuration.
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 \
  -f "$root/supabase/audit/catalog_inventory.sql" \
  > "$root/supabase/audit/catalog_inventory.out.txt"
echo "Catalog inventory -> supabase/audit/catalog_inventory.out.txt"

# 3. Edge Functions (needs SUPABASE_ACCESS_TOKEN; downloads source only).
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  project_ref="vsizfxdtmlxygjnlcztf"
  (cd "$root" && npx --yes supabase@latest functions download admin-create-user --project-ref "$project_ref") \
    || echo "Edge Function download failed; capture it manually from the dashboard." >&2
else
  echo "SUPABASE_ACCESS_TOKEN not set; Edge Function source (admin-create-user) not downloaded." >&2
fi

"$root/scripts/secret-scan.sh"
