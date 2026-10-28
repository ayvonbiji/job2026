import { create } from 'zustand'
import type { AppData } from './types'
import { createDefaultData } from './defaults'
import { isValidISO } from './dates'

export const STORAGE_KEY = 'my-life-planner-2027'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Fill missing fields from a template, keeping only values of the right type. */
function mergeShape<T>(template: T, value: unknown): T {
  if (Array.isArray(template)) {
    return (Array.isArray(value) ? value : template) as T
  }
  if (isObj(template)) {
    const src = isObj(value) ? value : {}
    const out: Obj = {}
    for (const k of Object.keys(template)) {
      out[k] = mergeShape((template as Obj)[k], src[k])
    }
    // keep record-style maps (e.g. reminders.completed) that have dynamic keys
    if (Object.keys(template as Obj).length === 0 && isObj(value)) return value as T
    return out as T
  }
  if (typeof template === 'number') {
    return (typeof value === 'number' && Number.isFinite(value) ? value : template) as T
  }
  if (typeof template === typeof value) return value as T
  return template
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const numv = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const date = (v: unknown) => (typeof v === 'string' && isValidISO(v) ? v : '')

/** Validate + repair data loaded from storage or a backup file. Throws on unusable input. */
export function normalizeData(raw: unknown): AppData {
  if (!isObj(raw)) throw new Error('The file does not contain planner data.')
  if (raw.version !== 1) throw new Error('This backup was made by an unknown version of the planner.')
  const d = mergeShape(createDefaultData(), raw)

  d.leaves = (d.leaves as unknown[])
    .filter(isObj)
    .map((l: Obj) => ({
      id: str(l.id) || crypto.randomUUID(),
      type: (['Annual', 'Sick', 'Unpaid', 'Other'].includes(l.type as string) ? l.type : 'Annual') as AppData['leaves'][number]['type'],
      status: (['Planned', 'Pending', 'Approved', 'Taken', 'Rejected', 'Cancelled'].includes(l.status as string)
        ? l.status
        : 'Planned') as AppData['leaves'][number]['status'],
      startDate: date(l.startDate),
      endDate: date(l.endDate) || date(l.startDate),
      startHalf: !!l.startHalf,
      endHalf: !!l.endHalf,
      forWedding: !!l.forWedding,
      notes: str(l.notes),
    }))
    .filter((l) => l.startDate)

  d.transactions = (d.transactions as unknown[])
    .filter(isObj)
    .map((t: Obj) => ({
      id: str(t.id) || crypto.randomUUID(),
      date: date(t.date),
      type: (['income', 'expense', 'transfer'].includes(t.type as string) ? t.type : 'expense') as AppData['transactions'][number]['type'],
      amount: Math.abs(numv(t.amount)),
      category: str(t.category),
      accountId: str(t.accountId),
      toAccountId: str(t.toAccountId),
      weddingCategoryId: str(t.weddingCategoryId),
      notes: str(t.notes),
    }))
    .filter((t) => t.date && t.amount > 0)

  d.accounts = (d.accounts as unknown[]).filter(isObj).map((a: Obj) => ({
    id: str(a.id) || crypto.randomUUID(),
    name: str(a.name) || 'Account',
    purpose: (['general', 'wedding', 'emergency'].includes(a.purpose as string) ? a.purpose : 'general') as AppData['accounts'][number]['purpose'],
    openingBalance: numv(a.openingBalance),
  }))
  if (d.accounts.length === 0) d.accounts = createDefaultData().accounts

  d.wedding.categories = (d.wedding.categories as unknown[]).filter(isObj).map((c: Obj) => ({
    id: str(c.id) || crypto.randomUUID(),
    name: str(c.name) || 'Category',
    planned: numv(c.planned),
    dueDate: date(c.dueDate),
    notes: str(c.notes),
    receipts: str(c.receipts),
  }))

  d.checklist = (d.checklist as unknown[]).filter(isObj).map((c: Obj) => ({
    id: str(c.id) || crypto.randomUUID(),
    title: str(c.title) || 'Task',
    deadline: date(c.deadline),
    priority: (['High', 'Medium', 'Low'].includes(c.priority as string) ? c.priority : 'Medium') as AppData['checklist'][number]['priority'],
    status: (['Not started', 'In progress', 'Done'].includes(c.status as string) ? c.status : 'Not started') as AppData['checklist'][number]['status'],
    notes: str(c.notes),
  }))

  d.leavePolicy.weekendDays = d.leavePolicy.weekendDays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  d.leavePolicy.holidays = d.leavePolicy.holidays.filter((h) => isObj(h) && isValidISO((h as Obj).date as string))
  d.expectedIncome = d.expectedIncome.filter((e) => isObj(e) && /^\d{4}-\d{2}$/.test(String((e as Obj).month)))
  d.reminders.custom = d.reminders.custom.filter((r) => isObj(r) && isValidISO((r as Obj).date as string))
  if (!isValidISO(d.profile.weddingDate)) d.profile.weddingDate = createDefaultData().profile.weddingDate
  return d
}

function load(): { data: AppData; loadError: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { data: createDefaultData(), loadError: '' }
    return { data: normalizeData(JSON.parse(raw)), loadError: '' }
  } catch (e) {
    return {
      data: createDefaultData(),
      loadError: `Saved data could not be read (${(e as Error).message}). Starting with defaults — restore a backup from Settings if you have one.`,
    }
  }
}

interface Store {
  data: AppData
  loadError: string
  saveError: string
  lastSaved: string
  update: (fn: (d: AppData) => void) => void
  replace: (d: AppData) => void
  reset: () => void
}

const initial = load()

export const useStore = create<Store>((set) => ({
  data: initial.data,
  loadError: initial.loadError,
  saveError: '',
  lastSaved: '',
  update: (fn) =>
    set((s) => {
      const d = structuredClone(s.data)
      fn(d)
      return { data: d }
    }),
  replace: (d) => set({ data: d }),
  reset: () => set({ data: createDefaultData() }),
}))

// Save on every change. Errors (e.g. storage full or private mode) are surfaced in the UI.
useStore.subscribe((s, prev) => {
  if (s.data === prev.data) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s.data))
    if (s.saveError) useStore.setState({ saveError: '' })
    useStore.setState({ lastSaved: new Date().toISOString() })
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
