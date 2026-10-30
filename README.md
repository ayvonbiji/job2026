# My Life Planner 2027

A private personal dashboard for my employment at **Soffit Infrastructure Services Pvt. Ltd.**, my probation and resignation conditions, leave, monthly money, wedding savings and wedding preparation before **23 August 2027**.

Built with React, TypeScript, Tailwind CSS, Recharts and Lucide icons. Data is stored either:

- **In this browser only** (default, no setup), or
- **In your own Supabase project** with email/password login and row-level security, when the two Supabase environment variables are set.

## Sections

| # | Section | What it does |
|---|---|---|
| 1 | Overview | Wedding countdown, employment countdown, probation status, CL/SL balances, take-home salary, available balance, wedding savings progress, upcoming payments, milestones, charts, due reminders |
| 2 | Job & Employment | Company, designation, location, joining date, salary figures from the agreement, employment progress bar, full employment timeline, HR contacts, notes |
| 3 | Probation Tracker | 90-day probation with 30/60/90-day milestones, status and HR confirmation date |
| 4 | Resignation Planner | Scenario A (before one year, Clause 10.2) vs Scenario B (after one year, Clause 10.3), contractual warning, resignation calculator, approval status, potential liabilities (never calculated), exit steps |
| 5 | Leave Management | CL and SL tracked separately, Leave of Absence (unpaid), Compensatory leave, half days, approval status, calendar, history, CSV export, wedding leave planner, configurable HR policy |
| 6 | Money Tracker | Salary records (expected vs received), expenses with payment method, savings transfers, filters, category breakdown, previous-month comparison, charts |
| 7 | Wedding Budget | “Our Wedding 2027 – My Contribution”: my personal target and 13 editable categories with planned / paid / remaining / due date / status |
| 8 | Savings Planner | Recommended monthly saving, target vs actual, projection, savings gap, affordability check against real income and expenses, emergency savings kept separate |
| 9 | Wedding Checklist | Editable tasks with deadlines, priorities and status |
| 10 | Calendar & Reminders | Financial calendar (salary, rent, bills, wedding payments, savings, leave), recurring payments, reminder centre, browser notifications, .ics downloads |
| 11 | Settings | Profile, accounts and opening balances, backup/restore, CSV exports, sign out, reset |

## Pre-filled from my Employment Agreement

| Item | Value |
|---|---|
| Company | Soffit Infrastructure Services Pvt. Ltd. |
| Designation / location | ServiceDesk Coordinator, Kochi, Kerala |
| Joining date | 2 November 2026 |
| Probation | 90 days → 31 January 2027 (estimate, subject to HR confirmation) |
| Minimum commitment | One year → anniversary 2 November 2027 |
| Notice | 3 months before one year (Clause 10.2.1), 2 months after (Clause 10.3) |
| Salary | Take-home ₹13,137.93 · Gross ₹15,176.76 · Salary CTC ₹17,620 · Gross CTC ₹18,028.80 · paid on or before the 5th |
| Leave | CL 12 days, SL 12 days, Leave of Absence without pay, Compensatory leave subject to policy |
| Plan | Target last working day 31 July 2027 (tentative) · wedding 23 August 2027 |

Everything is editable.

## How the key numbers are calculated

- **Resignation deadline** = the final working day minus the notice period in calendar months. For 31 July 2027 under Scenario A (3 months) that is **30 April 2027**, with notice running 1 May – 31 July. You can switch to “including the day I submit” (1 May → 31 July) if HR counts notice that way. The company must confirm the calculation and approve early termination.
- **Scenario** is chosen by comparing the final working day with the one-year anniversary. If the last day is after the anniversary but you would submit before it, the planner asks you to confirm with HR which clause applies.
- **Potential liabilities** under Clause 10.2.3 are listed, never calculated. Only an amount HR confirms in writing can be recorded.
- **Leave**: CL and SL are separate balances. Available = entitlement + HR-confirmed carry-forward − leave used. Approved future leave, pending and planned leave are shown separately and never deducted from the confirmed balance. By default every calendar day counts — no weekend rule, accrual, carry-forward or encashment is assumed. Change these once you have the official HR Leave Policy, or type the exact number of days for any leave.
- **Salary** for each month is expected by the 5th of the following month, from December 2026 until the month after your last working day. Record what you actually receive.
- **Savings** = income − expenses. Money you move into your own wedding or emergency account is a “Savings” transfer — not an expense.
- **Wedding payments are counted once**: an expense linked to a wedding category is an expense in the Money Tracker and “paid” in the wedding budget.
- **Recommended monthly saving** = (target − paid − wedding savings − expected wedding income) ÷ saving months left. **Affordability** compares it with expected income − monthly expenses (entered, or your recorded average) − other commitments. The planner never assumes you can save your whole salary.

## Reminders

Generated from your dates: probation (30/60/90 days, HR confirmation), salary each month, leave requests and leave starts, monthly savings, wedding payment deadlines, resignation planning and submission, notice start, handover, final working day, full & final settlement, relieving letter and experience certificate, monthly budget review, recurring payments, checklist deadlines, plus your own reminders.

- **Browser notifications** work only while the planner is open in a tab. There is no background push service.
- For reminders that work when the site is closed, download the **.ics** calendar file and import it into Google Calendar or your phone.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # calculation, migration and database-mapping tests
npm run build    # production build in dist/
```

## Optional: Supabase login and cloud storage

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates 17 tables (profile, employment details, job milestones, resignation plan, leave entitlements, leave transactions, holidays, accounts, income transactions, expenses, savings records, recurring transactions, expected income, wedding budget categories, wedding checklist, reminders, reminder states) and a `wedding_payments` view. Row-level security is switched on for every table so a signed-in user can only read and write their own rows.
3. In **Project Settings → API**, copy the **Project URL** and the **anon public** key. Never use the `service_role` key in the website.
4. Set them as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`, or the Vercel steps below).
5. Open the site, click **Create an account**, and confirm your email.
6. Once your account exists, go to **Authentication → Sign In / Providers** in Supabase and turn off **Allow new users to sign up**, so nobody else can create an account.

On first sign-in you can copy the data already saved in that browser into your account.

## Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import `ayvonbiji/job2026`. Vercel detects Vite automatically (`vercel.json` is included).
2. Optional: under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Click **Deploy**. Every push to `main` redeploys.

## GitHub Pages

`.github/workflows/deploy.yml` builds, tests and publishes the site on every push to `main` (Settings → Pages → Source: GitHub Actions). To use Supabase there too, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets (Settings → Secrets and variables → Actions).

## Data safety

- Data from the first version of the planner is migrated automatically. The original is kept in the browser as `my-life-planner-2027:v1-backup`.
- Use **Settings → Download backup** regularly. Backups are validated before they are restored.
- Every delete of a financial or employment record asks for confirmation.
