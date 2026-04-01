'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { formatTimeAgo } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type Event = {
  id: string
  title: string
  slug: string
  description: string | null
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

export default function EventFeedPage() {
  const { slug } = useParams()
  const supabase = useMemo(() => createClient(), [])

  const [event, setEvent] = useState<Event | null>(null)
  const [media, setMedia] = useState<Media[]>([])
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const observerRefs = useRef<Map<string, IntersectionObserver>>(new Map())

  useEffect(() => {
    async function fetchData() {
      const { data: eventData } = await supabase
        .from('events')
        .select('id, title, slug, description')
        .eq('slug', slug)
        .single()

      if (!eventData) return
      setEvent(eventData)

      const { data: mediaData } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', eventData.id)
        .order('created_at', { ascending: false })

      if (mediaData) setMedia(mediaData)
      setLoading(false)
    }
    fetchData()
  }, [slug, supabase])

  function attachViewObserver(el: HTMLElement | null, mediaId: string) {
    if (!el || observerRefs.current.has(mediaId)) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            await supabase.rpc('increment_views', { media_id: mediaId })
            observer.disconnect()
            observerRefs.current.delete(mediaId)
          }
        })
      },
      { threshold: 0.7 }
    )
    observer.observe(el)
    observerRefs.current.set(mediaId, observer)
  }

  const allTags = Array.from(
    new Set(media.flatMap(m => m.hashtags))
  ).filter(Boolean)

  const filtered = activeTag
    ? media.filter(m => m.hashtags.includes(activeTag))
    : media

  if (loading) return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading feed...</p>
    </main>
  )

  if (!event) return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Event not found.</p>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', width: '100%' }}>

      {/* Header */}
      <header style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '1rem' }}>
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

      {/* Hashtag filter bar */}
      {allTags.length > 0 && (
        <div style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '0.625rem 1rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <button
            onClick={() => setActiveTag(null)}
            style={{ height: '36px', paddingLeft: '0.875rem', paddingRight: '0.875rem', borderRadius: '2rem', border: '1px solid var(--border)', backgroundColor: activeTag === null ? 'var(--accent)' : 'var(--bg-input)', color: activeTag === null ? '#F7E7CE' : 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              style={{ height: '36px', paddingLeft: '0.875rem', paddingRight: '0.875rem', borderRadius: '2rem', border: '1px solid var(--border)', backgroundColor: activeTag === tag ? 'var(--accent)' : 'var(--bg-input)', color: activeTag === tag ? '#F7E7CE' : 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* TikTok-style feed */}
      <div style={{ scrollSnapType: 'y mandatory', overflowY: 'scroll', height: 'calc(100dvh - 57px)', width: '100%' }}>

        {filtered.length === 0 && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
            <p style={{ fontSize: '2.5rem' }}>📷</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>
              {activeTag ? `No uploads tagged #${activeTag} yet.` : 'No uploads yet. Be the first to share!'}
            </p>
          </div>
        )}

        {filtered.map(item => (
          <div
            key={item.id}
            ref={el => attachViewObserver(el, item.id)}
            style={{ scrollSnapAlign: 'start', height: '100dvh', width: '100%', position: 'relative', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {item.type === 'image' ? (
              <Image
                src={item.url}
                alt=""
                fill
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <video
                src={item.url}
                controls
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            )}

            {/* Overlay info */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3rem 1rem 1.5rem', background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)' }}>
              <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>
                {item.uploaded_by ?? 'Anonymous'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.825rem', margin: '0.125rem 0 0' }}>
                {formatTimeAgo(item.created_at)} · {item.views} views
              </p>
              {item.hashtags.length > 0 && (
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.825rem', marginTop: '0.375rem' }}>
                  {item.hashtags.map(t => `#${t}`).join(' ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upload FAB */}
      <Link
        href={`/e/${slug}/upload`}
        style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', backgroundColor: 'var(--accent)', color: '#F7E7CE', borderRadius: '2rem', padding: '0.875rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none', zIndex: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
      >
        + Add photos
      </Link>
    </main>
  )
}