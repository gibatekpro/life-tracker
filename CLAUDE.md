# Life Tracker

A personal life-tracking app: spending, debt payoff, habits and personal growth.

## Stack
- **api/** – ASP.NET Core Web API (.NET 10, pinned in global.json), project `LifeTracker.Api`
- **web/** – React + TypeScript (Vite) dashboard; the dev server proxies `/api` to the API on port 5080
- **mobile/** – React Native with Expo for iPhone (not created yet)
- **Database** – PostgreSQL 17 via Docker Compose (`docker-compose.yml` at repo root, credentials in `.env`, never committed)
- **ORM** – EF Core with the Npgsql provider
- **API testing** – Scalar UI at `/scalar` (reads the OpenAPI doc)
- **API style** – Minimal APIs (I'm experienced with controllers and learning minimal APIs here), endpoints grouped with MapGroup in extension methods
- **Tests** – xUnit in `tests/`. `dotnet test` runs everything; `dotnet test --filter "Category!=Integration"` skips the Testcontainers tests (those need Docker)

## Money model
- **Account** – `Current` (Balance = money held), `CreditCard` or `Loan` (Balance = amount owed). Cards can have a `CreditLimit`; `AvailableCredit` is computed, not stored. **Aliases** map other names (the card name Apple Pay sends, e.g. "Lloyd's") to an account, matched ignoring case and punctuation.
- **Transaction** – always has an `AccountId` and a `Type`:
  - `Expense`: money leaves `AccountId` (counts as spending)
  - `Income`: money arrives in `AccountId` (on a card it's a refund)
  - `Transfer`: money moves `AccountId` → `ToAccountId`; never spending. Paying a card = Transfer from a Current account to the card.
  - A check constraint enforces that `ToAccountId` is set iff the type is Transfer, and differs from `AccountId`.
- **Balance rule** (`Features/Accounts/BalanceRules.cs`): money out of an asset lowers its balance, money out of a liability raises it; money in does the opposite. Balances are stored and changed only through `LedgerService` (record, or correct = undo + redo), in the same SaveChanges as the transaction.
- **Currencies** – each account has a `Currency` (GBP, or NGN for Nigerian accounts, Lemfi-style wallets and loan apps) and its balance is in that currency. A transfer between currencies stores what was sent (`Amount`) and what arrived (`ToAmount`). Every transaction stores `GbpAmount` for £ totals: exact when one side is GBP, a typed-in value, or converted at the rate from my latest GBP↔currency transfer (`ExchangeRateService`). No rate feed.
- **Nigerian loan apps** – `Loan` accounts in NGN with Balance = total repayable (interest and fees included), APR 0, MonthlyPayment = instalment, so interest isn't counted twice.
- **Monthly summary** – spending = `Type == Expense` only, summed as `GbpAmount`; income is still `Settings.MonthlyIncome` (not summed from Income transactions, yet).
- **Debts** – `/debts`, `/debts/avalanche` and `/debts/{id}/what-if` are read-only views over CreditCard/Loan accounts. Totals and the avalanche plan are in £ (other currencies converted at the latest transfer rate; ones with no rate are left out and listed). Payment history = transfers into the account (`/accounts/{id}/payments`).
- **Apple Pay capture** (`/capture/apple-pay`) – resolves the account from the card name by alias, then account name, then `Settings.DefaultAccountId`, and records an Expense.
- Enums are stored as strings in Postgres and sent as strings in JSON.

## Database migrations
- `AccountsAndTransfers` converted the old Debts/DebtPayments/spending-flags model; it is hand-written SQL and has no `Down()` (restore a backup instead).
- EF scaffolds a renamed entity as drop + create: always read a generated migration before applying it.
- Back up before applying a migration: `docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" lifetracker' > backup-<date>.sql` (`backup-*.sql` is git-ignored).

## Roadmap
1. **Money module (current):** accounts, transactions and transfers, categories, monthly summary, debt payoff projections
2. Expo iPhone app for quick entries + Apple Pay auto-capture via an iOS Shortcuts "Transaction" automation posting to the API (the capture endpoint is done)
3. Bank sync for Lloyds and Revolut via Open Banking (Enable Banking, personal-use tier)
4. Later modules: habits, skills/learning log, app portfolio, projections

## How to work with me
- This is a learning project. I'm an experienced C#/.NET and React developer growing my skills.
- Explain what you're doing and why. Prefer guiding me and reviewing my code over writing everything yourself.
- When you introduce a new library, pattern or tool, explain it briefly before using it.
- Keep commits small and focused.

   ## Future plans
   - Long-term roadmap: docs/ROADMAP.md. Reference only — don't act on it unless I ask.