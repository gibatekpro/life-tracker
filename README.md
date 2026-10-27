# Life Tracker

A personal finance and life-tracking app: spending, budgets, accounts across GBP and NGN,
debt payoff planning and Apple Pay capture. Built with ASP.NET Core, PostgreSQL and
React + TypeScript, with an iPhone app (React Native / Expo) in progress.

## Run the iPhone app

Needs Tailscale on the Mac and the iPhone, and Expo Go on the iPhone.

1. Start the API (it listens on `0.0.0.0:5080`): `cd api && dotnet run`
2. `cd mobile && npm install`, then copy `.env.example` to `.env` and put the Mac's Tailscale IP
   (`tailscale ip -4`) in `EXPO_PUBLIC_API_URL`.
3. `MAC_TAILSCALE_IP=<that ip> npm start` and scan the QR code with the iPhone's camera.
4. In the app, tap the gear and paste the API key (`Security:ApiKey` from the API's user secrets).
   It's stored in the iPhone's Keychain, never in the code or `.env`.

## How it was built

I designed the architecture and data model, and directed and reviewed every change.
Much of the implementation was written in collaboration with Claude Code, Anthropic's
AI coding tool.  