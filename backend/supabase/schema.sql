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
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id), is_correct boolean not null,
  elapsed_ms integer not null check(elapsed_ms>=0), confidence smallint check(confidence between 1 and 5),
  answer_given text, created_at timestamptz not null default now()
);
create index if not exists attempts_user_created_idx on public.attempts(user_id,created_at desc);
alter table public.exams enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
create policy "Users can read own attempts" on public.attempts for select to authenticated using(auth.uid()=user_id);
create policy "Users can insert own attempts" on public.attempts for insert to authenticated with check(auth.uid()=user_id);
-- No public question-table policy: answer keys must not be exposed by direct client reads.
-- Never place the Supabase service-role key in the mobile app.
