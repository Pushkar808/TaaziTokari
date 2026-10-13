-- ==============================================================================
-- TAAZI TOKARI - LOCK DOWN THE SUPABASE PUBLIC API
-- Only the NestJS backend (Prisma, table owner) reads and writes this database.
-- RLS stays enabled with NO policies and the API roles lose all table access, so
-- the Supabase REST API (anon key) can read nothing. Safe to re-run.
-- Apply with: npx prisma db execute --file ../supabase/migrations/<this file> (from backend/)
-- ==============================================================================

-- 1. Remove the old Supabase Auth sync and every SQL function and policy.
drop trigger if exists on_auth_user_created on auth.users;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;

  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('drop function if exists %s cascade', r.signature);
  end loop;
end $$;

drop sequence if exists public.order_number_seq;

-- 2. RLS on with no policies = deny everything for non-owner roles.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- 3. Belt and braces: the API roles get no table, sequence or function access.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
