-- Curated starter set: question text, options, answer keys, dates/shifts, and source pages
-- were checked directly against the uploaded PDF. Solution steps below are independently
-- authored and arithmetically checked; they are not claimed to be verbatim PDF explanations.
-- Source: RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf
-- PDF page 3 (printed page 2), Number System section, Q1-Q10.
-- Safe to re-run: stable topic/question IDs and ON CONFLICT updates are used.

insert into public.topics (id, exam_id, name, slug)
values (
  'a1000000-0000-4000-8000-000000000001',
  'rrb_ntpc',
  'Number System',
  'number-system'
)
on conflict (exam_id, slug) do update
set name = excluded.name;

insert into public.questions (
  id, exam_id, topic_id, question_text, options, answer_key,
  solution_steps, source_document, source_page, source_verified,
  difficulty, syllabus_weight, active
)
values
(
 'b1000000-0000-4000-8000-000000000001','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='number-system'),
 'Which of the following numbers divides 54,10,96,943?',
 '["A) 87","B) 97","C) 103","D) 107"]'::jsonb,'B',
 '["Check the four options by division.","54,10,96,943 ÷ 97 = 5578319 with remainder 0.","Therefore, option B) 97 divides the number exactly."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 3 (printed page 2), Q1; 01/09/2025 Shift-1',true,2,0.8,true
),
(
 'b1000000-0000-4000-8000-000000000002','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='number-system'),
 'The number of prime numbers lying between 472 and 486, both included, is:',
 '["A) 6","B) 2","C) 5","D) 1"]'::jsonb,'D',
 '["Check the integers from 472 through 486 for primality.","479 is prime; the other integers in the interval are even or composite.","There is exactly one prime number, so the answer is D) 1."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 3 (printed page 2), Q2; 08/09/2025 Shift-2',true,2,0.8,true
),
(
 'b1000000-0000-4000-8000-000000000003','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='number-system'),
 'The number of prime numbers lying between 468 and 476, both included, is:',
 '["A) 5","B) 2","C) 1","D) 0"]'::jsonb,'D',
 '["The even numbers in the interval are composite.","The odd candidates 469, 471, 473 and 475 are composite: 7×67, 3×157, 11×43 and 5×95.","No prime occurs in the interval, so the answer is D) 0."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 3 (printed page 2), Q3; 13/08/2025 Shift-1',true,2,0.8,true
),
(
 'b1000000-0000-4000-8000-000000000004','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='number-system'),
 'The number of prime numbers lying between 466 and 476, both included, is:',
 '["A) 2","B) 1","C) 5","D) 3"]'::jsonb,'B',
 '["The only prime in the inclusive interval 466 to 476 is 467.","The other odd candidates are composite: 469=7×67, 471=3×157, 473=11×43 and 475=5×95.","The count is 1, so the answer is B) 1."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 3 (printed page 2), Q4; 11/08/2025 Shift-1',true,2,0.8,true
),
(
 'b1000000-0000-4000-8000-000000000005','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='number-system'),
 'The number of prime numbers lying between 332 and 343, both included, is:',
 '["A) 3","B) 1","C) 4","D) 2"]'::jsonb,'B',
 '["The only prime in the inclusive interval 332 to 343 is 337.","The odd candidates 333, 335, 339, 341 and 343 are composite; all even candidates are composite.","The count is 1, so the answer is B) 1."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 3 (printed page 2), Q5; 03/09/2025 Shift-3',true,2,0.8,true
),
(
 'b1000000-0000-4000-8000-000000000006','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='number-system'),
 'The number of prime numbers lying between 411 and 424, both included, is:',
 '["A) 4","B) 2","C) 3","D) 5"]'::jsonb,'B',
 '["The primes in the inclusive interval 411 to 424 are 419 and 421.","All other numbers in this interval are even or composite.","There are 2 primes, so the answer is B) 2."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 3 (printed page 2), Q6; 13/08/2025 Shift-2',true,2,0.8,true
),
(
 'b1000000-0000-4000-8000-000000000007','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='number-system'),
 'The number 541096943 is divisible by which of the following?',
 '["A) 103","B) 87","C) 107","D) 97"]'::jsonb,'D',
 '["Divide 541096943 by each candidate.","541096943 ÷ 97 = 5578319 exactly; its remainder is 0.","The other listed divisors do not divide it exactly, so the answer is D) 97."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 3 (printed page 2), Q7; 14/08/2025 Shift-1',true,2,0.8,true
),
(
 'b1000000-0000-4000-8000-000000000008','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='number-system'),
 'The number of prime numbers lying between 488 and 494, both included, is:',
 '["A) 3","B) 1","C) 4","D) 2"]'::jsonb,'B',
 '["The only prime in the inclusive interval 488 to 494 is 491.","489 is divisible by 3, 493=17×29, and the remaining even numbers are composite.","The count is 1, so the answer is B) 1."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 3 (printed page 2), Q8; 22/08/2025 Shift-3',true,2,0.8,true
),
(
 'b1000000-0000-4000-8000-000000000009','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='number-system'),
 'The number of prime numbers lying between 476 and 485, both included, is:',
 '["A) 2","B) 4","C) 1","D) 6"]'::jsonb,'C',
 '["The only prime in the inclusive interval 476 to 485 is 479.","481=13×37, 483 is divisible by 3, 485 is divisible by 5, and the other values are even or composite.","The count is 1, so the answer is C) 1."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 3 (printed page 2), Q9; 20/08/2025 Shift-1',true,2,0.8,true
),
(
 'b1000000-0000-4000-8000-000000000010','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='number-system'),
 'The number of prime numbers lying between 476 and 491, both included, is:',
 '["A) 4","B) 3","C) 2","D) 5"]'::jsonb,'B',
 '["The primes in the inclusive interval 476 to 491 are 479, 487 and 491.","All other integers in the interval are even or composite.","There are 3 primes, so the answer is B) 3."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 3 (printed page 2), Q10; 13/08/2025 Shift-1',true,2,0.8,true
)
on conflict (id) do update set
  exam_id=excluded.exam_id,
  topic_id=excluded.topic_id,
  question_text=excluded.question_text,
  options=excluded.options,
  answer_key=excluded.answer_key,
  solution_steps=excluded.solution_steps,
  source_document=excluded.source_document,
  source_page=excluded.source_page,
  source_verified=excluded.source_verified,
  difficulty=excluded.difficulty,
  syllabus_weight=excluded.syllabus_weight,
  active=excluded.active;
