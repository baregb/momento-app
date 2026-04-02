'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function RegisterPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleRegister() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      }
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  const input: React.CSSProperties = {
    width: '100%',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1rem',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
    minHeight: '52px',
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
        <ThemeToggle />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '24rem', backgroundColor: 'var(--bg-surface)', borderRadius: '1.25rem', padding: '2rem 1.5rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {sent ? (
            <>
              <div>
                <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Check your email</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Click it to activate your account and you will be taken straight to your dashboard.
                </p>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                Did you not get it? Check your spam folder or{' '}
                <button
                  onClick={() => setSent(false)}
                  style={{ color: 'var(--text-silver)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.825rem', padding: 0 }}
                >
                  try again
                </button>
                .
              </p>
              <Link
                href="/auth/login"
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, fontSize: '1rem', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', textDecoration: 'none', boxSizing: 'border-box', backgroundColor: 'var(--bg-input)' }}
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <div>
                <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Create account</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Host your first event in minutes</p>
              </div>

              {error && (
                <p style={{ color: 'var(--text-primary)', backgroundColor: 'var(--border)', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', fontSize: '0.875rem' }}>
                  {error}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  style={input}
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={input}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={input}
                />
              </div>

              <button
                onClick={handleRegister}
                disabled={loading}
                style={{ width: '100%', backgroundColor: 'var(--accent)', color: '#F7E7CE', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '52px', opacity: loading ? 0.5 : 1 }}
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>

              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Already have an account?{' '}
                <Link href="/auth/login" style={{ color: 'var(--text-silver)', fontWeight: 600 }}>
                  Sign in
                </Link>
              </p>
            </>
          )}

        </div>
      </div>
    </main>
  )
}