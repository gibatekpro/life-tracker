# Life Tracker

A personal life-tracking app: spending, debt payoff, habits and personal growth.

## Stack
- **api/** – ASP.NET Core Web API (.NET 10, pinned in global.json), project `LifeTracker.Api`
- **web/** – React + TypeScript (Vite) dashboard (not created yet)
- **mobile/** – React Native with Expo for iPhone (not created yet)
- **Database** – PostgreSQL 17 via Docker Compose (`docker-compose.yml` at repo root, credentials in `.env`, never committed)
- **ORM** – EF Core with the Npgsql provider
- **API testing** – Scalar UI at `/scalar` (reads the OpenAPI doc)
- **API style** – Minimal APIs (I'm experienced with controllers and learning minimal APIs here), endpoints grouped with MapGroup in extension methods

## Roadmap
1. **Money module (current):** transactions, categories, debts, monthly summary, debt payoff projections
2. Expo iPhone app for quick entries + Apple Pay auto-capture via an iOS Shortcuts "Transaction" automation posting to the API
3. Bank sync for Lloyds and Revolut via Open Banking (Enable Banking, personal-use tier)
4. Later modules: habits, skills/learning log, app portfolio, projections

## How to work with me
- This is a learning project. I'm an experienced C#/.NET and React developer growing my skills.
- Explain what you're doing and why. Prefer guiding me and reviewing my code over writing everything yourself.
- When you introduce a new library, pattern or tool, explain it briefly before using it.
- Keep commits small and focused.
