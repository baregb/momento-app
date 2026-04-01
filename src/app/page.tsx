'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.push('/dashboard')
    }
    check()
  }, [router, supabase.auth])

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', width: '100%', display: 'flex', flexDirection: 'column' }}>

      <header style={{ padding: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <ThemeToggle />
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center', gap: '1.5rem' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h1 style={{ color: 'var(--text-primary)', margin: 0 }}>Momento</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '22rem', margin: '0 auto', lineHeight: 1.6 }}>
            Collect photos and videos from everyone at your event — in one shared feed.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '20rem' }}>
          <Link
            href="/auth/register"
            style={{ width: '100%', backgroundColor: 'var(--accent)', color: '#F7E7CE', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 700, fontSize: '1rem', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxSizing: 'border-box' }}
          >
            Host an event
          </Link>
          <Link
            href="/auth/login"
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, fontSize: '1rem', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', textDecoration: 'none', boxSizing: 'border-box', backgroundColor: 'var(--bg-input)' }}
          >
            Sign in
          </Link>
        </div>

        <p style={{ color: 'var(--text-dim)', fontSize: '0.825rem' }}>
          Got an event link? Scan the QR code or ask your host for the link.
        </p>

      </div>

      <footer style={{ padding: '1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.825rem' }}>Momento · Share the moment</p>
      </footer>

    </main>
  )
}