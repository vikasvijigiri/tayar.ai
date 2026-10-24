-- Idempotent incremental seed: add 12 exact-source questions and seven topic categories.
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
