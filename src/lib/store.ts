import { create } from 'zustand'
import type { AppData } from './types'
import { LEAVE_TYPES, MILESTONE_KEYS } from './types'
import { createDefaultData } from './defaults'
import { isValidISO } from './dates'
import { migrateV1 } from './migrate'

export const STORAGE_KEY = 'my-life-planner-2027'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const numv = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const date = (v: unknown) => (typeof v === 'string' && isValidISO(v) ? v : '')
const month = (v: unknown) => (typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : '')
const oneOf = <T extends string>(v: unknown, opts: readonly T[], dflt: T): T => (opts.includes(v as T) ? (v as T) : dflt)
const id = (v: unknown) => str(v) || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2))
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : [])

/** Fill missing fields from a template, keeping only values of the right type. */
function mergeShape<T>(template: T, value: unknown): T {
  if (Array.isArray(template)) return (Array.isArray(value) ? value : template) as T
  if (template === null) return (value === null || typeof value === 'number' ? value : null) as T
  if (isObj(template)) {
    if (Object.keys(template).length === 0) return (isObj(value) ? value : template) as T
    const src = isObj(value) ? value : {}
    const out: Obj = {}
    for (const k of Object.keys(template)) out[k] = mergeShape((template as Obj)[k], src[k])
    return out as T
  }
  if (typeof template === 'number') return (typeof value === 'number' && Number.isFinite(value) ? value : template) as T
  return (typeof template === typeof value ? value : template) as T
}

