# Mucho8s security review — 12 October 2026

## Scope and limits

This is a targeted code review and permission test, not a certification or a complete authenticated penetration test. Production checks were bounded: anonymous reads and invalid-session requests. No legitimate match, ranking, payment or wallet was intentionally changed by the tests. Potentially mutating production probes were blocked by automatic approval review and replaced with mocked endpoint tests.

Full tests between two real authenticated players, browser-based XSS testing, concurrency attacks, rate-limit load tests, backup restoration, account MFA and infrastructure settings remain outside the verified scope. Public rankings and tournament summaries remain intentionally readable; private participation is not equivalent to a private website.

## Fixes deployed to Supabase

- Eight admin validators now require a current approved account, active admin grant, matching username and account-bound active credentials on every request. Removing the admin grant now removes access at these endpoints.
- Invalid expiry timestamps are rejected in admin authentication and wallet checks, rather than passing JavaScript comparisons involving NaN.
- The public profile endpoint no longer queries or returns PayPal, Revolut or CMG destinations. Verified approved members can still access these fields. Profile responses are not publicly cached.
- Previously applied database hardening revokes client execution of eight internal award trigger functions and fixes the Elo helper search path.

Eleven Edge Functions were deployed. Production-only versions of the competition and match-report functions were patched in place, preserving their existing non-security behavior. The corresponding repository versions retain their pre-existing map and season changes.

## Frontend and build changes

- Profile requests send the current Discord access token. On session changes the profile cache is cleared, and obsolete requests cannot repopulate it.
- Axios upgraded from 1.18.0 to 1.20.0, PostCSS from 8.5.10 to 8.5.23, React Router DOM from 7.15.0 to 7.18.4 in response to package audit findings.
- Frontend Supabase version pinned to the resolved package version; dependency lockfile added.
- CI uses Node 24, npm ci, and permission/privacy regression tests. AJV versions needed by the current build are explicit dependencies.

## Evidence

| Check | Result |
|---|---|
| Regression tests | 80 passing tests across admin permissions, profile privacy, denied mutations, wallet authorization and retired importer |
| Live invalid admin sessions | Write, account, content, Discord, audit and wallet endpoints returned 401 or 403 |
| Live anonymous private table reads | Credentials, sessions, accounts, wallets and challenge messages returned 401 |
| Live public profile response | HTTP 200, zero payment destinations, Cache-Control: no-store |
| Database RLS | No public application tables without RLS in the checked catalog |
| Public database function execution | No public-schema functions callable by anon/authenticated in the checked catalog |
| Storage | Evidence buckets private, 5 MiB limits, PNG/JPEG/WebP allowlist |
| Git history secret scan | 1,600 historical blobs checked; no matching service-role JWTs, Supabase secret keys, GitHub tokens, private keys or Discord webhook URLs |
| Frontend compilation | Production build succeeds with existing source-map, lint and bundle-size warnings |

Secret detection is pattern-based and cannot prove that every possible secret is absent. Successful unauthenticated checks do not prove that authenticated cross-account access is safe.

## Remaining work

1. Enable compromised-password protection where supported, verify MFA on GitHub/Supabase/Discord and verify backup/restore settings with the owner. These settings were not changed through the available tools.
2. Test authenticated player-versus-player access using designated test accounts and fixtures, including reports, evidence downloads, teams, ranked lobbies and wallets.
3. Add and verify centralized request/body limits and atomic rate limiting for authenticated write endpoints. The existing admin password login limiter is not equivalent to platform-wide abuse protection.
4. Review browser content injection and all external link/media handling with a browser and test fixtures. No browser penetration test was performed.
5. Modernize the build chain. The dependency audit decreased from 105 findings (65 high, no critical) to 103 findings (63 high, no critical). Remaining advisories include old react-scripts, CRACO, Tailwind and transitive build tools. These counts describe the installed dependency graph, not 63 demonstrated exploitable vulnerabilities in the deployed static site. Major build-tool replacements were not forced during this security patch.
6. Review which player/tournament data should remain publicly accessible as the Circle grows.

Run the local suite with Node 24 after installing frontend dependencies:

```sh
cd Mucho8s_clean/frontend
npm ci --legacy-peer-deps
node --test ../supabase/tests/*.cjs
```
