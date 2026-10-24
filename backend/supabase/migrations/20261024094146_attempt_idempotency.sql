-- Idempotent baseline for the already-applied Supabase migration
-- 20261024094146_attempt_idempotency. The same column/index are also represented
-- in backend/supabase/schema.sql for clean project initialization.

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS attempts_user_idempotency_key_uidx
  ON public.attempts (user_id, idempotency_key);
