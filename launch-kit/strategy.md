# Launch Strategy — Timevault

## Target communities

| Community | Angle (rules-aware) |
|---|---|
| r/freelance | Value-first post: "How I stopped under-billing: 15-min rounding + overlap detection" — mention the tool only in comments if asked. No direct self-promo in post body (sub rule). |
| r/selfhosted | Perfect fit — "Timevault: self-hosted Toggl alternative (Node + SQLite, MIT)". This sub welcomes show-and-tell with source link; lead with the GitHub repo, Docker compose in the post. |
| r/webdev | Showoff Saturday thread only. Focus on the tech: server-state timers, hand-rolled SVG charts, dual Node/Electron ABI trick for better-sqlite3. |
| r/opensource | Straight announcement with the MIT repo. Emphasize no telemetry, no phone-home. |
| r/digitalnomad | "Track billable hours offline on a laptop, sync nothing" angle — works on planes, data stays local. Check weekly self-promo thread rules. |
| Hacker News | Show HN (below). |
| Indie Hackers | Build-in-public post: the "$700 spent on Toggl since 2019" story with revenue updates later. |

## Show HN draft

**Title:** Show HN: Timevault – self-hosted Toggl alternative (one-time $29, MIT source)

**Post:**
I've paid Toggl roughly $700 since 2019 to run what is, for a solo freelancer, a stopwatch with a CSV export. So I built Timevault: a self-hosted time tracker in Node + Express + SQLite + React.

Things I care about that it does differently:

- The running timer is a server-side row (stop IS NULL), not browser state — reload, crash, switch devices on your LAN, it's still counting.
- Report-level rounding: entries round to the nearest 5/15 min only when reporting, so raw data stays honest.
- Overlap detection flags double-booked entries before they reach an invoice.
- Billable math comes from per-project hourly rates — the report shows the exact dollar figure to invoice.

It runs three ways from one codebase: `npm start` (web), `npm run desktop` (Electron wrapper that boots the same Express server on a free port), or Docker on a VPS. The interesting bit was better-sqlite3 needing different ABIs for Node vs Electron — a postinstall script vendors both bindings and picks at runtime.

Source is MIT: [repo link]. The $29 is for a packaged one-click installer; everything works from source for free.

## SEO keywords (10)

1. toggl alternative
2. self-hosted time tracker
3. open source time tracking
4. time tracker for freelancers
5. billable hours tracker
6. toggl replacement one-time purchase
7. time tracking software without subscription
8. self hosted toggl
9. freelance invoice time tracking
10. timesheet app self hosted

## AppSumo / PitchGround pitch

Timevault is a self-hosted Toggl replacement for the 70M+ freelancers who bill by the hour. It ships everything a solo biller needs — persistent one-click timers, weekly timesheets with inline editing, per-project hourly rates, 5/15-minute invoice rounding, overlap detection, and CSV/print reports — as software the customer owns outright. It installs in one click on Windows or deploys via Docker to any $5 VPS, stores everything in a local SQLite file, and phones home to no one. Lifetime-deal buyers love exactly this shape of product: a recurring SaaS bill (Toggl: $120/yr) converted into a one-time purchase with MIT-licensed source as trust collateral. Strong affinity audience with your existing invoicing and proposal-tool buyers.

## Pricing math

**Suggested price: $29 one-time.**

- Toggl Starter: $10/user/month → Timevault **pays for itself in 2.9 months**.
- 3-year cost: Toggl $360 vs Timevault $29 (92% saved).
- Anchor high against Harvest ($12/seat/mo → pays for itself in 2.4 months).
- Launch promo: $19 early-bird for the first week (PH + HN traffic), then $29.
