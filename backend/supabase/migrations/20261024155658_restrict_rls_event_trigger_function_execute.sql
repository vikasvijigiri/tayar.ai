-- Applied to Supabase project nuekfvbcvcvzpriqphzr as migration
-- 20261024155658_restrict_rls_event_trigger_function_execute.
-- Event triggers execute this function through PostgreSQL's event-trigger mechanism;
-- ordinary client roles must not be able to invoke it directly.

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;
