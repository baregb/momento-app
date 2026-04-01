'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type Event = {
  id: string
  title: string
  slug: string
}

export default function UploadPage() {
  const { slug } = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [event, setEvent] = useState<Event | null>(null)
  const [name, setName] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchEvent() {
      const { data } = await supabase
        .from('events')
        .select('id, title, slug')
        .eq('slug', slug)
        .single()
      if (!data) return router.push('/')
      setEvent(data)
    }

    const savedName = localStorage.getItem('momento-guest-name')
    if (savedName) setName(savedName)

    fetchEvent()
  }, [slug, router, supabase])

  async function handleUpload() {
    if (!files || files.length === 0 || !event) return
    setUploading(true)
    setError('')

    const guestName = name.trim() || null
    if (guestName) localStorage.setItem('momento-guest-name', guestName)

    const parsedTags = hashtags
      .split(/[\s,#]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()
        const path = `${event.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const isVideo = file.type.startsWith('video/')

        const { data: storageData, error: storageError } = await supabase.storage
          .from('event-media')
          .upload(path, file, { contentType: file.type })

        if (storageError) throw storageError

        const { data: urlData } = supabase.storage
          .from('event-media')
          .getPublicUrl(storageData.path)

        await supabase.from('media').insert({
          event_id: event.id,
          url: urlData.publicUrl,
          type: isVideo ? 'video' : 'image',
          uploaded_by: guestName,
          hashtags: parsedTags,
        })
      }

      setDone(true)
    } catch (err: any) {
      setError(err.message ?? 'Upload failed. Please try again.')
    }

    setUploading(false)
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

  if (!event) return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading event...</p>
    </main>
  )

  if (done) return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', gap: '1rem', textAlign: 'center' }}>
      <p style={{ fontSize: '3rem' }}>🎉</p>
      <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Uploaded!</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Your media has been added to {event.title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '20rem' }}>
        <button
          onClick={() => { setFiles(null); setDone(false); setHashtags('') }}
          style={{ width: '100%', backgroundColor: 'var(--accent)', color: '#F7E7CE', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '52px' }}
        >
          Upload more
        </button>
        <Link
          href={`/e/${slug}`}
          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxSizing: 'border-box' }}
        >
          View the feed
        </Link>
      </div>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', width: '100%' }}>
      <header style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link
          href={`/e/${slug}`}
          style={{ height: '44px', paddingLeft: '1rem', paddingRight: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', whiteSpace: 'nowrap', flexShrink: 0, textDecoration: 'none' }}
        >
          ‹ Feed
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '1rem' }}>
            {event.title}
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div style={{ maxWidth: '32rem', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '1rem', padding: '1.25rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Share your shots</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Add your photos and videos to the event feed
            </p>
          </div>

          {error && (
            <p style={{ color: 'var(--text-primary)', backgroundColor: 'var(--border)', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', fontSize: '0.875rem' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 600 }}>
              Your name (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Kemi"
              value={name}
              onChange={e => setName(e.target.value)}
              style={input}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 600 }}>
              Hashtags (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. ceremony dance cake"
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              style={input}
            />
            <p style={{ color: 'var(--text-dim)', fontSize: '0.825rem' }}>
              Separate tags with spaces
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 600 }}>
              Photos & videos *
            </label>
            <label
              style={{ width: '100%', minHeight: '120px', border: '2px dashed var(--border)', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', backgroundColor: 'var(--bg-input)', boxSizing: 'border-box', padding: '1.5rem' }}
            >
              <span style={{ fontSize: '2rem' }}>📁</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>
                {files && files.length > 0
                  ? `${files.length} file${files.length > 1 ? 's' : ''} selected`
                  : 'Tap to select photos or videos'}
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={e => setFiles(e.target.files)}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || !files || files.length === 0}
            style={{ width: '100%', backgroundColor: 'var(--accent)', color: '#F7E7CE', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '52px', opacity: uploading || !files || files.length === 0 ? 0.4 : 1 }}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </main>
  )
}