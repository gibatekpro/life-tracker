# Life Tracker

A personal finance and life-tracking app: spending, budgets, accounts across GBP and NGN,
debt payoff planning and Apple Pay capture. Built with ASP.NET Core, PostgreSQL and
React + TypeScript, and an iPhone app (React Native / Expo) that does everything the web app does.

## Run the iPhone app

Needs Tailscale on the Mac and the iPhone, and Expo Go on the iPhone.

1. Start the API (it listens on `0.0.0.0:5080`): `cd api && dotnet run`
2. `npm install` at the repo root (an npm workspace: web, mobile and packages/core), then in
   `mobile/` copy `.env.example` to `.env` and put the Mac's Tailscale IP
   (`tailscale ip -4`) in `EXPO_PUBLIC_API_URL`.
3. In `mobile/`: `MAC_TAILSCALE_IP=<that ip> npm start` and scan the QR code with the iPhone's camera.
4. In the app, open More → Settings → This phone and paste the API key (`Security:ApiKey` from the
   API's user secrets). It's stored in the iPhone's Keychain, never in the code or `.env`.

The app has the web's sections: Home, Activity, Budget and Plan as tabs, and Accounts, Insights
and Settings under More. Calculations and wording shared by both apps live in `packages/core`
(`npm test` at the root runs its tests).

## How it was built

I designed the architecture and data model, and directed and reviewed every change.
Much of the implementation was written in collaboration with Claude Code, Anthropic's
AI coding tool.  