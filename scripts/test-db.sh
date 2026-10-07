#!/usr/bin/env bash
# Run the database tests against a throwaway local Postgres cluster.
#   stub schema (tests/db/stub_schema.sql) -> fixtures -> migration under test -> assertions
# Never touches Supabase. Requires Postgres server binaries (initdb, pg_ctl, postgres).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
pg_bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [[ -z "$pg_bin" || ! -x "$pg_bin/initdb" ]]; then
  echo "test-db: Postgres server binaries not found (set PG_BIN)." >&2
  exit 1
fi

work="$(mktemp -d)"
port="${PG_TEST_PORT:-54329}"
run_as=()
if [[ "$(id -u)" == "0" ]]; then
  chown -R postgres "$work"
  run_as=(runuser -u postgres --)
fi

cleanup() {
  "${run_as[@]}" "$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

"${run_as[@]}" "$pg_bin/initdb" -D "$work/data" -A trust -U postgres >/dev/null
"${run_as[@]}" "$pg_bin/pg_ctl" -D "$work/data" -o "-p $port -k $work -c listen_addresses=''" -l "$work/pg.log" -w start >/dev/null

psql_cmd=(psql -X -q -h "$work" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1)

migration="$root/supabase/migrations/20261008090000_prestart_release_history.sql"
"${psql_cmd[@]}" -f "$root/tests/db/stub_schema.sql" >/dev/null

status=0
for test in "$root"/tests/db/*.test.sql; do
  echo "== $(basename "$test")"
  if "${psql_cmd[@]}" -v migration="$migration" -f "$test" >"$work/out.txt" 2>&1; then
    grep -E "ok - |PASSED" "$work/out.txt" | sed -E 's/^.*NOTICE:  //'
  else
    grep -E "ok - |FAIL|ERROR" "$work/out.txt" | sed -E 's/^.*NOTICE:  //'
    echo "test-db: FAILED ($(basename "$test"))" >&2
    status=1
  fi
done
exit $status
