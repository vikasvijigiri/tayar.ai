-- Curated 50-question source-verified bank across twelve maths topics.
-- Question text, options, answer keys, shift/date details and source pages were checked
-- directly against the uploaded PDFs. Solution steps are independently authored and
-- arithmetically checked; they are not claimed to be verbatim PDF explanations.
-- Sources:
--  * RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf:
--    PDF page 3 Q1-Q10; PDF page 32 Q283, Q289; pages 33-34 Q293, Q296, Q305, Q312; PDF page 68 Q573, Q577; page 77 Q655, Q663; page 86 Q735; page 101 Q850, Q855; page 114 Q960; page 171 Q1407-Q1408; page 43 Q383-Q384;
--    PDF page 139 Q1173, Q1175-Q1179; PDF page 140 Q1181, Q1183, Q1184, Q1187;
--    PDF pages 157-159 Q1287, Q1288, Q1295-Q1298, Q1300, Q1303, Q1304, Q1306, Q1308.
--  * RRB NTPC CBT-2 2024-25 (Undergraduate level)  English.pdf: PDF page 1 Q4.
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

insert into public.topics (id, exam_id, name, slug)
values
  ('a1000000-0000-4000-8000-000000000002','rrb_ntpc','L.C.M and H.C.F','lcm-hcf'),
  ('a1000000-0000-4000-8000-000000000003','rrb_ntpc','Percentage','percentage'),
  ('a1000000-0000-4000-8000-000000000004','rrb_ntpc','Time and Work','time-and-work'),
  ('a1000000-0000-4000-8000-000000000005','rrb_ntpc','Pipe and Cistern','pipe-and-cistern')
on conflict (exam_id, slug) do update
set name = excluded.name;

insert into public.questions (
  id, exam_id, topic_id, question_text, options, answer_key,
  solution_steps, source_document, source_page, source_verified,
  difficulty, syllabus_weight, active
)
values
(
 'a2000000-0000-4000-8000-000000000001','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='lcm-hcf'),
 'The HCF of two numbers is 9 and the product of the two numbers is 8100. How many pairs of numbers satisfy the given conditions?',
 '["A) 4","B) 2","C) 5","D) 3"]'::jsonb,'B',
 '["Let the two numbers be 9a and 9b, where a and b are coprime.","Their product gives 81ab=8100, so ab=100.","The coprime factor pairs of 100 are (1,100) and (4,25), giving 2 pairs."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 32 (printed page 31), Q283; 19/08/2025 Shift-2',true,3,0.9,true
),
(
 'a2000000-0000-4000-8000-000000000002','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='percentage'),
 'The population of a district is 374000, out of which 170000 are males. 78% of the population is literate. If 72% males are literate, then what percentage of females are literate?',
 '["A) 81%","B) 85%","C) 83%","D) 80%"]'::jsonb,'C',
 '["Total literate people = 374000 × 78% = 291720.","Literate males = 170000 × 72% = 122400, so literate females = 291720 − 122400 = 169320.","Females = 374000 − 170000 = 204000; 169320 ÷ 204000 × 100 = 83%."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 158 (printed page 157), Q1295; 28/08/2025 Shift-2',true,3,0.9,true
),
(
 'a2000000-0000-4000-8000-000000000003','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='time-and-work'),
 '2 men can complete a piece of work in 18 days, while 4 women can do it in 6 days. In how many days can 6 women and 9 men complete this work?',
 '["A) 1 day","B) 3 days","C) 4 days","D) 2 days"]'::jsonb,'D',
 '["One man’s rate is 1/(2×18) = 1/36 of the work per day.","One woman’s rate is 1/(4×6) = 1/24 of the work per day.","9 men work at 9/36 = 1/4 per day; 6 women work at 6/24 = 1/4 per day. Combined rate is 1/2, so the work takes 2 days."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 139 (printed page 138), Q1173; 22/08/2025 Shift-2',true,2,0.9,true
),
(
 'a2000000-0000-4000-8000-000000000004','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='pipe-and-cistern'),
 'Two pipes can fill a cistern, individually, in 99 min and 90 min, respectively. There is a pipe located at the bottom of the cistern to empty it. If all the three pipes are opened simultaneously, then the empty cistern gets filled in 50 min. How long will the pipe at the bottom of the tank take to empty the completely filled cistern if no other pipe is then open?',
 '["A) 841 min","B) 825 min","C) 822 min","D) 815 min"]'::jsonb,'B',
 '["The two inlet pipes fill at 1/99 + 1/90 = 7/330 of the cistern per minute.","With the drain open, the net filling rate is 1/50 per minute.","Drain rate = 7/330 − 1/50 = 1/825 of the cistern per minute, so the drain alone empties it in 825 minutes."]'::jsonb,
 'RRB NTPC CBT-2 2024-25 (Undergraduate level)  English.pdf',
 'PDF page 1, Q4; Test Date 20/12/2025',true,3,1.0,true
),
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


