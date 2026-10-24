-- Applied to Supabase project nuekfvbcvcvzpriqphzr as migration
-- 20261024160706_restrict_direct_client_table_privileges.
-- The mobile client calls the FastAPI backend; it must not query content tables directly.
-- Attempts remain user-scoped by RLS, with authenticated users allowed only SELECT/INSERT.

REVOKE ALL ON TABLE public.exams, public.questions, public.topics FROM anon, authenticated;
REVOKE ALL ON TABLE public.attempts FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.attempts FROM authenticated;
