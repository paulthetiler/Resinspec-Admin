#!/usr/bin/env bash
# Read-only probe of what an UNAUTHENTICATED caller can reach with the public
# publishable key. Uses HEAD requests with count=exact so no row data is
# returned or stored — only HTTP status and row counts.
#
# It performs no inserts, updates, deletes, sign-ups or RPC calls that could
# change state.
set -uo pipefail

url="${NEXT_PUBLIC_SUPABASE_URL:-https://vsizfxdtmlxygjnlcztf.supabase.co}"
key="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-sb_publishable_P6k6SOQ1Nawbn-McJYZLIg_5Y-WWcew}"

tables=(profiles user_roles projects clients sites surveys project_assignments
  project_actions quotes estimates estimate_items project_commercials variations
  invoices people people_commercials technical_systems rams_documents rams_risks
  rams_steps rams_acknowledgements documents document_acknowledgements qa_records
  site_readings batch_logs snags handover_records prestart_releases worker_expenses
  site_issues subcontractor_invoices user_notifications audit_events)

echo "== Auth settings (public endpoint)"
curl -sS "$url/auth/v1/settings" -H "apikey: $key" \
  | grep -oE '"(disable_signup|mailer_autoconfirm|anonymous_users)":[a-z]+' || true

echo "== Table reads as anon (HTTP status, visible row count)"
for t in "${tables[@]}"; do
  out=$(curl -sS -I "$url/rest/v1/$t?select=*" -H "apikey: $key" \
    -H "Prefer: count=exact" -H "Range: 0-0" | tr -d '\r')
  status=$(echo "$out" | grep -E '^HTTP/2' | awk '{print $2}')
  range=$(echo "$out" | grep -i '^content-range' | awk '{print $2}')
  printf '%-28s %s %s\n' "$t" "${status:-?}" "${range:-}"
done

echo "== Storage as anon"
curl -sS "$url/storage/v1/bucket" -H "apikey: $key" -H "Authorization: Bearer $key"; echo
for b in project-documents worker-receipts site-issues cis-invoices; do
  printf '%-20s list=' "$b"
  curl -sS -X POST "$url/storage/v1/object/list/$b" -H "apikey: $key" \
    -H "Authorization: Bearer $key" -H "content-type: application/json" \
    -d '{"prefix":"","limit":1}'
  echo
done

echo "== RPC execute as anon (read-only function only)"
curl -sS -X POST "$url/rest/v1/rpc/current_app_role" -H "apikey: $key" \
  -H "content-type: application/json" -d '{}'; echo
