# Product Hunt — Timevault

## Name
Timevault

## Tagline (≤60 chars)
Self-hosted time tracking. Pay once, never rent Toggl again.

## Description (≤260 chars)
Timevault is a self-hosted Toggl replacement for freelancers. One-click timers that survive reloads, projects with hourly rates, weekly timesheets, and reports that compute exactly what to invoice. Runs as a desktop app or on a $5 VPS. $29 once — no subscription.

## Full description

Timevault is time tracking the way it should be: a tool you own, not a service you rent.

**Track:** one-click timer with description, project and tags. The timer lives on the server, not in your tab — reload, close the browser, come back tomorrow, it's still counting. Stop, discard, or continue any previous entry with one click. Manual entries take start/end times or plain durations like "1:30" or "90m".

**Organize:** projects with clients, colors and billable hourly rates. Tags created on the fly. Archive finished projects without losing their history.

**Bill:** pick a date range, group by project, client, tag or day. Bar chart of hours per day, donut of the split, and exact totals — duration *and* dollars, computed from your rates. Round entries to the nearest 5 or 15 minutes at report level (raw data untouched). Overlapping entries get a warning badge before they embarrass you on an invoice. Export CSV or print a clean summary.

**Own:** SQLite file on your disk. No telemetry, no cloud, no account, no monthly fee. Run it as a desktop app (`npm run desktop`) or deploy the Docker image to a $5 VPS when you need it from anywhere.

MIT-licensed source on GitHub. $29 one-time for the packaged 1-click installer.

## Maker first comment

Hey PH 👋

I built Timevault after doing the math on my Toggl invoice: $10/month, every month, since 2019. That's over $700 for what is — for a solo freelancer — a timer, a list of projects with rates, and a CSV export.

So I built the tool I actually use: a timer that survives browser crashes because it runs server-side, a weekly timesheet I can edit inline, and reports that tell me the exact dollar amount to put on the invoice (with 15-minute rounding, because my lawyer clients taught me well).

Everything is local — SQLite on your own machine or VPS. The code is MIT on GitHub; the $29 gets you the packaged installer and my eternal gratitude.

Ask me anything — especially if you've got a time-tracking workflow I haven't covered.

## Gallery shots (5)

1. **Timer view (hero)** — dark UI, timer running at 1:23:45 in green, description "Client website — homepage", project dot + tags visible.
2. **Weekly timesheet** — 7-day grid with entries across the week, one cell mid-inline-edit, today's column highlighted.
3. **Reports** — bar chart of hours per day + donut split by project, stat tiles showing "32:15:00 total / $2,902.50 billable".
4. **Overlap detection** — two entries with amber "overlap" badges, tooltip explaining the conflict.
5. **Side-by-side comparison card** — "Toggl: $360 over 3 years vs Timevault: $29 once" with the desktop app window in the background.
