REVOKE ALL ON TABLE public.exams, public.topics, public.questions, public.attempts FROM anon, authenticated;
GRANT SELECT ON TABLE public.attempts TO authenticated;
GRANT ALL ON TABLE public.exams, public.topics, public.questions, public.attempts TO service_role;
