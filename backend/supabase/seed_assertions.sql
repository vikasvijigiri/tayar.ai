DO $$
DECLARE
  question_count integer;
  topic_count integer;
BEGIN

  IF has_table_privilege('authenticated', 'public.attempts', 'INSERT')
     OR has_table_privilege('anon', 'public.attempts', 'INSERT') THEN
    RAISE EXCEPTION 'Client roles must not be able to insert practice attempts directly';
  END IF;

  SELECT count(*) INTO question_count
  FROM public.questions
  WHERE exam_id = 'rrb_ntpc' AND active = true AND source_verified = true;

  IF question_count <> 50 THEN
    RAISE EXCEPTION 'Expected 50 active source-verified questions, found %', question_count;
  END IF;

  SELECT count(*) INTO topic_count
  FROM public.topics
  WHERE exam_id = 'rrb_ntpc'
    AND slug IN ('number-system', 'lcm-hcf', 'percentage', 'time-and-work', 'pipe-and-cistern', 'average', 'ratio-proportion', 'profit-loss', 'discount', 'simple-compound-interest', 'distance-time-speed', 'mensuration');

  IF topic_count <> 12 THEN
    RAISE EXCEPTION 'Expected twelve syllabus topics, found %', topic_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE exam_id = 'rrb_ntpc'
      AND active = true
      AND source_verified = true
      AND (jsonb_array_length(options) <> 4 OR answer_key NOT IN ('A', 'B', 'C', 'D')
        OR source_document IS NULL OR source_page IS NULL
        OR jsonb_array_length(solution_steps) = 0)
  ) THEN
    RAISE EXCEPTION 'A published question is missing options, answer key, source metadata, or solution steps';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.questions q
    WHERE q.exam_id = 'rrb_ntpc'
      AND q.active = true
      AND q.source_verified = true
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(q.options) AS opt(value)
        WHERE left(opt.value, length(q.answer_key) + 1) = q.answer_key || ')'
      )
  ) THEN
    RAISE EXCEPTION 'A question answer key does not match any option label';
  END IF;
END $$;
