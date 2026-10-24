-- Prevent duplicate answer attempts when mobile clients retry after network timeouts.
alter table public.attempts
  add column if not exists idempotency_key uuid;

create unique index if not exists attempts_user_idempotency_key_uidx
  on public.attempts(user_id, idempotency_key);
