import { useState, type FormEvent } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { supabase, initialiseAccount, useCloud } from '../lib/cloud/sync'
import { fmtDate } from '../lib/dates'
import { Alert, Button, TextField } from '../components/ui'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="font-serif text-4xl font-semibold text-navy-900">My Life Planner</div>
          <div className="text-xs tracking-[0.3em] text-gold-600">2027</div>
        </div>
        <div className="rounded-2xl border border-cream-300 bg-white p-6 shadow-card">{children}</div>
      </div>
    </div>
  )
}

export function Loading({ text = 'Loading your planner…' }: { text?: string }) {
  return (
    <Shell>
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-600" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{text}</div>
    </Shell>
  )
}

export function Login() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ level: 'danger' | 'ok'; text: string } | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg({ level: 'danger', text: 'Enter a valid email address.' })
    if (mode !== 'reset' && password.length < 8) return setMsg({ level: 'danger', text: 'Password must be at least 8 characters.' })
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
        if (error) throw error
        if (!data.session) setMsg({ level: 'ok', text: 'Check your email and click the confirmation link, then sign in.' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname })
        if (error) throw error
        setMsg({ level: 'ok', text: 'If that email has an account, a password reset link is on its way.' })
      }
    } catch (err) {
      setMsg({ level: 'danger', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Shell>
      <h1 className="flex items-center gap-2 text-lg font-semibold text-navy-900"><Lock className="h-4 w-4" aria-hidden />{mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create your account' : 'Reset password'}</h1>
      <p className="mb-4 mt-1 text-sm text-slate-600">Your planner is private. Only your signed-in account can see your records.</p>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        {mode !== 'reset' && <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required hint={mode === 'up' ? 'At least 8 characters.' : undefined} />}
        {msg && <Alert level={msg.level}>{msg.text}</Alert>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}</Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        {mode !== 'in' ? <button type="button" className="text-navy-600 hover:underline" onClick={() => setMode('in')}>Back to sign in</button> : <button type="button" className="text-navy-600 hover:underline" onClick={() => setMode('up')}>Create an account</button>}
        {mode === 'in' && <button type="button" className="text-navy-600 hover:underline" onClick={() => setMode('reset')}>Forgot password?</button>}
      </div>
    </Shell>
  )
}

export function ChooseStart() {
  const local = useCloud((s) => s.localCandidate)
  const error = useCloud((s) => s.error)
  return (
    <Shell>
      <h1 className="text-lg font-semibold text-navy-900">Welcome! Set up your planner</h1>
      {local ? (
        <>
          <p className="mt-2 text-sm text-slate-600">
            This browser already has planner data ({local.transactions.length} transactions, {local.leaves.length} leave records, wedding on {fmtDate(local.profile.weddingDate)}). Copy it into your account?
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={() => void initialiseAccount(true)}>Copy this device’s data to my account</Button>
            <Button variant="secondary" onClick={() => confirm('Start with a fresh planner? Data on this device is not copied.') && void initialiseAccount(false)}>Start fresh</Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">Your planner will start with your Soffit employment details and wedding date. You can edit everything.</p>
          <Button className="mt-4 w-full" onClick={() => void initialiseAccount(false)}>Create my planner</Button>
        </>
      )}
      {error && <div className="mt-3"><Alert level="danger">{error}. Check that you ran supabase/schema.sql in your Supabase project.</Alert></div>}
    </Shell>
  )
}
