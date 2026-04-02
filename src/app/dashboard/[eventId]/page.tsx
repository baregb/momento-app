'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { QRCodeSVG } from 'qrcode.react'
import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/client'
import { formatTimeAgo } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type Event = {
  id: string
  title: string
  slug: string
  description: string | null
  created_at: string
}

type Media = {
  id: string
  url: string
  type: string
  uploaded_by: string | null
  hashtags: string[]
  views: number
  created_at: string
}

const pillButton: React.CSSProperties = {
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
  gap: '0.375rem',
  whiteSpace: 'nowrap' as const,
  flexShrink: 0,
  textDecoration: 'none',
}

const inputStyle: React.CSSProperties = {
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

export default function EventDashboardPage() {
  const { eventId } = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [event, setEvent] = useState<Event | null>(null)
  const [media, setMedia] = useState<Media[]>([])
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [deleting, setDeleting] = useState(false)

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '')
  ).replace(/\/$/, '')

  const eventUrl = event ? `${appUrl}/e/${event.slug}` : ''

  useEffect(() => {
    async function fetchEvent() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/auth/login')

      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .eq('host_id', user.id)
        .single()

      if (!eventData) return router.push('/dashboard')
      setEvent(eventData)

      const { data: mediaData } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (mediaData) setMedia(mediaData)
    }
    fetchEvent()
  }, [eventId, router, supabase])

  async function copyLink() {
    await navigator.clipboard.writeText(eventUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openEdit() {
    if (!event) return
    setEditTitle(event.title)
    setEditDescription(event.description ?? '')
    setEditing(true)
  }

  async function handleSaveEdit() {
    if (!editTitle.trim() || !event) return
    const { data, error } = await supabase
      .from('events')
      .update({ title: editTitle, description: editDescription })
      .eq('id', event.id)
      .select()
      .single()
    if (!error && data) {
      setEvent(data)
      setEditing(false)
    }
  }

  async function handleDelete() {
    if (!event) return
    const confirmed = window.confirm(`Delete "${event.title}"? This will remove all uploads too.`)
    if (!confirmed) return
    setDeleting(true)
    await supabase.from('events').delete().eq('id', event.id)
    router.push('/dashboard')
  }

  async function handleDownloadAll() {
    if (media.length === 0) return
    setZipping(true)
    try {
      const zip = new JSZip()
      await Promise.all(
        media.map(async (item, index) => {
          const response = await fetch(item.url)
          const blob = await response.blob()
          const ext = item.type === 'video' ? 'mp4' : 'jpg'
          const name = `${String(index + 1).padStart(3, '0')}-${item.uploaded_by ?? 'anonymous'}.${ext}`
          zip.file(name, blob)
        })
      )
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `${event!.title.replace(/\s+/g, '-').toLowerCase()}-media.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Zip failed:', err)
    }
    setZipping(false)
  }

  if (!event) return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading...</p>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', width: '100%' }}>

      <header style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/dashboard" style={pillButton}>
          ‹ Back
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '1rem' }}>
            {event.title}
          </p>
          {event.description && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.description}
            </p>
          )}
        </div>
        <ThemeToggle />
      </header>

      <div style={{ maxWidth: '32rem', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

        {/* Share card */}
        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '1rem', padding: '1.25rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>Share with guests</h4>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-input)', borderRadius: '0.75rem', padding: '0.75rem', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
              {eventUrl}
            </p>
            <button
              onClick={copyLink}
              style={{ color: copied ? 'var(--text-primary)' : 'var(--text-silver)', fontSize: '0.875rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', padding: '0.25rem 0.5rem', minHeight: '44px' }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <button
            onClick={() => setShowQR(v => !v)}
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.875rem', fontSize: '0.875rem', color: 'var(--text-muted)', background: 'none', cursor: 'pointer', minHeight: '52px', fontWeight: 600 }}
          >
            {showQR ? 'Hide QR code' : 'Show QR code'}
          </button>

          {showQR && (
            <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#F7E7CE', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <QRCodeSVG value={eventUrl} size={200} />
            </div>
          )}

          <button
            onClick={handleDownloadAll}
            disabled={zipping || media.length === 0}
            style={{ width: '100%', backgroundColor: 'var(--accent)', color: '#F7E7CE', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '52px', opacity: zipping || media.length === 0 ? 0.4 : 1 }}
          >
            {zipping ? `Zipping ${media.length} files...` : `↓ Download all (${media.length})`}
          </button>
        </div>

        {/* Edit form */}
        {editing && (
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '1rem', padding: '1.25rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>Edit event</h4>
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="Event title"
              style={inputStyle}
            />
            <textarea
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              style={{ ...inputStyle, minHeight: 'unset', resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button
                onClick={handleSaveEdit}
                disabled={!editTitle.trim()}
                style={{ flex: 1, backgroundColor: 'var(--accent)', color: '#F7E7CE', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '52px', opacity: !editTitle.trim() ? 0.4 : 1 }}
              >
                Save changes
              </button>
              <button
                onClick={() => setEditing(false)}
                style={{ padding: '0.875rem 1.25rem', border: '1px solid var(--border)', borderRadius: '0.75rem', color: 'var(--text-muted)', background: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '52px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Edit and delete actions */}
        {!editing && (
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button
              onClick={openEdit}
              style={{ flex: 1, border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', background: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '52px' }}
            >
              Edit event
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ flex: 1, border: '1px solid #7f1d1d', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, color: '#ef4444', background: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '52px', opacity: deleting ? 0.4 : 1 }}
            >
              {deleting ? 'Deleting...' : 'Delete event'}
            </button>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '1rem', border: '1px solid var(--border)', padding: '1.25rem', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{media.length}</p>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Total uploads</p>
          </div>
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '1rem', border: '1px solid var(--border)', padding: '1.25rem', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {media.reduce((sum, m) => sum + m.views, 0)}
            </p>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Total views</p>
          </div>
        </div>

        {/* Media list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>Uploads</h4>

          {media.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', padding: '2.5rem 0' }}>
              No uploads yet. Share the link with your guests.
            </p>
          )}

          {media.map(item => (
            <div key={item.id} style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '1rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {item.type === 'image' ? (
                <Image
                  src={item.url}
                  alt=""
                  width={500}
                  height={281}
                  style={{ width: '100%', height: 'auto', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                  priority={false}
                />
              ) : (
                <video
                  src={item.url}
                  controls
                  style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                />
              )}
              <div style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0 }}>
                    {item.uploaded_by ?? 'Anonymous'} · {formatTimeAgo(item.created_at)}
                  </p>
                  {item.hashtags.length > 0 && (
                    <p style={{ color: 'var(--accent-faint)', fontSize: '0.825rem', marginTop: '0.125rem' }}>
                      {item.hashtags.map(t => `#${t}`).join(' ')}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexShrink: 0 }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.825rem' }}>
                    {item.views} views
                  </span>
                  <a
                    href={item.url}
                    download
                    style={{ color: 'var(--text-silver)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', padding: '0.5rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}
                  >
                    ↓
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}