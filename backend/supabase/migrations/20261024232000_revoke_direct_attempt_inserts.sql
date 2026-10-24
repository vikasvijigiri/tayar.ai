-- Keep attempt correctness authoritative: only the backend service role may insert.
-- Users retain SELECT access to their own attempts under the existing RLS policy.
REVOKE INSERT ON TABLE public.attempts FROM anon, authenticated;
