'use client'

export const dynamic = 'force-dynamic'

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
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [fileWarning, setFileWarning] = useState('')

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

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (uploading) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [slug, router, supabase, uploading])

  function handleFileChange(incoming: FileList | null) {
    if (!incoming) return
    setFileWarning('')

    const MAX_FILES = 10
    const MAX_SIZE_MB = 50

    let accepted = Array.from(incoming)
    let warning = ''

    const oversized = accepted.filter(f => f.size > MAX_SIZE_MB * 1024 * 1024)
    accepted = accepted.filter(f => f.size <= MAX_SIZE_MB * 1024 * 1024)

    if (oversized.length > 0) {
      warning += `${oversized.length} file${oversized.length > 1 ? 's' : ''} over ${MAX_SIZE_MB}MB were removed. `
    }

    if (accepted.length > MAX_FILES) {
      warning += `Only the first ${MAX_FILES} files will be uploaded — split the rest into a second upload.`
      accepted = accepted.slice(0, MAX_FILES)
    }

    if (warning) setFileWarning(warning.trim())

    if (accepted.length > 0) {
      const dt = new DataTransfer()
      accepted.forEach(f => dt.items.add(f))
      setFiles(dt.files)
    } else {
      setFiles(null)
    }
  }

  async function handleUpload() {
    if (!files || files.length === 0 || !event) return
    setUploading(true)
    setError('')
    setProgress({ current: 0, total: files.length })

    const guestName = name.trim() || null
    if (guestName) localStorage.setItem('momento-guest-name', guestName)

    const parsedTags = hashtags
      .split(/[\s,#]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)

    const batchId = files.length > 1
      ? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      : null

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setProgress({ current: i + 1, total: files.length })

        const formData = new FormData()
        formData.append('file', file)
        formData.append('eventId', event.id)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()
        if (data.error) throw new Error(data.error)

        await supabase.from('media').insert({
          event_id: event.id,
          url: data.url,
          type: data.type,
          uploaded_by: guestName,
          hashtags: parsedTags,
          batch_id: batchId,
        })
      }
      setDone(true)
    } catch (err: any) {
      setError(err.message ?? 'Upload failed. Please try again.')
    }

    setUploading(false)
    setProgress(null)
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
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading event...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
          onClick={() => { setFiles(null); setDone(false); setHashtags(''); setProgress(null); setFileWarning('') }}
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
        <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '1rem', flex: 1 }}>
          {event.title}
        </p>
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

          {fileWarning && (
            <p style={{ color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', fontSize: '0.825rem', border: '1px solid rgba(245,158,11,0.3)' }}>
              ⚠️ {fileWarning}
            </p>
          )}

          {/* Name field — always editable input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 600 }}>
                Your name (optional)
              </label>
              {name && (
                <button
                  onClick={() => { setName(''); localStorage.removeItem('momento-guest-name') }}
                  style={{ color: 'var(--text-muted)', fontSize: '0.775rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="e.g. Kemi"
              value={name}
              onChange={e => setName(e.target.value)}
              style={input}
            />
          </div>

          {/* Hashtags */}
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
            <p style={{ color: 'var(--text-dim)', fontSize: '0.825rem' }}>Separate tags with spaces</p>
          </div>

          {/* File picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 600 }}>
              Photos & videos *
            </label>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.775rem', margin: 0 }}>
              Selecting multiple files will group them as a carousel post
            </p>
            <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.375rem' }}>

              {/* Camera — no accept filter, let the OS decide */}
              <label
                style={{ flex: 1, minHeight: '72px', border: '1px solid var(--border)', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', cursor: 'pointer', backgroundColor: 'var(--bg-input)', padding: '0.75rem' }}
              >
                <span style={{ fontSize: '1.25rem' }}>📷</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.775rem', fontWeight: 600 }}>Camera</span>
                <input
                  type="file"
                  capture="environment"
                  onChange={e => handleFileChange(e.target.files)}
                  style={{ display: 'none' }}
                />
              </label>

              {/* Library — no accept filter, accepts everything */}
              <label
                style={{ flex: 1, minHeight: '72px', border: files && files.length > 0 ? '2px solid var(--accent)' : '2px dashed var(--border)', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', cursor: 'pointer', backgroundColor: 'var(--bg-input)', padding: '0.75rem' }}
              >
                <span style={{ fontSize: '1.25rem' }}>🖼️</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.775rem', fontWeight: 600, textAlign: 'center' }}>
                  {files && files.length > 0 ? `${files.length} selected` : 'Library'}
                </span>
                <input
                  type="file"
                  multiple
                  onChange={e => handleFileChange(e.target.files)}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          {/* Progress bar */}
          {uploading && progress && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0 }}>
                  Uploading {progress.current} of {progress.total}...
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0 }}>
                  {Math.round((progress.current / progress.total) * 100)}%
                </p>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{ height: '100%', backgroundColor: 'var(--accent)', borderRadius: '999px', width: `${(progress.current / progress.total) * 100}%`, transition: 'width 0.3s ease' }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !files || files.length === 0}
            style={{ width: '100%', backgroundColor: 'var(--accent)', color: '#F7E7CE', borderRadius: '0.75rem', padding: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '1rem', minHeight: '52px', opacity: uploading || !files || files.length === 0 ? 0.4 : 1 }}
          >
            {uploading ? `Uploading ${progress?.current} of ${progress?.total}...` : 'Upload'}
          </button>

          <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.775rem', lineHeight: 1.5 }}>
            Max <strong style={{ color: 'var(--text-muted)' }}>10 files</strong> per upload · Max <strong style={{ color: 'var(--text-muted)' }}>50MB</strong> per file.{' '}
            For larger batches, upload in multiple rounds.
          </p>
        </div>
      </div>
    </main>
  )
}