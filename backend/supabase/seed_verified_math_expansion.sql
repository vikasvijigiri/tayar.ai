-- Optional incremental seed for the 24-question expansion; safe to rerun.
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