-- Additional 24 questions, exact wording/options checked against the uploaded chapterwise PDF.
-- Correct answers were independently calculated; source answer labels and shift metadata are retained.
insert into public.questions (
  id, exam_id, topic_id, question_text, options, answer_key,
  solution_steps, source_document, source_page, source_verified,
  difficulty, syllabus_weight, active
)
values
(
 'c2000000-0000-4000-8000-000000000001','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='lcm-hcf'),
 'The LCM of the numbers 2.8 and 0.217 is:',
 '["A) 86.8","B) 8.68","C) 868","D) 0.868"]'::jsonb,'A',
 '["2.8 = 2800/1000 and 0.217 = 217/1000.","LCM(2800,217) = 86800; rescaling by 1000 gives 86.8."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 32 (printed page 31), Q289; 04/09/2025 Shift-2',true,2,0.8,true
),
(
 'c2000000-0000-4000-8000-000000000002','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='lcm-hcf'),
 'The LCM of the numbers 2.7 and 0.096 is:',
 '["A) 2.16","B) 216","C) 0.216","D) 21.6"]'::jsonb,'D',
 '["2.7 = 2700/1000 and 0.096 = 96/1000.","LCM(2700,96) = 21600; rescaling by 1000 gives 21.6."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 33 (printed page 32), Q293; 07/08/2025 Shift-2',true,2,0.8,true
),
(
 'c2000000-0000-4000-8000-000000000003','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='lcm-hcf'),
 'Find the H.C.F. and L.C.M. of 0.48, 1.20 and 1.68.',
 '["A) H.C.F. = 0.24; L.C.M. = 4.80","B) H.C.F. = 0.24; L.C.M. = 16.8","C) H.C.F. = 0.12; L.C.M. = 2.40","D) H.C.F. = 0.12; L.C.M. = 1.68"]'::jsonb,'B',
 '["Multiply each number by 100: 48, 120 and 168; their H.C.F. is 24 and L.C.M. is 1680.","Rescale by 100: H.C.F. = 0.24 and L.C.M. = 16.8."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 33 (printed page 32), Q296; 29/08/2025 Shift-3',true,3,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000004','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='lcm-hcf'),
 'The LCM of two numbers is seven times their HCF. The difference between the HCF and LCM is 222. Find the product of the two numbers.',
 '["A) 9276","B) 9583","C) 9086","D) 9158"]'::jsonb,'B',
 '["Let H.C.F. = h; L.C.M. = 7h. Then 6h = 222, so h = 37 and L.C.M. = 259.","Product of the two numbers = H.C.F. × L.C.M. = 37 × 259 = 9583."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 34 (printed page 33), Q305; 18/08/2025 Shift-3',true,2,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000005','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='lcm-hcf'),
 'The LCM of the numbers 6.3 and 0.07 is:',
 '["A) 6.3","B) 0.063","C) 63","D) 0.63"]'::jsonb,'A',
 '["6.3 ÷ 0.07 = 90, so 6.3 is an integer multiple of 0.07.","The LCM of 6.3 and 0.07 is 6.3."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 34 (printed page 33), Q312; 12/08/2025 Shift-3',true,1,0.8,true
),
(
 'c2000000-0000-4000-8000-000000000006','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='time-and-work'),
 '9 men can complete a piece of work in 8 days, while 4 women can do it in 9 days. In how many days can 2 women and 4 men complete this work?',
 '["A) 8 days","B) 6 days","C) 9 days","D) 11 days"]'::jsonb,'C',
 '["One man works at 1/72 per day and one woman at 1/36 per day.","Four men plus two women work at 1/18 + 1/18 = 1/9 per day, so they need 9 days."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 139 (printed page 138), Q1175; 18/08/2025 Shift-2',true,2,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000007','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='time-and-work'),
 '9 men can complete a piece of work in 16 days, while 5 women can do it in 18 days. In how many days can 2 women and 4 men complete the work?',
 '["A) 15 days","B) 18 days","C) 20 days","D) 16 days"]'::jsonb,'C',
 '["One man works at 1/144 per day and one woman at 1/90 per day.","Four men plus two women work at 1/36 + 1/45 = 1/20 per day, so they need 20 days."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 139 (printed page 138), Q1176; 09/09/2025 Shift-3',true,2,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000008','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='time-and-work'),
 '6 men can complete a piece of work in 8 days, while 3 women can do it in 18 days. In how many days can 9 women and 8 men complete this work?',
 '["A) 1 day","B) 6 days","C) 8 days","D) 3 days"]'::jsonb,'D',
 '["One man works at 1/48 per day and one woman at 1/54 per day.","Eight men and nine women work at 1/6 + 1/6 = 1/3 per day, so they need 3 days."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 139 (printed page 138), Q1177; 19/08/2025 Shift-3',true,2,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000009','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='time-and-work'),
 '5 men can complete a piece of work in 16 days, while 3 women can do it in 15 days. In how many days can 9 women and 4 men complete this work?',
 '["A) 2 days","B) 4 days","C) 1 day","D) 3 days"]'::jsonb,'B',
 '["One man works at 1/80 per day and one woman at 1/45 per day.","Four men and nine women work at 1/20 + 1/5 = 1/4 per day, so they need 4 days."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 139 (printed page 138), Q1178; 18/08/2025 Shift-3',true,2,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000010','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='time-and-work'),
 '6 men can complete a piece of work in 9 days, while 6 women can do it in 6 days. In how many days can 2 women and 3 men complete this work?',
 '["A) 10 days","B) 12 days","C) 9 days","D) 11 days"]'::jsonb,'C',
 '["One man works at 1/54 per day and one woman at 1/36 per day.","Three men and two women work at 1/18 + 1/18 = 1/9 per day, so they need 9 days."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 139 (printed page 138), Q1179; 08/08/2025 Shift-1',true,2,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000011','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='time-and-work'),
 '4 men can complete a piece of work in 12 days, while 8 women can do it in 15 days. In how many days can 3 women and 2 men complete this work?',
 '["A) 19 days","B) 14 days","C) 11 days","D) 15 days"]'::jsonb,'D',
 '["One man works at 1/48 per day and one woman at 1/120 per day.","Two men and three women work at 1/24 + 1/40 = 1/15 per day, so they need 15 days."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 140 (printed page 139), Q1181; 01/09/2025 Shift-3',true,2,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000012','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='time-and-work'),
 '4 men can complete a piece of work in 18 days, while 9 women can do it in 8 days. In how many days can 3 women and 6 men complete this work?',
 '["A) 11 days","B) 13 days","C) 4 days","D) 8 days"]'::jsonb,'D',
 '["One man and one woman each work at 1/72 per day.","Six men and three women work at 9/72 = 1/8 per day, so they need 8 days."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 140 (printed page 139), Q1183; 21/08/2025 Shift-3',true,2,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000013','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='time-and-work'),
 '5 men can complete a piece of work in 18 days, while 9 women can do it in 5 days. In how many days can 3 women and 3 men complete this work?',
 '["A) 7 days","B) 10 days","C) 8 days","D) 5 days"]'::jsonb,'B',
 '["One man works at 1/90 per day and one woman at 1/45 per day.","Three men and three women work at 1/30 + 1/15 = 1/10 per day, so they need 10 days."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 140 (printed page 139), Q1184; 20/08/2025 Shift-1',true,2,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000014','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='time-and-work'),
 '8 men can complete a piece of work in 5 days, while 8 women can do it in 15 days. In how many days can 3 women and 4 men complete this work?',
 '["A) 9 days","B) 7 days","C) 8 days","D) 5 days"]'::jsonb,'C',
 '["One man works at 1/40 per day and one woman at 1/120 per day.","Four men and three women work at 1/10 + 1/40 = 1/8 per day, so they need 8 days."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 140 (printed page 139), Q1187; 29/08/2025 Shift-3',true,2,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000015','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='percentage'),
 'In an election between two candidates, 80% of the registered voters cast their vote and 21% of the votes polled were found invalid. The winning candidate got 51% of the valid votes and won the election by a margin of 1817 votes. How many voters were registered?',
 '["A) 143753","B) 143750","C) 143751","D) 143752"]'::jsonb,'B',
 '["Valid votes = 80% × 79% = 63.2% of registered voters.","The winning margin is 2% of valid votes = 1.264% of registered voters; 1817 ÷ 0.01264 = 143750."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 157 (printed page 156), Q1287; 14/08/2025 Shift-3',true,3,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000016','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='percentage'),
 'In an election between two candidates 96 % of the registered voters cast their vote and 10 % of the votes polled were found invalid. Winning candidate got 57 % of the valid votes and won the election by a margin of 378 votes. How many voters were registered?',
 '["A) 3125","B) 3123","C) 3122","D) 21872"]'::jsonb,'A',
 '["Valid votes = 96% × 90% = 86.4% of registered voters.","The winning margin is 14% of valid votes = 12.096% of registered voters; 378 ÷ 0.12096 = 3125."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 157 (printed page 156), Q1288; 03/09/2025 Shift-1',true,3,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000017','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='percentage'),
 'The income of Raman is ₹44,200. He saves 31% of his income. If his income increases by 22% and expenditure increases by 50%, then his savings will:',
 '["A) increase by ₹5,530","B) decrease by ₹5,524","C) increase by ₹5,521","D) decrease by ₹5,525"]'::jsonb,'D',
 '["Original savings = ₹13,702 and expenditure = ₹30,498.","New income = ₹53,924; new expenditure = ₹45,747; new savings = ₹8,177, a decrease of ₹5,525."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 158 (printed page 157), Q1296; 02/09/2025 Shift-2',true,3,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000018','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='percentage'),
 'The population of a district is 342000, out of which 228000 are males. 44% of the population is literate. If 59% males are literate, then what percentage of females are literate?',
 '["A) 14%","B) 12%","C) 17%","D) 16%"]'::jsonb,'A',
 '["Total literate = 342000 × 44% = 150480; literate males = 228000 × 59% = 134520.","Literate females = 15960; females = 114000; 15960 ÷ 114000 × 100 = 14%."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 158 (printed page 157), Q1297; 01/09/2025 Shift-2',true,3,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000019','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='percentage'),
 'The income of Raman is ₹34,000. He saves 28% of his income. If his income increases by 11% and expenditure increases by 30%, then his savings will:',
 '["A) increase by ₹5,639","B) decrease by ₹3,604","C) increase by ₹3,644","D) decrease by ₹5,649"]'::jsonb,'B',
 '["Original savings = ₹9,520 and expenditure = ₹24,480.","New income = ₹37,740; new expenditure = ₹31,824; new savings = ₹5,916, a decrease of ₹3,604."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 158 (printed page 157), Q1298; 04/09/2025 Shift-2',true,3,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000020','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='percentage'),
 'In an election between two candidates 87% of the registered voters cast their vote and 5% of the votes polled were found invalid. The winning candidate got 52% of the valid votes and won the election by a margin of 1653 votes. How many voters were registered?',
 '["A) 50003","B) 50001","C) 50000","D) 49998"]'::jsonb,'C',
 '["Valid votes = 87% × 95% = 82.65% of registered voters.","The winning margin is 4% of valid votes = 3.306% of registered voters; 1653 ÷ 0.03306 = 50000."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 158 (printed page 157), Q1300; 19/08/2025 Shift-1',true,3,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000021','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='percentage'),
 'The population of a district is 364000, out of which 178000 are males. 63% of the population is literate. If 63% males are literate, then what percentage of females are literate?',
 '["A) 63%","B) 65%","C) 66%","D) 62%"]'::jsonb,'A',
 '["Total literate = 364000 × 63% = 229320; literate males = 178000 × 63% = 112140.","Literate females = 117180; females = 186000; 117180 ÷ 186000 × 100 = 63%."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 159 (printed page 158), Q1303; 11/08/2025 Shift-2',true,3,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000022','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='percentage'),
 'The population of a district is 362000, out of which 181000 are males. 47% of the population is literate. If 35% males are literate, then what percentage of females are literate?',
 '["A) 58%","B) 61%","C) 59%","D) 62%"]'::jsonb,'C',
 '["Total literate = 362000 × 47% = 170140; literate males = 181000 × 35% = 63350.","Literate females = 106790; females = 181000; 106790 ÷ 181000 × 100 = 59%."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 159 (printed page 158), Q1304; 12/08/2025 Shift-3',true,3,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000023','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='percentage'),
 'The population of a district is 356000, out of which 178000 are males. 39% of the population is literate. If 59% males are literate, then what percentage of females are literate?',
 '["A) 16%","B) 21%","C) 19%","D) 17%"]'::jsonb,'C',
 '["Total literate = 356000 × 39% = 138840; literate males = 178000 × 59% = 105020.","Literate females = 33820; females = 178000; 33820 ÷ 178000 × 100 = 19%."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 159 (printed page 158), Q1306; 11/08/2025 Shift-3',true,3,0.9,true
),
(
 'c2000000-0000-4000-8000-000000000024','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='percentage'),
 'The population of a district is 373000, out of which 227000 are males. 69% of the population is literate. If 69% males are literate, then what percentage of females are literate?',
 '["A) 69%","B) 67%","C) 70%","D) 68%"]'::jsonb,'A',
 '["Total literate = 373000 × 69% = 257370; literate males = 227000 × 69% = 156630.","Literate females = 100740; females = 146000; 100740 ÷ 146000 × 100 = 69%."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 159 (printed page 158), Q1308; 20/08/2025 Shift-2',true,3,0.9,true
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

-- Additional 12 exact-source questions expand coverage to 12 quantitative topics.
insert into public.topics (id, exam_id, name, slug)
values
('a1000000-0000-4000-8000-000000000006','rrb_ntpc','Average','average'),
('a1000000-0000-4000-8000-000000000007','rrb_ntpc','Ratio and Proportion','ratio-proportion'),
('a1000000-0000-4000-8000-000000000008','rrb_ntpc','Profit and Loss','profit-loss'),
('a1000000-0000-4000-8000-000000000009','rrb_ntpc','Discount','discount'),
('a1000000-0000-4000-8000-000000000010','rrb_ntpc','Simple and Compound Interest','simple-compound-interest'),
('a1000000-0000-4000-8000-000000000011','rrb_ntpc','Distance,Time and Speed','distance-time-speed'),
('a1000000-0000-4000-8000-000000000012','rrb_ntpc','Mensuration','mensuration')
on conflict (exam_id, slug) do update set name=excluded.name;

insert into public.questions (
 id, exam_id, topic_id, question_text, options, answer_key, solution_steps,
 source_document, source_page, source_verified, difficulty, syllabus_weight, active
)
values
(
 'c3000000-0000-4000-8000-000000000001','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='average'),
 'The average of first 150 odd natural numbers, is:',
 '["A) 150.5","B) 151","C) 149.5","D) 150"]'::jsonb,'D',
 '["The first n odd natural numbers are 1, 3, …, (2n−1).","Their average is (1 + (2n−1))/2 = n.","For n = 150, the average is 150 (option D)."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 68 (printed page 67), Q573; 19/08/2025 Shift-2',true,1,0.8,true
),
(
 'c3000000-0000-4000-8000-000000000002','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='average'),
 'The average of first 170 even numbers is',
 '["A) 172","B) 171","C) 170.5","D) 171.5"]'::jsonb,'B',
 '["The first 170 even numbers are 2, 4, …, 340.","For an arithmetic sequence, average = (first + last)/2 = (2 + 340)/2.","The average is 171 (option B)."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 68 (printed page 67), Q577; 07/08/2025 Shift-3',true,1,0.8,true
),
(
 'c3000000-0000-4000-8000-000000000003','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='ratio-proportion'),
 'The average price of three items of furniture is ₹15,990. If their prices are in the ratio 3 : 5 : 7, the price of the cheapest item (in ₹) is:',
 '["A) 1,066","B) 7,462","C) 3,198","D) 9,594"]'::jsonb,'D',
 '["Total price = 3 × ₹15,990 = ₹47,970.","The ratio parts sum to 3 + 5 + 7 = 15, so one part = ₹47,970 ÷ 15 = ₹3,198.","The cheapest item costs 3 parts = 3 × ₹3,198 = ₹9,594 (option D)."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 77 (printed page 76), Q655; 11/08/2025 Shift-1',true,1,0.8,true
),
(
 'c3000000-0000-4000-8000-000000000004','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='ratio-proportion'),
 'Which of the following ratios is the greatest?',
 '["A) 35 : 80","B) 37 : 56","C) 33 : 54","D) 38 : 75"]'::jsonb,'B',
 '["Compare the ratios as fractions: 35/80 = 0.4375; 37/56 ≈ 0.6607; 33/54 ≈ 0.6111; 38/75 ≈ 0.5067.","The largest value is 37/56, so option B is correct."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 77 (printed page 76), Q663; 09/09/2025 Shift-1',true,1,0.8,true
),
(
 'c3000000-0000-4000-8000-000000000005','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='profit-loss'),
 'An article is sold at a profit of 54%. If the cost price is increased by ₹75 and the selling price is reduced by ₹66, then the profit would be 40.8%. What is the original cost price (in ₹) of the article?',
 '["A) 1,300","B) 1,000","C) 1,500","D) 1,400"]'::jsonb,'A',
 '["Let the original cost price be ₹x. Original selling price = 1.54x.","After changes, selling price is 1.54x − 66 and cost price is x + 75; at 40.8% profit, 1.54x − 66 = 1.408(x + 75).","Solving gives 0.132x = 171.6, so x = ₹1,300 (option A)."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 86 (printed page 85), Q735; 14/08/2025 Shift-2',true,3,0.9,true
),
(
 'c3000000-0000-4000-8000-000000000006','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='discount'),
 'The marked price of a vehicle is ₹6,48,200. It is sold after allowing three successive discounts of 6%, 5% and 4%. Find its selling price. (Rounded off to nearest rupee)',
 '["A) ₹5,70,650","B) ₹5,48,600","C) ₹5,60,789","D) ₹5,55,689"]'::jsonb,'D',
 '["Successive discounts multiply the price by 0.94 × 0.95 × 0.96.","Selling price = ₹6,48,200 × 0.94 × 0.95 × 0.96 = ₹5,55,688.896.","Rounded to the nearest rupee, the selling price is ₹5,55,689 (option D)."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 101 (printed page 100), Q850; 03/09/2025 Shift-1',true,2,0.9,true
),
(
 'c3000000-0000-4000-8000-000000000007','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='discount'),
 'A shopkeeper is given a 10% trade discount and a 5% scheme discount (free units). On purchasing 100 units priced at ₹50 each, what is the trade discount amount?',
 '["A) ₹700","B) ₹1,000","C) ₹250","D) ₹500"]'::jsonb,'D',
 '["List value = 100 × ₹50 = ₹5,000.","Trade discount = 10% × ₹5,000 = ₹500.","The trade discount amount is ₹500 (option D)."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 101 (printed page 100), Q855; 20/08/2025 Shift-1',true,1,0.8,true
),
(
 'c3000000-0000-4000-8000-000000000008','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='simple-compound-interest'),
 'If the interest earned during the 2nd year on a certain sum is ₹9,828, and the rate of interest is 12% per annum compounded annually, then the sum is:',
 '["A) ₹73,520","B) ₹73,125","C) ₹73,475","D) ₹72,185"]'::jsonb,'B',
 '["Interest in year 2 = P × (1 + 12/100) × 12/100 = 0.1344P.","So P = ₹9,828 ÷ 0.1344 = ₹73,125.","Option B is correct."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 114 (printed page 113), Q960; 19/08/2025 Shift-1',true,3,0.9,true
),
(
 'c3000000-0000-4000-8000-000000000009','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='distance-time-speed'),
 'In covering a distance of 96 km, Anmol takes 6 hours more than Nikhil. If Anmol doubles his speed, then he would take 2 hours less than Nikhil. Anmol''s speed is:',
 '["A) 2 km/hr","B) 6 km/hr","C) 16 km/hr","D) 12 km/hr"]'::jsonb,'B',
 '["Let Anmol take t hours; Nikhil then takes t − 6 hours.","When Anmol doubles speed, his time becomes t/2, which is 2 hours less than Nikhil: t/2 = (t − 6) − 2.","Solving gives t = 16 hours, so Anmol''s speed is 96 ÷ 16 = 6 km/hr (option B)."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 171 (printed page 170), Q1407; 14/08/2025 Shift-2',true,2,0.9,true
),
(
 'c3000000-0000-4000-8000-000000000010','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='distance-time-speed'),
 'In covering a distance of 30 km, Anmol takes 7 hours more than Nikhil. If Anmol doubles his speed, then he would take 8 hours less than Nikhil. Anmol''s speed is:',
 '["A) 1 km/hr","B) 7 km/hr","C) 6 km/hr","D) 3 km/hr"]'::jsonb,'A',
 '["Let Anmol take t hours; Nikhil then takes t − 7 hours.","When Anmol doubles speed, his time becomes t/2, which is 8 hours less than Nikhil: t/2 = (t − 7) − 8.","Solving gives t = 30 hours, so Anmol''s speed is 30 ÷ 30 = 1 km/hr (option A)."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 171 (printed page 170), Q1408; 12/08/2025 Shift-1',true,2,0.9,true
),
(
 'c3000000-0000-4000-8000-000000000011','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='mensuration'),
 'A cuboid has dimensions 10 cm, 8 cm and 6 cm. If the largest possible cube is cut from one of the corners of the cuboid, what is the total surface area of the remaining portion?',
 '["A) 488 cm2","B) 376 cm2","C) 160 cm2","D) 312 cm2"]'::jsonb,'B',
 '["The largest cube has side 6 cm and is cut from a corner.","The cut removes three 6 × 6 squares from the outside but exposes three new 6 × 6 squares on the cut faces, so total surface area is unchanged.","Original cuboid surface area = 2(10×8 + 10×6 + 8×6) = 376 cm² (option B)."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 43 (printed page 42), Q383; 21/08/2025 Shift-1',true,2,0.9,true
),
(
 'c3000000-0000-4000-8000-000000000012','rrb_ntpc',
 (select id from public.topics where exam_id='rrb_ntpc' and slug='mensuration'),
 'If the radius of the base of a right circular cylinder is decreased by 46% and its height is increased by 261%, then what is the percentage increase (closest integer) in its volume?',
 '["A) 19%","B) 5%","C) 17%","D) 35%"]'::jsonb,'B',
 '["Cylinder volume is proportional to r²h.","New volume factor = 0.54² × 3.61 = 1.052676.","The increase is about 5.27%, closest to 5% (option B)."]'::jsonb,
 'RRB_NTPC_UG_2025_Exam_Maths_Questions_in_English_Hard_To_Easy_Chapterwise.pdf',
 'PDF page 43 (printed page 42), Q384; 29/08/2025 Shift-2',true,3,0.9,true
)
on conflict (id) do update set
 exam_id=excluded.exam_id, topic_id=excluded.topic_id, question_text=excluded.question_text,
 options=excluded.options, answer_key=excluded.answer_key, solution_steps=excluded.solution_steps,
 source_document=excluded.source_document, source_page=excluded.source_page,
 source_verified=excluded.source_verified, difficulty=excluded.difficulty,
 syllabus_weight=excluded.syllabus_weight, active=excluded.active;
