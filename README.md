# My Life Planner 2027

A private, single-person planner for my job exit, leave, money and my personal share of the wedding on **23 August 2027**.

Built with React, TypeScript, Tailwind CSS and Recharts. Data is stored in the browser (`localStorage`) on one device — nothing is sent to a server.

## Sections

| Section | What it does |
| --- | --- |
| Dashboard | Wedding countdown, training/probation countdown, resignation deadline, last working day, leave balance, wedding savings, budget vs spent, amount still to save, monthly savings target, upcoming expenses, milestones, charts and reminders |
| Job Tracker | Company, job title, joining date, training and probation (separate milestones), notice period, planned resignation, salary, HR contacts and notes. Warns when the plan does not meet the notice period |
| Leave Tracker | Leave policy, entitlement, HR-confirmed carryover, half days, weekends and holidays, pending vs approved, calendar, history, CSV export, wedding-prep leave planner |
| Money Tracker | Income, expenses and transfers with accounts and opening balances, expected vs received income, category breakdown, month-by-month charts, CSV export |
| Wedding Budget | "My Wedding Contribution" — personal budget, editable categories, paid / remaining / due date / status, receipts, linked payments |
| Savings Planner | Works back from the wedding date: recommended monthly saving, monthly target vs actual, projection, shortfall/surplus, emergency savings kept separate |
| Wedding Checklist | Editable tasks with deadlines, priorities and status |
| Settings | Profile, wedding date, accounts, notifications, backup/restore (JSON), CSV exports, reset |

## How the key numbers are calculated

- **Calendar months.** A 3-month period starting 1 May ends on 31 July ("ends the day before"). You can switch to "ends on the same date" in Job Tracker if your contract says so.
- **Resignation deadline** = the latest date whose notice period ends on or before your target last working day (default 31 Jul 2027 → 1 May 2027). The planner warns if the date falls on a weekend/holiday, before probation confirmation, or if a planned date is too late.
- **Available annual leave** = entitlement + HR-confirmed carryover − leave used (taken, or approved and already past). Approved future leave, pending requests and planned leave are shown separately as "after approved" and "projected" balances — never deducted from the confirmed balance.
- **Savings** = income − expenses. Transfers between your own accounts are excluded.
- **Wedding payments are counted once.** A payment is entered once in the Money Tracker and linked to a wedding category; it counts as an expense and as "paid" in the wedding budget.
- **Saved for wedding** = balance of accounts marked *Wedding savings* + wedding payments already made. *Emergency* accounts are never included.
- **Recommended monthly saving** = (target − saved − paid − expected extra income for the wedding) ÷ months left until the month before the wedding. If you are behind, the planner shows the revised amount next to your estimated spare money — it does not assume you can afford it.
- Transactions dated in the future are treated as **scheduled**: they are not in your balance yet but are counted in upcoming expenses.

## Reminders

Reminders are created from your dates (training, probation, HR confirmation, contract review, resignation, last day, leave and leave-request deadlines, salary, monthly budget review, wedding payments, monthly savings, checklist) plus your own custom reminders. You can mark them complete.

- **Browser notifications** work only while the planner is open in a browser tab. There is no background push service.
- For reminders that work when the site is closed, download the **.ics calendar file** (one reminder or all upcoming) and import it into Google Calendar or your phone's calendar.

## Your data

- Saved automatically in this browser on this device. Clearing browser data deletes it.
- Use **Settings → Download backup** regularly, and **Restore from backup** to move to another device. Backups are validated before they are restored.
- No accounts, keys or secrets are used. If you later want sync across devices, Supabase with authentication and row-level security can be added; keep only the public anon key in the client.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # calculation tests
npm run build    # production build in dist/
```

## Publish on GitHub Pages

This repo includes `.github/workflows/deploy.yml`. In the GitHub repository go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. Every push to `main` then builds, tests and publishes the site.
