'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { generateSlug } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type Event = {
  id: string
  title: string
  slug: string
  description: string | null
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [events, setEvents] = useState<Event[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchEvents() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/auth/login')
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false })
      if (data) setEvents(data)
    }
    fetchEvents()
  }, [router, supabase])

  async function createEvent() {
    if (!title.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const slug = generateSlug(title)
    const { data, error } = await supabase
      .from('events')
      .insert({ host_id: user.id, title, description, slug })
      .select()
      .single()
    if (!error && data) {
      setEvents(prev => [data, ...prev])
      setTitle('')
      setDescription('')
      setShowForm(false)
      router.push(`/dashboard/${data.id}`)
    }
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
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
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', width: '100%' }}>
      <header style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>My Events</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleSignOut}
            style={{
              height: '44px',
              paddingLeft: '1rem',
              paddingRight: '1rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div style={{ maxWidth: '32rem', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

        {showForm ? (
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '1rem', padding: '1.25rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>New event</h3>
            <input
              type="text"
              placeholder="Event title *"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={input}
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ ...input, minHeight: 'unset', resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button
                onClick={createEvent}
                disabled={loading || !title.trim()}
                style={{ flex: 1, backgroundColor: 'var(--accent)', color: '#F7E7CE', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '52px', opacity: loading || !title.trim() ? 0.4 : 1 }}
              >
                {loading ? 'Creating...' : 'Create event'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{ padding: '0.875rem 1.25rem', border: '1px solid var(--border)', borderRadius: '0.75rem', color: 'var(--text-muted)', background: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '52px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            style={{ width: '100%', backgroundColor: 'var(--accent)', color: '#F7E7CE', borderRadius: '1rem', padding: '1rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '56px' }}
          >
            + Create new event
          </button>
        )}

        {events.length === 0 && !showForm && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', padding: '3rem 0' }}>
            No events yet. Create your first one above.
          </p>
        )}

        {events.map(event => (
          <Link
            key={event.id}
            href={`/dashboard/${event.id}`}
            style={{ display: 'block', backgroundColor: 'var(--bg-surface)', borderRadius: '1rem', padding: '1.125rem', border: '1px solid var(--border)', textDecoration: 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>{event.title}</h4>
                {event.description && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{event.description}</p>
                )}
                <p style={{ color: 'var(--text-dim)', fontSize: '0.825rem', marginTop: '0.5rem' }}>/{event.slug}</p>
              </div>
              <span style={{ color: 'var(--text-dim)', fontSize: '1.25rem', flexShrink: 0 }}>›</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}