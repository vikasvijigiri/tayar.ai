-- Applied to Supabase project nuekfvbcvcvzpriqphzr as migration
-- 20261024160804_explicit_deny_direct_content_access.
-- Content is served only through the authenticated FastAPI API; client roles must be denied
-- at both the SQL privilege and RLS policy layers.

CREATE POLICY "No direct client access" ON public.exams
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No direct client access" ON public.questions
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No direct client access" ON public.topics
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
