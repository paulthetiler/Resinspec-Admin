#!/usr/bin/env bash
# Scan staged + unstaged changes (and untracked files) for secrets before committing.
# Exits non-zero if anything suspicious is found.
#
# The public publishable key in lib/supabase/config.ts is intentionally public
# (it ships to every browser) and is not flagged.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

patterns=(
  'sb_secret_[A-Za-z0-9_-]{10,}'                       # Supabase secret API key
  'service_role[_A-Za-z]*[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9]'  # service-role key assignment
  'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.'        # JWTs (legacy anon/service keys, tokens)
  'postgres(ql)?://[^[:space:]:]+:[^[:space:]@]+@'     # connection string with password
  'sbp_[A-Za-z0-9]{20,}'                               # Supabase personal access token
  'SUPABASE_(DB_URL|ACCESS_TOKEN|SERVICE_ROLE_KEY)=[^[:space:]$]'
  '(password|passwd|secret)[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']{6,}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
)

files=$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort -u )
[[ -z "$files" ]] && { echo "secret-scan: no changed files"; exit 0; }

found=0
for f in $files; do
  [[ -f "$f" ]] || continue
  [[ "$f" == "scripts/secret-scan.sh" ]] && continue
  for p in "${patterns[@]}"; do
    if grep -nEI -- "$p" "$f" >/dev/null 2>&1; then
      echo "POSSIBLE SECRET in $f (pattern: $p):"
      grep -nEI -- "$p" "$f" | sed -E 's/(.{0,40}).*/\1…/' | head -5
      found=1
    fi
  done
done

if [[ $found -ne 0 ]]; then
  echo "secret-scan: FAILED — review the matches above before committing." >&2
  exit 1
fi
echo "secret-scan: clean ($(echo "$files" | wc -l | tr -d ' ') file(s) checked)"
