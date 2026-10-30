-- My Life Planner 2027 — Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
-- Every table is private: Row Level Security only lets a signed-in user read and write their own rows.

-- ---------------------------------------------------------------------------
-- Profile and settings
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null default '',
  wedding_date date not null default '2027-08-23',
  wedding_personal_target numeric(14,2) not null default 0 check (wedding_personal_target >= 0),
  wedding_shared_budget numeric(14,2) not null default 0 check (wedding_shared_budget >= 0),
  budget_review_day smallint not null default 28 check (budget_review_day between 1 and 31),
  savings_plan jsonb not null default '{}'::jsonb,
  leave_policy jsonb not null default '{}'::jsonb,
  notifications_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Employment
-- ---------------------------------------------------------------------------
create table if not exists public.employment_details (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  company text not null default '',
  designation text not null default '',
  location text not null default '',
  joining_date date,
  probation_days integer not null default 90 check (probation_days between 0 and 730),
  probation_status text not null default 'Not started'
    check (probation_status in ('Not started', 'In progress', 'Confirmed', 'Extended', 'Not confirmed')),
  probation_confirmed_on date,
  min_tenure_months integer not null default 12 check (min_tenure_months between 0 and 120),
  early_notice_months integer not null default 3 check (early_notice_months between 0 and 24),
  standard_notice_months integer not null default 2 check (standard_notice_months between 0 and 24),
  notice_counting text not null default 'calendar' check (notice_counting in ('calendar', 'inclusive')),
  target_last_day date,
  gross_monthly numeric(14,2) not null default 0 check (gross_monthly >= 0),
  take_home_monthly numeric(14,2) not null default 0 check (take_home_monthly >= 0),
  ctc_monthly numeric(14,2) not null default 0 check (ctc_monthly >= 0),
  gross_ctc numeric(14,2) not null default 0 check (gross_ctc >= 0),
  salary_due_day smallint not null default 5 check (salary_due_day between 1 and 31),
  hr_contacts jsonb not null default '[]'::jsonb check (jsonb_typeof(hr_contacts) = 'array'),
  notes text not null default ''
);

create table if not exists public.job_milestones (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  milestone_key text not null check (milestone_key in (
    'joining', 'day30', 'day60', 'probation', 'hrConfirmation', 'resignationPlanning', 'resignationSubmission',
    'noticeStart', 'handover', 'lastDay', 'fullAndFinal', 'relievingLetter', 'experienceCertificate', 'oneYear')),
  date_override date,
  done boolean not null default false,
  done_on date,
  notes text not null default '',
  primary key (user_id, milestone_key)
);

create table if not exists public.resignation_plans (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  planned_submission_date date,
  early_exit_approval text not null default 'Not requested'
    check (early_exit_approval in ('Not requested', 'Requested', 'Approved', 'Rejected')),
  approval_notes text not null default '',
  -- Only an amount HR has confirmed in writing. The planner never calculates a penalty.
  hr_confirmed_liability numeric(14,2) check (hr_confirmed_liability is null or hr_confirmed_liability >= 0),
  hr_confirmed_liability_on date,
  liability_notes text not null default ''
);

-- ---------------------------------------------------------------------------
-- Leave
-- ---------------------------------------------------------------------------
create table if not exists public.leave_entitlements (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  leave_type text not null check (leave_type in ('CL', 'SL', 'Comp')),
  annual_days numeric(5,1) not null default 0 check (annual_days >= 0),
  carryover numeric(5,1) not null default 0 check (carryover >= 0),
  carryover_confirmed boolean not null default false,
  used_before_tracking numeric(5,1) not null default 0 check (used_before_tracking >= 0),
  primary key (user_id, leave_type)
);

create table if not exists public.holidays (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  holiday_date date not null,
  name text not null,
  primary key (user_id, id)
);

create table if not exists public.leave_transactions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  leave_type text not null check (leave_type in ('CL', 'SL', 'LOA', 'Comp')),
  status text not null check (status in ('Planned', 'Pending', 'Approved', 'Taken', 'Rejected', 'Cancelled')),
  start_date date not null,
  end_date date not null,
  half_day_start boolean not null default false,
  half_day_end boolean not null default false,
  days numeric(5,1) check (days is null or days >= 0),
  reason text not null default '',
  notes text not null default '',
  for_wedding boolean not null default false,
  primary key (user_id, id),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null check (length(trim(name)) > 0),
  purpose text not null default 'general' check (purpose in ('general', 'wedding', 'emergency')),
  opening_balance numeric(14,2) not null default 0,
  sort_order integer not null default 0,
  primary key (user_id, id)
);

create table if not exists public.wedding_budget_categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null check (length(trim(name)) > 0),
  planned numeric(14,2) not null default 0 check (planned >= 0),
  due_date date,
  notes text not null default '',
  receipts text not null default '',
  sort_order integer not null default 0,
  primary key (user_id, id)
);

