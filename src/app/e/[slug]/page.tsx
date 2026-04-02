'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { formatTimeAgo } from '@/lib/utils'

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
  const [sharedId, setSharedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [feedHeight, setFeedHeight] = useState('100dvh')

  const observerRefs = useRef<Map<string, IntersectionObserver>>(new Map())
  const headerRef = useRef<HTMLElement | null>(null)
  const filterRef = useRef<HTMLDivElement | null>(null)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const touchStartY = useRef(0)

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '')
  ).replace(/\/$/, '')

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

  useEffect(() => {
    function recalcHeight() {
      const headerH = headerRef.current?.offsetHeight ?? 57
      const filterH = filterRef.current?.offsetHeight ?? 0
      setFeedHeight(`calc(100dvh - ${headerH + filterH}px)`)
    }
    recalcHeight()
    window.addEventListener('resize', recalcHeight)
    return () => window.removeEventListener('resize', recalcHeight)
  }, [media])

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

  async function handleShare(item: Media) {
    const shareUrl = `${appUrl}/e/${slug}?post=${item.id}`
    const uploadedBy = item.uploaded_by ?? 'Anonymous'
    const shareData = {
      title: event?.title ?? 'Momento',
      text: `Check out this photo from ${uploadedBy} at ${event?.title}`,
      url: shareUrl,
    }
    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setSharedId(item.id)
        setTimeout(() => setSharedId(null), 2000)
      }
    } catch (err) {
      console.error('Share failed:', err)
    }
  }

  async function handlePullRefresh() {
    if (refreshing) return
    setRefreshing(true)

    const { data: eventData } = await supabase
      .from('events')
      .select('id, title, slug, description')
      .eq('slug', slug)
      .single()

    if (eventData) {
      setEvent(eventData)
      const { data: mediaData } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', eventData.id)
        .order('created_at', { ascending: false })
      if (mediaData) setMedia(mediaData)
    }

    setRefreshing(false)
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    const diff = e.changedTouches[0].clientY - touchStartY.current
    const atTop = feedRef.current?.scrollTop === 0
    if (diff > 80 && atTop) handlePullRefresh()
  }

  const allTags = Array.from(
    new Set(media.flatMap(m => m.hashtags))
  ).filter(Boolean)

  const filtered = activeTag
    ? media.filter(m => m.hashtags.includes(activeTag))
    : media

  if (loading) return (
    <main style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )

  if (!event) return (
    <main style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>Event not found.</p>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#000', width: '100%' }}>

      <header
        ref={headerRef}
        style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem', position: 'sticky', top: 0, zIndex: 10 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <p style={{ color: '#ffffff', margin: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '1rem' }}>
              {event.title}
            </p>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.825rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {media.length} {media.length === 1 ? 'photo' : 'photos'}
            </span>
          </div>
          {event.description && (
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.825rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.description}
            </p>
          )}
        </div>
        {refreshing && (
          <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </header>

      {/* Hashtag category filter bar */}
      {allTags.length > 0 && (
        <div
          ref={filterRef}
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.625rem 1rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          <button
            onClick={() => setActiveTag(null)}
            style={{ height: '32px', paddingLeft: '0.875rem', paddingRight: '0.875rem', borderRadius: '2rem', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: activeTag === null ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.08)', color: activeTag === null ? '#000' : 'rgba(255,255,255,0.8)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              style={{ height: '32px', paddingLeft: '0.875rem', paddingRight: '0.875rem', borderRadius: '2rem', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: activeTag === tag ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.08)', color: activeTag === tag ? '#000' : 'rgba(255,255,255,0.8)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Feed */}
      <div
        ref={feedRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ scrollSnapType: 'y mandatory', overflowY: 'scroll', height: feedHeight, width: '100%' }}
      >
        {filtered.length === 0 && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
            <p style={{ fontSize: '2.5rem' }}>📷</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', textAlign: 'center' }}>
              {activeTag ? `No uploads tagged #${activeTag} yet.` : 'No uploads yet. Be the first to share!'}
            </p>
            {activeTag && (
              <button
                onClick={() => setActiveTag(null)}
                style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2rem', padding: '0.5rem 1rem', background: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '0.825rem', cursor: 'pointer' }}
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {filtered.map(item => (
          <div
            key={item.id}
            ref={el => attachViewObserver(el, item.id)}
            style={{ scrollSnapAlign: 'start', height: '100dvh', width: '100%', position: 'relative', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {item.type === 'image' ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <Image
                  src={item.url}
                  alt=""
                  fill
                  sizes="100vw"
                  style={{ objectFit: 'contain' }}
                />
              </div>
            ) : (
              <video
                src={item.url}
                controls
                playsInline
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            )}

            {/* Overlay */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4rem 1rem 1.5rem', background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)', pointerEvents: 'none' }}>

              {/* Tappable hashtag pills */}
              {item.hashtags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.625rem', pointerEvents: 'all' }}>
                  {item.hashtags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      style={{ height: '28px', paddingLeft: '0.625rem', paddingRight: '0.625rem', borderRadius: '2rem', border: '1px solid rgba(255,255,255,0.3)', backgroundColor: activeTag === tag ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', color: '#ffffff', fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem', pointerEvents: 'all' }}>
                <div>
                  <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>
                    {item.uploaded_by ?? 'Anonymous'}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.825rem', margin: '0.125rem 0 0' }}>
                    {formatTimeAgo(item.created_at)} · {item.views} views
                  </p>
                </div>

                <button
                  onClick={() => handleShare(item)}
                  style={{ height: '44px', paddingLeft: '1rem', paddingRight: '1rem', borderRadius: '2rem', border: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  {sharedId === item.id ? '✓ Copied' : '↗ Share'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload FAB */}
      <Link
        href={`/e/${slug}/upload`}
        style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', backgroundColor: '#556B2F', color: '#F7E7CE', borderRadius: '2rem', padding: '0.875rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none', zIndex: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
      >
        + Add photos
      </Link>
    </main>
  )
}