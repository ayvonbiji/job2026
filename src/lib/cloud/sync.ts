import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { AppData } from '../types'
import { STORAGE_KEY, loadLocal, setLocalKey, useStore } from '../store'
import { PK, TABLES, diffRows, fromRows, toRows, type Diff, type Row, type RowRef, type TableName } from './rows'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Only the public "anon" key belongs in the browser. Never put the service_role key here. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null
export const cloudEnabled = !!supabase

type Phase = 'signedOut' | 'loading' | 'choose' | 'ready' | 'error'

interface CloudState {
  phase: Phase
  user: User | null
  error: string
  pending: boolean
  localCandidate: AppData | null // data found on this device for a brand-new account
}

export const useCloud = create<CloudState>(() => ({ phase: 'signedOut', user: null, error: '', pending: false, localCandidate: null }))

let baseline: RowRef[] = []
let pushing = false
let timer: ReturnType<typeof setTimeout> | undefined
let unsub: (() => void) | undefined

const dirtyKey = () => `${STORAGE_KEY}:cloud:${useCloud.getState().user?.id}:unsaved`
function markDirty(v: boolean) {
  try {
    if (v) localStorage.setItem(dirtyKey(), '1')
    else localStorage.removeItem(dirtyKey())
  } catch {
    /* storage unavailable */
  }
}

async function fetchAll(client: SupabaseClient): Promise<Partial<Record<TableName, Row[]>>> {
  const results = await Promise.all(TABLES.map((t) => client.from(t).select('*')))
  const out: Partial<Record<TableName, Row[]>> = {}
  results.forEach((r, i) => {
    if (r.error) throw new Error(`${TABLES[i]}: ${r.error.message}`)
    out[TABLES[i]] = (r.data ?? []) as Row[]
  })
  return out
}

export async function pushDiff(client: SupabaseClient, userId: string, diff: Diff) {
  for (const t of TABLES) {
    const rows = diff.upserts.get(t)
    if (!rows?.length) continue
    const pk = PK[t]
    const { error } = await client.from(t).upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: pk ? `user_id,${pk}` : 'user_id' })
    if (error) throw new Error(`Saving ${t.replace(/_/g, ' ')}: ${error.message}`)
  }
  for (const t of [...TABLES].reverse()) {
    const keys = diff.deletes.get(t)
    const pk = PK[t]
    if (!keys?.length || !pk) continue
    const { error } = await client.from(t).delete().eq('user_id', userId).in(pk, keys)
    if (error) throw new Error(`Deleting from ${t.replace(/_/g, ' ')}: ${error.message}`)
  }
}

async function flush() {
  const client = supabase
  const user = useCloud.getState().user
  if (!client || !user || pushing || useCloud.getState().phase !== 'ready') return
  pushing = true
  try {
    for (let i = 0; i < 5; i++) {
      const next = toRows(useStore.getState().data)
      const diff = diffRows(baseline, next)
      if (!diff.count) break
      useStore.setState({ sync: 'saving' })
      await pushDiff(client, user.id, diff)
      baseline = next
    }
    useStore.setState({ sync: 'saved', saveError: '', lastSaved: new Date().toISOString() })
    useCloud.setState({ pending: false, error: '' })
    markDirty(false)
  } catch (e) {
    useStore.setState({ sync: 'error', saveError: `Could not save to your account: ${(e as Error).message}. Your changes are kept on this device and will be retried.` })
    useCloud.setState({ error: (e as Error).message })
    clearTimeout(timer)
    timer = setTimeout(flush, 15000)
  } finally {
    pushing = false
  }
}

function schedule() {
  useCloud.setState({ pending: true })
  markDirty(true)
  clearTimeout(timer)
  timer = setTimeout(flush, 700)
}

export function retrySync() {
  void flush()
}

function startWatching() {
  unsub?.()
  unsub = useStore.subscribe((s, prev) => {
    if (s.data !== prev.data) schedule()
  })
}

async function loadForUser(user: User) {
  const client = supabase!
  useCloud.setState({ phase: 'loading', user, error: '' })
  useStore.setState({ sync: 'loading' })
  const cacheKey = `${STORAGE_KEY}:cloud:${user.id}`
  const cached = loadLocal(cacheKey)
  let hadUnsaved = false
  try {
    hadUnsaved = localStorage.getItem(`${cacheKey}:unsaved`) === '1'
  } catch {
    /* ignore */
  }
  try {
    const remote = fromRows(await fetchAll(client))
    if (!remote) {
      const local = loadLocal(STORAGE_KEY)
      useCloud.setState({ phase: 'choose', localCandidate: local.found ? local.data : null })
      return
    }
    baseline = toRows(remote)
    setLocalKey(cacheKey)
    useStore.getState().replace(remote)
    useStore.setState({ sync: 'saved', loadError: '' })
    useCloud.setState({ phase: 'ready' })
    startWatching()
    // A newer offline copy may exist from a failed save; push it if so.
    if (hadUnsaved && cached.found && diffRows(baseline, toRows(cached.data)).count && confirm('This device has changes that were not saved to your account. Save them now?')) {
      useStore.getState().replace(cached.data)
    } else markDirty(false)
  } catch (e) {
    if (cached.found) {
      setLocalKey(cacheKey)
      useStore.getState().replace(cached.data)
    }
    useStore.setState({ sync: 'error', loadError: `Could not load your data from Supabase: ${(e as Error).message}${cached.found ? ' Showing the copy saved on this device.' : ''}` })
    useCloud.setState({ phase: cached.found ? 'ready' : 'error', error: (e as Error).message })
  }
}

/** First sign-in: create the account's records from this device's data or from the defaults. */
export async function initialiseAccount(useLocal: boolean) {
  const { user, localCandidate } = useCloud.getState()
  if (!supabase || !user) return
  const { createDefaultData } = await import('../defaults')
  const data = useLocal && localCandidate ? localCandidate : createDefaultData()
  useCloud.setState({ phase: 'loading' })
  try {
    await pushDiff(supabase, user.id, diffRows([], toRows(data)))
    await loadForUser(user)
  } catch (e) {
    useCloud.setState({ phase: 'choose', error: (e as Error).message })
  }
}

export function initCloud() {
  if (!supabase) return
  setLocalKey(null) // nothing is cached until a user has signed in
  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user) void loadForUser(data.session.user)
    else useCloud.setState({ phase: 'signedOut' })
  })
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user && session.user.id !== useCloud.getState().user?.id) void loadForUser(session.user)
    if (event === 'SIGNED_OUT') {
      unsub?.()
      baseline = []
      useCloud.setState({ phase: 'signedOut', user: null, localCandidate: null })
    }
  })
  window.addEventListener('beforeunload', (e) => {
    if (useCloud.getState().pending) e.preventDefault()
  })
}

export async function signOut() {
  const user = useCloud.getState().user
  await flush()
  if (user) localStorage.removeItem(`${STORAGE_KEY}:cloud:${user.id}`)
  setLocalKey(null)
  unsub?.()
  baseline = []
  useCloud.setState({ phase: 'signedOut', user: null, localCandidate: null })
  await supabase?.auth.signOut()
  const { createDefaultData } = await import('../defaults')
  useStore.getState().replace(createDefaultData())
}
