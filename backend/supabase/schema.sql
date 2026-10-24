create extension if not exists pgcrypto;
create table if not exists public.exams (
  id text primary key, name text not null, syllabus_version text,
  created_at timestamptz not null default now()
);
insert into public.exams(id,name) values ('rrb_ntpc','RRB NTPC') on conflict do nothing;
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(), exam_id text not null references public.exams(id),
  parent_id uuid references public.topics(id), name text not null, slug text not null,
  created_at timestamptz not null default now(), unique(exam_id,slug)
);
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(), exam_id text not null references public.exams(id),
  topic_id uuid references public.topics(id), question_text text not null, options jsonb not null,
  answer_key text not null, solution_steps jsonb not null default '[]'::jsonb,
  source_document text not null, source_page text, source_verified boolean not null default false,
  difficulty smallint check(difficulty between 1 and 5), syllabus_weight numeric(4,3),
  active boolean not null default false, created_at timestamptz not null default now(),
  check(jsonb_typeof(options)='array'), check(jsonb_typeof(solution_steps)='array')
);
create index if not exists questions_exam_topic_idx on public.questions(exam_id,topic_id);
create index if not exists questions_topic_id_idx on public.questions(topic_id);
create index if not exists questions_verified_active_exam_topic_idx on public.questions(exam_id,topic_id) where active is true and source_verified is true;
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id), is_correct boolean not null,
  elapsed_ms integer not null check(elapsed_ms>=0), confidence smallint check(confidence between 1 and 5),
  answer_given text, idempotency_key uuid, created_at timestamptz not null default now()
);
create unique index if not exists attempts_user_idempotency_key_uidx
  on public.attempts(user_id, idempotency_key);
create index if not exists attempts_user_created_idx on public.attempts(user_id,created_at desc);
create index if not exists attempts_question_id_idx on public.attempts(question_id);
create index if not exists topics_parent_id_idx on public.topics(parent_id) where parent_id is not null;
alter table public.exams enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;

-- Keep the privilege model explicit and reproducible across environments.
revoke all on table public.exams, public.topics, public.questions, public.attempts from anon, authenticated;
grant select on table public.attempts to authenticated;
grant all on table public.exams, public.topics, public.questions, public.attempts to service_role;

create policy "No direct client access" on public.exams for all to anon, authenticated using (false) with check (false);
create policy "No direct client access" on public.topics for all to anon, authenticated using (false) with check (false);
create policy "No direct client access" on public.questions for all to anon, authenticated using (false) with check (false);
create policy "Users can read own attempts" on public.attempts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own attempts" on public.attempts;

-- Automatically enable RLS on future public tables; API roles cannot execute this function.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
  tbl name;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
       and cmd.schema_name = 'public'
       and cmd.schema_name not in ('pg_catalog', 'information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%' then
      begin
        select c.relname into tbl from pg_catalog.pg_class c where c.oid = cmd.objid;
        execute format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (not in enforced schema)', cmd.object_identity;
    end if;
  end loop;
end;
$function$;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    execute 'create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable()';
  end if;
end $$;

-- Never place the Supabase service-role key in the mobile app.
