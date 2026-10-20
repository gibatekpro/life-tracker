# Life Tracker: Future Roadmap

Written 20 October 2026. A long-term reference, not current work.

## Purpose

Life Tracker can become an app other people use, if it launches first as a debt-payoff planner without bank sync. This is a long-term reference, not a plan for now.

Revisit it once the app has been used for real for a few weeks and the current accounts model feels familiar. Until then: understand the code, use it weekly, and finish before expanding.

## Emma at a glance

[Emma](https://emma-app.com/apps) connects bank accounts through Open Banking and analyses spending, including flagging wasteful subscriptions. Budgets and category tracking are now paid features ([Which?](https://www.which.co.uk/money/money-saving-tips/budgeting/open-banking-budgeting-and-saving-apps-aLl3e0g9I7Ft)).

| Plan | Price (£/month) | Bank connections | Notable extras |
| --- | --- | --- | --- |
| Basic | 0 | 2 | Pots with interest, transfers up to £500/month |
| Plus | 4.99 | 4 | Higher savings interest, cashback, rent reporting |
| Pro | 9.99 | Unlimited | As Plus |
| Ultimate | 14.99 | Unlimited | Credit alerts, VPN, "Spaces" budgets |

**What a solo developer can't realistically build:**

- **Bank sync for other users.** Serving other people's bank data needs FCA authorisation, or working through an approved provider, with contracts and monthly costs.
- **Interest-earning pots and money transfers.** These need a licensed banking or e-money partner.
- **Rent reporting and credit alerts.** These need partnerships with credit reference agencies.
- **Cashback.** This needs retailer deals.
- **Scale and trust.** Security certifications, a support team, and large-scale categorisation data.

## Where Life Tracker can win

Life Tracker's edge is debt payoff, which Emma mostly treats as tracking. For someone actively clearing UK credit card debt, it offers a sharper set of tools:

- An avalanche planner that rolls freed-up payments onto the next debt.
- A "what if I pay £50 more" simulator showing months and interest saved.
- An accounts-and-transfers model, so card repayments never double-count as spending.
- Card interest recorded as its own expense, showing what debt really costs each month.

## Path to publishing

Publishing for other users is realistic in five stages, each building on the last.

1. **Polish for yourself.** Use it for real for a month; real use shows what's missing.
2. **Make it multi-user.** Add sign-in (ASP.NET Identity or a hosted login service) and a `UserId` on every table.
   - Write tests proving one user can never see another's data. This is the most important security property of a finance app.
3. **Deploy it.** API hosting, managed Postgres with automatic backups, HTTPS, secrets in the host's settings, and GitHub Actions to test and deploy each push.
   - This also removes the Apple Pay "home Wi-Fi only" limit.
4. **Privacy and legal basics.** A privacy policy, and a way for users to export and delete their data (GDPR rights).
   - Registration with the ICO (the UK data protection regulator) is probably required, with a small annual fee. Check the ICO self-assessment at this stage.
5. **Distribute it.** Start as a web app installable on phones (a PWA), with no App Store needed. An iPhone app via Expo can follow; Apple's developer account costs £79/year.

## Launch first, bank sync later

The simplest route to real users is a debt-payoff planner with manual entry and Apple Pay capture, and no bank sync. That keeps the app outside FCA regulation, since it never touches anyone's bank data.

Add bank sync later through a regulated provider, and only if users ask for it.

## Career value

A live app with real users is one of the strongest items a CV can carry. Sign-in, a deployed backend, CI/CD, tests and data migrations are exactly what moves a role from "IT applications developer" to "software engineer" in an interview.

## Sources

- [Which?: Open banking budgeting and saving apps](https://www.which.co.uk/money/money-saving-tips/budgeting/open-banking-budgeting-and-saving-apps-aLl3e0g9I7Ft)
- [Emma: apps page](https://emma-app.com/apps)
