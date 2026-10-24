CREATE UNIQUE INDEX IF NOT EXISTS attempts_user_idempotency_key_uidx
  ON public.attempts(user_id, idempotency_key);