/** Validate + repair data from storage, the cloud, or a backup file. Throws on unusable input. */
export function normalizeData(raw: unknown): AppData {
  if (!isObj(raw)) throw new Error('The file does not contain planner data.')
  let src: Obj = raw
  if (raw.version === 1) src = migrateV1(raw)
  else if (raw.version !== 2) throw new Error('This backup was made by an unknown version of the planner.')
  const d = mergeShape(createDefaultData(), src)
  d.version = 2

  d.employment.hrContacts = list(d.employment.hrContacts).map((c) => ({ id: id(c.id), name: str(c.name), role: str(c.role), email: str(c.email), phone: str(c.phone) }))
  for (const k of ['joiningDate', 'probationConfirmedOn', 'targetLastDay'] as const) d.employment[k] = date(d.employment[k])
  d.employment.noticeCounting = oneOf(d.employment.noticeCounting, ['calendar', 'inclusive'], 'calendar')
  d.employment.probationStatus = oneOf(d.employment.probationStatus, ['Not started', 'In progress', 'Confirmed', 'Extended', 'Not confirmed'], 'Not started')
  d.resignation.plannedSubmissionDate = date(d.resignation.plannedSubmissionDate)
  d.resignation.hrConfirmedLiabilityOn = date(d.resignation.hrConfirmedLiabilityOn)
  d.resignation.earlyExitApproval = oneOf(d.resignation.earlyExitApproval, ['Not requested', 'Requested', 'Approved', 'Rejected'], 'Not requested')
  const ms = isObj(src.milestones) ? src.milestones : {}
  d.milestones = Object.fromEntries(
    MILESTONE_KEYS.map((k) => {
      const m = isObj(ms[k]) ? (ms[k] as Obj) : {}
      return [k, { dateOverride: date(m.dateOverride), done: !!m.done, doneOn: date(m.doneOn), notes: str(m.notes) }]
    }),
  ) as AppData['milestones']

  d.leaves = list(d.leaves)
    .map((l) => ({
      id: id(l.id),
      type: oneOf(l.type, LEAVE_TYPES, 'CL'),
      status: oneOf(l.status, ['Planned', 'Pending', 'Approved', 'Taken', 'Rejected', 'Cancelled'] as const, 'Planned'),
      startDate: date(l.startDate),
      endDate: date(l.endDate) || date(l.startDate),
      startHalf: !!l.startHalf,
      endHalf: !!l.endHalf,
      days: typeof l.days === 'number' && Number.isFinite(l.days) && l.days >= 0 ? l.days : null,
      reason: str(l.reason),
      notes: str(l.notes),
      forWedding: !!l.forWedding,
    }))
    .filter((l) => l.startDate)
  const lp = d.leavePolicy
  lp.dayCountRule = oneOf(lp.dayCountRule, ['calendar', 'working'], 'calendar')
  lp.accrual = oneOf(lp.accrual, ['Not confirmed', 'Full at start of leave year', 'Monthly'], 'Not confirmed')
  lp.carryForward = oneOf(lp.carryForward, ['Not confirmed', 'Allowed', 'Not allowed'], 'Not confirmed')
  lp.encashment = oneOf(lp.encashment, ['Not confirmed', 'Allowed', 'Not allowed'], 'Not confirmed')
  lp.weekendDays = lp.weekendDays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  lp.holidays = list(lp.holidays).map((h) => ({ id: id(h.id), date: date(h.date), name: str(h.name) || 'Holiday' })).filter((h) => h.date)
  if (lp.leaveYearStartMonth < 1 || lp.leaveYearStartMonth > 12) lp.leaveYearStartMonth = 1

  d.accounts = list(d.accounts).map((a) => ({ id: id(a.id), name: str(a.name) || 'Account', purpose: oneOf(a.purpose, ['general', 'wedding', 'emergency'], 'general'), openingBalance: numv(a.openingBalance) }))
  if (d.accounts.length === 0) d.accounts = createDefaultData().accounts
  d.transactions = list(d.transactions)
    .map((t) => ({
      id: id(t.id),
      date: date(t.date),
      type: oneOf(t.type, ['income', 'expense', 'transfer'], 'expense'),
      amount: Math.abs(numv(t.amount)),
      category: str(t.category),
      description: str(t.description),
      paymentMethod: str(t.paymentMethod),
      accountId: str(t.accountId),
      toAccountId: str(t.toAccountId),
      weddingCategoryId: str(t.weddingCategoryId),
      recurringId: str(t.recurringId),
      occurrence: month(t.occurrence),
      notes: str(t.notes),
    }))
    .filter((t) => t.date && t.amount > 0)
  d.salaryRecords = list(d.salaryRecords)
    .map((s) => ({
      id: id(s.id),
      payMonth: month(s.payMonth),
      expectedDate: date(s.expectedDate),
      expectedAmount: numv(s.expectedAmount),
      actualDate: date(s.actualDate),
      actualAmount: typeof s.actualAmount === 'number' && Number.isFinite(s.actualAmount) ? s.actualAmount : null,
      accountId: str(s.accountId),
      notes: str(s.notes),
    }))
    .filter((s) => s.payMonth)
  d.recurring = list(d.recurring).map((r) => ({
    id: id(r.id),
    description: str(r.description) || 'Recurring payment',
    type: oneOf(r.type, ['expense', 'transfer'], 'expense'),
    category: str(r.category),
    amount: Math.abs(numv(r.amount)),
    accountId: str(r.accountId),
    toAccountId: str(r.toAccountId),
    paymentMethod: str(r.paymentMethod),
    dayOfMonth: Math.min(31, Math.max(1, Math.round(numv(r.dayOfMonth)) || 1)),
    startMonth: month(r.startMonth),
    endMonth: month(r.endMonth),
    active: r.active !== false,
  }))
  d.expectedIncome = list(d.expectedIncome)
    .map((e) => ({ id: id(e.id), month: month(e.month), label: str(e.label), amount: numv(e.amount), forWedding: numv(e.forWedding) }))
    .filter((e) => e.month)
  d.wedding.categories = list(d.wedding.categories).map((c) => ({ id: id(c.id), name: str(c.name) || 'Category', planned: numv(c.planned), dueDate: date(c.dueDate), notes: str(c.notes), receipts: str(c.receipts) }))
  d.checklist = list(d.checklist).map((c) => ({
    id: id(c.id),
    title: str(c.title) || 'Task',
    deadline: date(c.deadline),
    priority: oneOf(c.priority, ['High', 'Medium', 'Low'], 'Medium'),
    status: oneOf(c.status, ['Not started', 'In progress', 'Done'], 'Not started'),
    notes: str(c.notes),
  }))
  d.reminders.custom = list(d.reminders.custom).map((r) => ({ id: id(r.id), title: str(r.title) || 'Reminder', date: date(r.date), notes: str(r.notes) })).filter((r) => r.date)
  for (const k of ['completed', 'notified'] as const) {
    d.reminders[k] = Object.fromEntries(Object.entries(isObj(d.reminders[k]) ? d.reminders[k] : {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>
  }
  // Repair links to accounts that no longer exist so records always belong to a real account.
  const accIds = new Set(d.accounts.map((a) => a.id))
  const fallback = d.accounts.find((a) => a.purpose === 'general')?.id ?? d.accounts[0].id
  for (const t of d.transactions) {
    if (!accIds.has(t.accountId)) t.accountId = fallback
    if (t.type === 'transfer' && (!accIds.has(t.toAccountId) || t.toAccountId === t.accountId)) t.type = 'expense'
    if (t.type !== 'transfer') t.toAccountId = ''
    if (t.type === 'income' && !t.category) t.category = 'Other income'
    if (t.type === 'expense' && !t.category) t.category = 'Other expenses'
    if (t.type !== 'expense') t.weddingCategoryId = ''
  }
  const catIds = new Set(d.wedding.categories.map((c) => c.id))
  const recIds = new Set(d.recurring.map((r) => r.id))
  for (const t of d.transactions) {
    if (t.weddingCategoryId && !catIds.has(t.weddingCategoryId)) t.weddingCategoryId = ''
    if (t.recurringId && !recIds.has(t.recurringId)) t.recurringId = ''
  }
  for (const s of d.salaryRecords) if (s.accountId && !accIds.has(s.accountId)) s.accountId = fallback
  d.recurring = d.recurring.filter((r) => r.startMonth && r.amount > 0)
  for (const r of d.recurring) {
    if (!accIds.has(r.accountId)) r.accountId = fallback
    if (r.type === 'transfer' && (!accIds.has(r.toAccountId) || r.toAccountId === r.accountId)) r.type = 'expense'
    if (r.type !== 'transfer') r.toAccountId = ''
    if (r.endMonth && r.endMonth < r.startMonth) r.endMonth = ''
  }
  d.salaryRecords = d.salaryRecords.filter((s, i, a) => a.findIndex((x) => x.payMonth === s.payMonth) === i)
  d.expectedIncome = d.expectedIncome.filter((e) => e.amount > 0).map((e) => ({ ...e, forWedding: Math.min(Math.max(0, e.forWedding), e.amount) }))
  if (!isValidISO(d.profile.weddingDate)) d.profile.weddingDate = createDefaultData().profile.weddingDate
  if (!month(d.savings.planStartMonth)) d.savings.planStartMonth = createDefaultData().savings.planStartMonth
  return d
}

export function loadLocal(key = STORAGE_KEY): { data: AppData; loadError: string; found: boolean } {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { data: createDefaultData(), loadError: '', found: false }
    return { data: normalizeData(JSON.parse(raw)), loadError: '', found: true }
  } catch (e) {
    return { data: createDefaultData(), loadError: `Saved data could not be read (${(e as Error).message}). Starting with defaults — restore a backup from Settings if you have one.`, found: false }
  }
}

export type SyncStatus = 'local' | 'loading' | 'saving' | 'saved' | 'error'

interface Store {
  data: AppData
  loadError: string
  saveError: string
  lastSaved: string
  sync: SyncStatus
  update: (fn: (d: AppData) => void) => void
  replace: (d: AppData) => void
  reset: () => void
}

const initial = loadLocal()
// Save data migrated from an older version straight away, keeping the original as a safety copy.
try {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (initial.found && raw && JSON.parse(raw).version !== 2) {
    localStorage.setItem(`${STORAGE_KEY}:v1-backup`, raw)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial.data))
  }
} catch {
  /* storage unavailable — the data still works in memory */
}

export const useStore = create<Store>((set) => ({
  data: initial.data,
  loadError: initial.loadError,
  saveError: '',
  lastSaved: '',
  sync: 'local',
  update: (fn) =>
    set((s) => {
      const d = structuredClone(s.data)
      fn(d)
      return { data: d }
    }),
  replace: (d) => set({ data: d }),
  reset: () => set({ data: createDefaultData() }),
}))

/** Where local copies are kept. In cloud mode this is changed to a per-user cache key. */
let localKey: string | null = STORAGE_KEY
export function setLocalKey(k: string | null) {
  localKey = k
}

useStore.subscribe((s, prev) => {
  if (s.data === prev.data || !localKey) return
  try {
    localStorage.setItem(localKey, JSON.stringify(s.data))
    useStore.setState({ saveError: '', lastSaved: new Date().toISOString() })
  } catch (e) {
    useStore.setState({ saveError: `Your last change could not be saved on this device: ${(e as Error).message}` })
  }
})

export function useData(): AppData {
  return useStore((s) => s.data)
}
export function useUpdate() {
  return useStore((s) => s.update)
}
