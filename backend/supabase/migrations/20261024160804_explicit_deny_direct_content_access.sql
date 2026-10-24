DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exams' AND policyname = 'No direct client access') THEN
    EXECUTE 'CREATE POLICY "No direct client access" ON public.exams FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'topics' AND policyname = 'No direct client access') THEN
    EXECUTE 'CREATE POLICY "No direct client access" ON public.topics FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'No direct client access') THEN
    EXECUTE 'CREATE POLICY "No direct client access" ON public.questions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)';
  END IF;
END $$;
