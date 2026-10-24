-- Applied to Supabase project nuekfvbcvcvzpriqphzr as migration
-- 20261024155537_query_performance_and_rls_policy_optimization.

CREATE INDEX IF NOT EXISTS attempts_question_id_idx
  ON public.attempts (question_id);

CREATE INDEX IF NOT EXISTS questions_topic_id_idx
  ON public.questions (topic_id);

CREATE INDEX IF NOT EXISTS topics_parent_id_idx
  ON public.topics (parent_id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS questions_verified_active_exam_topic_idx
  ON public.questions (exam_id, topic_id)
  WHERE active IS TRUE AND source_verified IS TRUE;

ALTER POLICY "Users can read own attempts"
  ON public.attempts
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can insert own attempts"
  ON public.attempts
  WITH CHECK ((SELECT auth.uid()) = user_id);
