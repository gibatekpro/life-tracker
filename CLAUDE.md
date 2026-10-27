# Life Tracker

A personal life-tracking app: spending, debt payoff, habits and personal growth.

## Stack
- **api/** – ASP.NET Core Web API (.NET 10, pinned in global.json), project `LifeTracker.Api`
- **web/** – React + TypeScript (Vite) dashboard; the dev server proxies `/api` to the API on port 5080
- **mobile/** – React Native with Expo (SDK 58, Expo Router) for iPhone, run in Expo Go over Tailscale
- **Database** – PostgreSQL 17 via Docker Compose (`docker-compose.yml` at repo root, credentials in `.env`, never committed)
- **ORM** – EF Core with the Npgsql provider
- **API testing** – Scalar UI at `/scalar` (reads the OpenAPI doc)
- **API style** – Minimal APIs (I'm experienced with controllers and learning minimal APIs here), endpoints grouped with MapGroup in extension methods
- **Tests** – xUnit in `tests/`. `dotnet test` runs everything; `dotnet test --filter "Category!=Integration"` skips the Testcontainers tests (those need Docker). Endpoint tests use `WebApplicationFactory<Program>` in the `Testing` environment (so user secrets never load), with settings passed by `UseSetting` and fakes swapped in by `ConfigureTestServices`

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
- **Currencies** – each account has a `Currency` (supported: GBP, NGN, EUR, USD) and its balance is in that currency. A transfer between currencies stores what was sent (`Amount`) and what arrived (`ToAmount`). Every transaction stores `GbpAmount` for £ totals: exact when one side is GBP, a typed-in value, or converted at the currency → GBP rate. Stored `GbpAmount` never changes when a rate does.
- **Exchange rates** – `ExchangeRate` holds my own rate per direction (units of To per 1 From; GBP→NGN and NGN→GBP can differ). `RateResolver` (pure) picks: my rate for that direction → the inverse of my other direction → my latest transfer's rate (on or before a date) → none; `Settings.UseTransferRates` puts the transfer first. `ExchangeRateService.GetAsync/ToPoundsAsync` is the only place amounts become £. NGN→GBP values naira spending, naira debts and the avalanche; GBP→NGN pre-fills a transfer's received amount. No rate feed.
- **Nigerian loan apps** – `Loan` accounts in NGN with Balance = total repayable (interest and fees included), APR 0, MonthlyPayment = instalment, so interest isn't counted twice.
- **Monthly summary** – spending = `Type == Expense` only, summed as `GbpAmount`, rolled up to top-level categories. Income depends on `Settings.IncomeMode` (`SummaryService.IncomeAsync`, shared with budgets): `Fixed` = `MonthlyIncome`, `Recorded` = Income transactions in the period's income window, which starts `Settings.EarlyIncomeDays` (default 3) before the period, so a salary paid early for a weekend payday counts towards the right month (`BudgetPeriod.IncomeWindow`). Spending isn't shifted.
- **Budget months** – `Settings.MonthStartDay` (1-28, payday) sets when a month starts; `BudgetPeriod` (Features/Summary) works out the dates. With no year/month, the summary returns the period I'm in now. The web takes period dates from the summary rather than computing them.
- **Budgets** (`Features/Budgets`) – a month's line for a category or a debt = this month's `BudgetMonthAmount` if set, otherwise the default (`Category.DefaultMonthlyAmount`; for a debt, the account's `MonthlyPayment`). Category figures are in £; a debt's figure is in its account's currency (₦ for a naira loan) and converted to £ for the totals, with its ₦ side (planned, paid = what arrived, suggestion) carried through for display. The month's debt total is what the avalanche plan pays (its `MonthlyBudget`); anything beyond the debt lines is the "Extra for the avalanche". Figures are found by the month they're for, so changing payday doesn't move them. `BudgetCalculator` (pure, unit-tested) does all the maths: roll-up (parent = own + children; spending on a parent counts against its own amount), pace, per-day allowance, unallocated (income − planned) and safe-to-spend (income − spent − what's still set aside on every line, per day left). `BudgetService` gathers the numbers in £.
- **Debts** – `/debts`, `/debts/avalanche` and `/debts/{id}/what-if` are read-only views over CreditCard/Loan accounts. Totals and the avalanche plan are in £ (other currencies converted at the latest transfer rate; ones with no rate are left out and listed). The avalanche budget for the current budget month = that month's debt lines once any debt figure is set for it, otherwise `Settings.MonthlyDebtBudget` (`BudgetService.AvalancheAsync`); the plan also suggests each debt's first-month payment. Payment history = transfers into the account (`/accounts/{id}/payments`).
- **Apple Pay capture** (`/capture/apple-pay`) – resolves the account from the card name by alias, then account name, then `Settings.DefaultAccountId`; guesses the category by merchant keyword, resolved to a category by name (falling back to "Other"); records an Expense and answers `{ transaction, budget, notification }`, e.g. "Food: £150.00 of £200.00 · £3.33/day left".
- Enums are stored as strings in Postgres and sent as strings in JSON.

## AI insights (`Features/Insights`)
- **Key** – OpenAI's API key lives only in the API, in user secrets as `OpenAI:ApiKey` (`cd api && dotnet user-secrets set "OpenAI:ApiKey" "<key>"`), read through `OpenAIOptions` (Options pattern). It must never reach the web app, logs, the database, git or error messages. Without it, `POST /insights` returns 503 "OpenAI key not configured" and nothing else is affected. The other settings (`Model`, default `gpt-5.4-mini`; `MaxOutputTokens`; `TimeoutSeconds`; `ReasoningEffort`) are in appsettings.json.
- **Flow** – `InsightService` summarises a budget month (`BudgetService`, categories, the last 3 months' expenses, debts in £, the avalanche plan) → `InsightPromptBuilder` (pure) turns it into text → `IInsightModel` asks the model → `InsightResponseValidator` (pure) checks the JSON → saved as an `Insight` (the prompt sent, the validated answer, model, tokens). The web app only calls `/insights`, never OpenAI.
- **What's sent** – category names, merchant names (descriptions with runs of 6+ digits masked as •••), budgets, debt names, balances, APRs and the plan, all rounded to 2 places. Never account numbers, ids, aliases or my name. `InsightEndpointTests` checks this.
- **`OpenAIInsightModel`** – the only class that uses the key: structured JSON output (strict schema), capped output tokens, one timeout covering retries, and logs of tokens and timing but never content. Errors become friendly messages by status (429, 401/403, 400/404, timeout); OpenAI's own error text isn't passed on. Tests use a `FakeInsightModel`.
- **Endpoints** – `POST /insights {year, month, regenerate}` returns the month's existing insight (200) unless `regenerate` is set, otherwise asks the model (201); `GET /insights`, `GET/DELETE /insights/{id}`.

## Web app (web/)
- **Tooling** – Tailwind CSS v4 (Vite plugin), React Router 8 (lazy routes per page), Recharts for charts.
- **Design tokens** – every colour lives in `src/index.css` (`@theme static`: `canvas`, `surface`, `ink`, `muted`, `accent`, `positive`, `negative`, `warning`, `chart-1..6`). Dark mode only swaps token values, so components never use `dark:` classes. Charts read tokens through `useTokens()`.
- **Structure** – `components/ui` (Button, Card, Field/MoneyInput/Select, Modal on native `<dialog>`, Badge, Money, Stat, …), `components/layout` (AppLayout: sidebar on desktop with every section; on phones `BottomNav` shows four tabs plus More for the rest; `navItems.ts` lists the sections for both), `features/<area>` for pages (overview, transactions, budget, accounts, plan, settings, categories), `lib/format.ts` for money and dates.
- **Data** – `api.ts` calls every endpoint and turns API errors into `Error` messages. Pages load with `useData(key, load)`; after any save, call `refresh()` (`data/refresh.ts`) and every `useData` on screen reloads.
- **One transaction form** – opened from anywhere: `useQuickAdd()(draft?)` for a new one ("Pay" on a debt opens a prefilled transfer), `useEditTransaction()(t)` to edit or delete; tapping a TransactionRow edits it.
- **Categories in the UI** – managed in Settings → Categories; `CategorySelect` lists them in tree order labelled with their path, only of the right kind, hiding archived ones.
- **Small screens** (below `lg`, where the bottom navbar shows; `useIsSmallScreen`) – category trees collapse: `components/tree/CollapsibleTree` (nested lists, each page supplies rows, open rows remembered per page by `useExpanded` in guarded localStorage) with `ExpandButton` (aria-expanded/aria-controls); the transaction form uses `CascadingCategoryPicker`. Larger screens show the full tree.
- **Rates in the UI** – Settings → Currencies edits both directions; `lib/rates.ts` and `features/accounts/Converted.tsx` (`ApproxPounds`, `RateNote`) show "≈ £" beside other currencies (display only).
- **Tailwind gotcha** – two classes for the same property (e.g. `p-4` and `p-0`) don't override by order in the markup; add an option to the component (like Card's `flush`) instead.

## Mobile app (mobile/)
- **Stack** – Expo SDK 58 (Expo Go on the phone only runs the latest SDK, so upgrade when Expo does: `npx expo install expo@latest --fix`), React Native, TypeScript, Expo Router with routes in `src/app` (`(tabs)/` = Home, Add, Activity as `NativeTabs`; `settings.tsx` pushed over them from the gear). iOS only: no web target, no CORS on the API (a native app isn't a browser). Add packages with `npx expo install`, not `npm install`, so versions match the SDK; Expo Go only has its bundled native modules.
- **Running on the phone** – Expo Go over Tailscale. `mobile/.env` (git-ignored, from `.env.example`) holds `EXPO_PUBLIC_API_URL=http://<mac-tailscale-ip>:5080`; `MAC_TAILSCALE_IP=<ip> npm start` sets `REACT_NATIVE_PACKAGER_HOSTNAME` so the QR code points at the Mac's Tailscale IP. Never use `expo start --tunnel` or `tailscale serve` (serve proxies from loopback, which skips the API key check).
- **API key** – the phone isn't loopback, so `NetworkApiKeyMiddleware` wants `X-Api-Key` (the API's `Security:ApiKey` user secret). It's pasted once in Settings and kept in the iOS Keychain by `expo-secure-store` (`lib/apiKey.ts`), never in `.env` or source: `EXPO_PUBLIC_` values are compiled into the JS bundle. Settings only shows whether a key is saved. Never log it.
- **Data** – `src/api.ts` follows web's `request<T>()`, adds the key and a 10s timeout (a sleeping Mac → "Can't reach the API…"), and throws `ApiError` with the status (401 → "API key missing or wrong, set it in Settings"). `useData`/`refresh()` work as on the web; saving the key calls `refresh()`.
- **Types** – `src/types.ts` is a copy of `web/src/types.ts`; change both together until they're generated from OpenAPI. `lib/format.ts` is a subset of the web's.
- **Styling** – `StyleSheet` only (no styling library yet). Colours come from `src/theme/tokens.ts` (same names and values as `web/src/index.css`) through `useTokens()`, which swaps light/dark by `useColorScheme`. Primitives in `components/ui` (Button, Card, Stat) and `components/Screen` (a tab page with title, gear and pull-to-refresh).
- **Checks** – `npm run typecheck`, `npm run lint` (`expo lint`).
- **Plain HTTP** – Expo Go allows `http://` to the Tailscale IP; a future development build will need an App Transport Security exception (or HTTPS).

## Database migrations
- `AccountsAndTransfers` converted the old Debts/DebtPayments/spending-flags model; it is hand-written SQL and has no `Down()` (restore a backup instead).
- `AddCategories` turned the text labels into categories (hand-written, with a `Down()` that puts the labels back); `AddBudgets` only adds `BudgetMonthAmounts`. Both have Testcontainers tests. `AddExchangeRates` and `AddEarlyIncomeDays` only add.
- `AddInsights` only adds the `Insights` table.
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