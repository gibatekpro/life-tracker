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
  - Expense and Income link to a `Category` (`CategoryId`); a Transfer never has one (also a check constraint).
- **Categories** – a tree of any depth (`ParentId`), each `Expense` or `Income` (a subcategory takes its parent's kind), with `SortOrder`, `IsArchived` and an optional `DefaultMonthlyAmount` (£, spending only). Names are unique among siblings of the same kind (NULLS NOT DISTINCT). Rules live in `CategoryService`: nothing moves under itself, a category with transactions, subcategories or budget history is archived, not deleted (409). `CategoryTree` (pure) builds paths ("Subscriptions › AI › Claude"); transactions return the path.
- **Balance rule** (`Features/Accounts/BalanceRules.cs`): money out of an asset lowers its balance, money out of a liability raises it; money in does the opposite. Balances are stored and changed only through `LedgerService` (record; update = undo + redo; delete = undo), in the same SaveChanges as the transaction.
- **Currencies** – each account has a `Currency` (GBP, or NGN for Nigerian accounts, Lemfi-style wallets and loan apps) and its balance is in that currency. A transfer between currencies stores what was sent (`Amount`) and what arrived (`ToAmount`). Every transaction stores `GbpAmount` for £ totals: exact when one side is GBP, a typed-in value, or converted at the rate from my latest GBP↔currency transfer (`ExchangeRateService`). No rate feed.
- **Nigerian loan apps** – `Loan` accounts in NGN with Balance = total repayable (interest and fees included), APR 0, MonthlyPayment = instalment, so interest isn't counted twice.
- **Monthly summary** – spending = `Type == Expense` only, summed as `GbpAmount`, rolled up to top-level categories. Income depends on `Settings.IncomeMode` (`SummaryService.IncomeAsync`, shared with budgets): `Fixed` = `MonthlyIncome`, `Recorded` = Income transactions in the period.
- **Budget months** – `Settings.MonthStartDay` (1-28, payday) sets when a month starts; `BudgetPeriod` (Features/Summary) works out the dates. With no year/month, the summary returns the period I'm in now. The web takes period dates from the summary rather than computing them.
- **Budgets** (`Features/Budgets`) – a month's line for a category or a debt = this month's `BudgetMonthAmount` if set, otherwise the default (`Category.DefaultMonthlyAmount`; for a debt, the account's `MonthlyPayment` in £). Figures are found by the month they're for, so changing payday doesn't move them. `BudgetCalculator` (pure, unit-tested) does all the maths: roll-up (parent = own + children; spending on a parent counts against its own amount), pace, per-day allowance, unallocated (income − planned) and safe-to-spend (income − spent − what's still set aside on every line, per day left). `BudgetService` gathers the numbers in £.
- **Debts** – `/debts`, `/debts/avalanche` and `/debts/{id}/what-if` are read-only views over CreditCard/Loan accounts. Totals and the avalanche plan are in £ (other currencies converted at the latest transfer rate; ones with no rate are left out and listed). The avalanche budget for the current budget month = that month's debt lines once any debt figure is set for it, otherwise `Settings.MonthlyDebtBudget` (`BudgetService.AvalancheAsync`); the plan also suggests each debt's first-month payment. Payment history = transfers into the account (`/accounts/{id}/payments`).
- **Apple Pay capture** (`/capture/apple-pay`) – resolves the account from the card name by alias, then account name, then `Settings.DefaultAccountId`; guesses the category by merchant keyword, resolved to a category by name (falling back to "Other"); records an Expense and answers `{ transaction, budget, notification }`, e.g. "Food: £150.00 of £200.00 · £3.33/day left".
- Enums are stored as strings in Postgres and sent as strings in JSON.

## Web app (web/)
- **Tooling** – Tailwind CSS v4 (Vite plugin), React Router 8 (lazy routes per page), Recharts for charts.
- **Design tokens** – every colour lives in `src/index.css` (`@theme static`: `canvas`, `surface`, `ink`, `muted`, `accent`, `positive`, `negative`, `warning`, `chart-1..6`). Dark mode only swaps token values, so components never use `dark:` classes. Charts read tokens through `useTokens()`.
- **Structure** – `components/ui` (Button, Card, Field/MoneyInput/Select, Modal on native `<dialog>`, Badge, Money, Stat, …), `components/layout` (AppLayout: sidebar on desktop, bottom tabs on phones), `features/<area>` for pages (overview, transactions, budget, accounts, plan, settings, categories), `lib/format.ts` for money and dates.
- **Data** – `api.ts` calls every endpoint and turns API errors into `Error` messages. Pages load with `useData(key, load)`; after any save, call `refresh()` (`data/refresh.ts`) and every `useData` on screen reloads.
- **One transaction form** – opened from anywhere: `useQuickAdd()(draft?)` for a new one ("Pay" on a debt opens a prefilled transfer), `useEditTransaction()(t)` to edit or delete; tapping a TransactionRow edits it.
- **Categories in the UI** – managed in Settings → Categories; `CategorySelect` lists them in tree order labelled with their path, only of the right kind, hiding archived ones.
- **Tailwind gotcha** – two classes for the same property (e.g. `p-4` and `p-0`) don't override by order in the markup; add an option to the component (like Card's `flush`) instead.

## Database migrations
- `AccountsAndTransfers` converted the old Debts/DebtPayments/spending-flags model; it is hand-written SQL and has no `Down()` (restore a backup instead).
- `AddCategories` turned the text labels into categories (hand-written, with a `Down()` that puts the labels back); `AddBudgets` only adds `BudgetMonthAmounts`. Both have Testcontainers tests.
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