create table if not exists public.recurring_transactions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  description text not null,
  txn_type text not null check (txn_type in ('expense', 'transfer')),
  category text not null default '',
  amount numeric(14,2) not null check (amount > 0),
  account_id text not null,
  to_account_id text,
  payment_method text not null default '',
  day_of_month smallint not null check (day_of_month between 1 and 31),
  start_month text not null check (start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  end_month text check (end_month is null or end_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  active boolean not null default true,
  primary key (user_id, id),
  foreign key (user_id, account_id) references public.accounts (user_id, id),
  foreign key (user_id, to_account_id) references public.accounts (user_id, id),
  check (end_month is null or end_month >= start_month)
);

-- Salary payments (is_salary = true) and other income.
create table if not exists public.income_transactions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  is_salary boolean not null default false,
  txn_date date, -- date received (null while a salary payment is still expected)
  amount numeric(14,2) check (amount is null or amount >= 0),
  category text not null default '',
  description text not null default '',
  account_id text,
  payment_method text not null default '',
  notes text not null default '',
  pay_month text check (pay_month is null or pay_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  expected_date date,
  expected_amount numeric(14,2) check (expected_amount is null or expected_amount >= 0),
  primary key (user_id, id),
  foreign key (user_id, account_id) references public.accounts (user_id, id),
  check (is_salary or (txn_date is not null and amount > 0)),
  check (not is_salary or pay_month is not null)
);
create unique index if not exists income_salary_month_unique on public.income_transactions (user_id, pay_month) where is_salary;

create table if not exists public.expenses (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  txn_date date not null,
  category text not null,
  description text not null default '',
  amount numeric(14,2) not null check (amount > 0),
  account_id text not null,
  payment_method text not null default '',
  notes text not null default '',
  -- A wedding payment is an expense linked to a budget category, so it is only counted once.
  wedding_category_id text,
  recurring_id text,
  occurrence text check (occurrence is null or occurrence ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  primary key (user_id, id),
  foreign key (user_id, account_id) references public.accounts (user_id, id),
  foreign key (user_id, wedding_category_id) references public.wedding_budget_categories (user_id, id) on delete set null (wedding_category_id),
  foreign key (user_id, recurring_id) references public.recurring_transactions (user_id, id) on delete set null (recurring_id)
);

-- Money moved between my own accounts (e.g. into wedding or emergency savings). Never income or expense.
create table if not exists public.savings_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  txn_date date not null,
  from_account_id text not null,
  to_account_id text not null,
  amount numeric(14,2) not null check (amount > 0),
  description text not null default '',
  payment_method text not null default '',
  notes text not null default '',
  recurring_id text,
  occurrence text check (occurrence is null or occurrence ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  primary key (user_id, id),
  foreign key (user_id, from_account_id) references public.accounts (user_id, id),
  foreign key (user_id, to_account_id) references public.accounts (user_id, id),
  foreign key (user_id, recurring_id) references public.recurring_transactions (user_id, id) on delete set null (recurring_id),
  check (from_account_id <> to_account_id)
);

create table if not exists public.expected_income (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  label text not null default '',
  amount numeric(14,2) not null check (amount > 0),
  for_wedding numeric(14,2) not null default 0 check (for_wedding >= 0),
  primary key (user_id, id),
  check (for_wedding <= amount)
);

-- ---------------------------------------------------------------------------
-- Wedding checklist and reminders
-- ---------------------------------------------------------------------------
create table if not exists public.wedding_checklist (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  title text not null check (length(trim(title)) > 0),
  deadline date,
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  status text not null default 'Not started' check (status in ('Not started', 'In progress', 'Done')),
  notes text not null default '',
  sort_order integer not null default 0,
  primary key (user_id, id)
);

create table if not exists public.reminders (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  title text not null check (length(trim(title)) > 0),
  reminder_date date not null,
  notes text not null default '',
  primary key (user_id, id)
);

-- Completion / notification state of reminders the planner generates from your dates.
create table if not exists public.reminder_states (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reminder_key text not null,
  completed_on date,
  notified_on date,
  primary key (user_id, reminder_key)
);

-- Wedding payments = expenses linked to a wedding budget category.
create or replace view public.wedding_payments with (security_invoker = true) as
  select e.user_id, e.id, e.txn_date, e.amount, e.description, e.account_id, e.payment_method, e.notes,
         e.wedding_category_id, c.name as category_name
  from public.expenses e
  join public.wedding_budget_categories c on c.user_id = e.user_id and c.id = e.wedding_category_id;

-- ---------------------------------------------------------------------------
-- Row Level Security: only the signed-in owner can see or change their rows.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'employment_details', 'job_milestones', 'resignation_plans', 'leave_entitlements', 'holidays',
    'leave_transactions', 'accounts', 'wedding_budget_categories', 'recurring_transactions', 'income_transactions',
    'expenses', 'savings_records', 'expected_income', 'wedding_checklist', 'reminders', 'reminder_states']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists "Owner only" on public.%I', t);
    execute format(
      'create policy "Owner only" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

revoke all on public.wedding_payments from anon;
grant select on public.wedding_payments to authenticated;
