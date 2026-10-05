# Mucho Wallet — demo

The Wallet route (`#/wallet`) supports a persistent **virtual EUR balance**,
PayPal/Revolut request labels, admin-reviewed deposits and withdrawals,
withdrawal reservations, cancellation and an append-only transaction history.
Every screen and operation is explicitly a simulation. No provider API is
called, no real money is collected or sent, and existing match payment flows
and Won/Lost/Net statistics remain independent.

## Installation

Apply `supabase/migrations/20261005122709_mucho_demo_wallet.sql` and deploy
`supabase/functions/mucho8s-wallet/index.ts`. The function uses the existing
Supabase URL and service-role environment variables. Disable the gateway JWT
check for this function: it authenticates every request itself with
`auth.getUser`, supports the project's current JWT signing configuration, and
rejects missing, invalid or unapproved account sessions. Admin mutations also
require an unexpired, non-revoked admin session bound to the same account and
user agent, plus active credentials and the existing admin allowlist.

Tables have RLS enabled and **no client-role access**. Only the server's service
role may read or mutate them. SQL functions use SECURITY INVOKER and are
executable only by that service role. Request and review operations lock the
wallet row, update reservations/balances and append ledger entries atomically.
Idempotency keys and terminal-state checks prevent duplicate credits/debits.
Provider names and destinations are snapshots for the demo; user-supplied
account names never authorize operations or choose another user's wallet.

## Try it

1. Sign in with an approved Circle Discord account and open Wallet.
2. Request a 10 € demo deposit using either provider and a sample account name.
3. An authenticated admin opens Wallet → Gestione admin → Conferma prova.
4. Request a 5 € demo withdrawal: available is 5 €, reserved is 5 €, total is 10 €.
5. Cancel or reject to release the hold; confirm the simulation to debit once.
6. Refresh or reopen the page to verify persistence. Updates poll every 15 seconds.

Run `supabase/tests/wallet.sql` as the database owner for a rollback-only
integration test. It must leave no test request or changed balance behind.

## Real payments are a separate integration

Do not treat admin confirmation, a redirect, a screenshot, a PayPal.me URL or
a Revolut tag as proof of payment. Before enabling real funds, choose providers
that authorize this competition use and establish the applicable operating
requirements. Implement verified provider events, external transaction
deduplication, reconciliation, refunds and payout failure handling in a
separate real-money ledger. The demo mode constraint cannot be switched to
real payments by a browser or admin UI toggle. Match-funded escrow is not
implemented in this first demo.
