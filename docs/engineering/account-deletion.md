# Account deletion lifecycle

## API contract

- Method/path: DELETE /v1/account
- Authentication: Authorization: Bearer <Supabase access token>
- Body: {"confirmation":"DELETE MY ACCOUNT"}
- Success: 200 {"deleted": true}
- Cache: Cache-Control: private, no-store

The route does not accept a user ID. It validates the supplied bearer token through Supabase Auth's /auth/v1/user endpoint, derives and validates the returned UUID, then uses the server-only service-role key to delete that exact Auth user.

## Step-up authentication

The route requires a recent (five-minute) original authentication method in the verified token's amr claim. A recent iat alone is insufficient because a refresh operation can issue a new access token without a new user authentication. token_refresh AMR entries do not satisfy the requirement.

If the session is stale, the API returns 403. The mobile client intentionally calls the endpoint through the raw timeout-bounded fetch helper rather than its automatic refresh wrapper, signs the user out, and asks them to sign in again before retrying.

## Data deletion

The schema defines:

~~~sql
user_id uuid not null references auth.users(id) on delete cascade
~~~

Deleting the verified Supabase Auth user therefore cascades to that user's public.attempts records. The endpoint does not delete question-bank content or another user's records.

## Mobile behavior

The Services screen presents a native destructive confirmation dialog. On success, the app clears account-scoped learning state, access/refresh tokens, OAuth verifier, phone and OTP input state. If secure-storage cleanup fails, the user is warned to restart the app.

## Automated coverage

The backend tests cover:
- missing bearer authentication;
- stale authentication;
- rejection of a token_refresh AMR as recent sign-in;
- exact confirmation phrase;
- verified-user-only deletion target;
- private/no-store response headers; and
- DELETE CORS preflight.

The mobile smoke test verifies the destructive confirmation and that the deletion request bypasses automatic token refresh.

## Release verification still required

Mocked CI tests do not prove production Supabase behavior. Before public release, run the complete lifecycle in a dedicated non-production Supabase project:
1. create a test account and authenticated session;
2. persist at least one attempt for that user and one for a second user;
3. call deletion with a fresh OTP/OAuth session;
4. verify the target Auth user and all target attempts are gone;
5. verify the second user's account and attempts remain intact;
6. verify refresh tokens and prior access tokens can no longer access protected endpoints;
7. verify the app clears secure storage and returns to sign-in;
8. retain redacted request IDs, test results, and database assertions as evidence.

Never run destructive lifecycle tests against production user data.
