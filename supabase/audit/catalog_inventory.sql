-- ResinSpec Admin — read-only database catalog inventory
--
-- Purpose: capture the STRUCTURE and SECURITY CONFIGURATION of the live
-- Supabase database for audit. It reads only system catalogs
-- (pg_catalog / information_schema / storage.buckets metadata).
-- It never selects business rows, file contents or auth user records.
--
-- Safe to run against production with a read-only role:
--   psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 \
--     -f supabase/audit/catalog_inventory.sql > supabase/audit/catalog_inventory.out.txt
--
-- The whole script runs inside a READ ONLY transaction that is rolled back.

\pset pager off
\pset footer off
begin transaction read only;

\echo '=== 1. Tables, RLS enablement and approximate size (no row data) ==='
select n.nspname as schema,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       c.reltuples::bigint as approx_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname in ('public', 'private', 'storage')
order by 1, 2;

\echo '=== 2. Columns ==='
select table_schema, table_name, ordinal_position, column_name, data_type,
       udt_name, is_nullable, column_default
from information_schema.columns
where table_schema in ('public', 'private')
order by 1, 2, 3;

\echo '=== 3. Constraints (PK / FK / unique / check) ==='
select n.nspname as schema, rel.relname as table_name, con.conname,
       con.contype, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname in ('public', 'private')
order by 1, 2, 3;

\echo '=== 4. Indexes ==='
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname in ('public', 'private')
order by 1, 2, 3;

\echo '=== 5. Enums / custom types ==='
select n.nspname as schema, t.typname,
       string_agg(e.enumlabel, ', ' order by e.enumsortorder) as labels
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname in ('public', 'private')
group by 1, 2
order by 1, 2;

\echo '=== 6. RLS policies (public, private, storage) ==='
select schemaname, tablename, policyname, permissive, roles, cmd,
       qual as using_expression, with_check
from pg_policies
where schemaname in ('public', 'private', 'storage')
order by 1, 2, 3;

\echo '=== 7. Table grants to API roles ==='
select table_schema, table_name, grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema in ('public', 'private', 'storage')
  and grantee in ('anon', 'authenticated', 'service_role', 'public')
group by 1, 2, 3
order by 1, 2, 3;

\echo '=== 8. Column-level grants (relevant to NI / UTR / CIS exposure) ==='
select table_schema, table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema in ('public', 'private')
  and grantee in ('anon', 'authenticated')
  and table_name in ('people', 'people_commercials', 'profiles')
order by 1, 2, 3, 4;

\echo '=== 9. Functions / RPCs (definition, security definer, search_path) ==='
select n.nspname as schema,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       p.proconfig as config,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prokind in ('f', 'p')
order by 1, 2;

\echo '=== 10. Function EXECUTE grants to API roles ==='
select routine_schema, routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema in ('public', 'private')
  and grantee in ('anon', 'authenticated', 'public')
order by 1, 2, 3;

\echo '=== 11. Triggers ==='
select n.nspname as schema, c.relname as table_name, t.tgname,
       t.tgenabled, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname in ('public', 'private', 'storage', 'auth')
order by 1, 2, 3;

\echo '=== 12. Views ==='
select schemaname, viewname, definition
from pg_views
where schemaname in ('public', 'private')
order by 1, 2;

\echo '=== 13. Storage buckets (configuration only, no objects) ==='
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

\echo '=== 14. Extensions ==='
select extname, extversion from pg_extension order by 1;

\echo '=== 15. Schemas exposed and default privileges ==='
select n.nspname as schema, r.rolname as owner
from pg_namespace n join pg_roles r on r.oid = n.nspowner
where n.nspname not like 'pg_%' and n.nspname <> 'information_schema'
order by 1;

select pg_get_userbyid(d.defaclrole) as grantor, n.nspname as schema,
       d.defaclobjtype as object_type, d.defaclacl as default_acl
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
order by 1, 2, 3;

rollback;
