CREATE INDEX IF NOT EXISTS attempts_user_created_idx
  ON public.attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attempts_question_id_idx
  ON public.attempts(question_id);
CREATE INDEX IF NOT EXISTS questions_topic_id_idx
  ON public.questions(topic_id);
CREATE INDEX IF NOT EXISTS questions_verified_active_exam_topic_idx
  ON public.questions(exam_id, topic_id)
  WHERE active IS TRUE AND source_verified IS TRUE;
CREATE INDEX IF NOT EXISTS topics_parent_id_idx
  ON public.topics(parent_id)
  WHERE parent_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can read own attempts" ON public.attempts;
CREATE POLICY "Users can read own attempts"
  ON public.attempts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
