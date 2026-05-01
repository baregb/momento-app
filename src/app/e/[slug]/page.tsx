'use client'

export const dynamic = 'force-dynamic'

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
  batch_id: string | null
}

type FeedCard = {
  id: string
  items: Media[]
  isBatch: boolean
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
  const [carouselIndexes, setCarouselIndexes] = useState<Record<string, number>>({})

  const observerRefs = useRef<Map<string, IntersectionObserver>>(new Map())
  const headerRef = useRef<HTMLElement | null>(null)
  const filterRef = useRef<HTMLDivElement | null>(null)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const touchStartY = useRef(0)
  const touchStartX = useRef(0)

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

  // Group media into feed cards — batched uploads become carousels
  function buildFeedCards(items: Media[]): FeedCard[] {
      const cards: FeedCard[] = []
      const seen = new Set<string>()

      for (const item of items) {
        if (item.batch_id) {
          if (seen.has(item.batch_id)) continue
          seen.add(item.batch_id)
          const batch = items
            .filter(m => m.batch_id === item.batch_id)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          cards.push({ id: item.batch_id, items: batch, isBatch: true })
        } else {
          cards.push({ id: item.id, items: [item], isBatch: false })
        }
      }

      return cards
  }

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

  async function handleShare(card: FeedCard) {
    const first = card.items[0]
    const shareUrl = `${appUrl}/e/${slug}?post=${first.id}`
    const uploadedBy = first.uploaded_by ?? 'Anonymous'
    const shareData = {
      title: event?.title ?? 'Momento',
      text: `Check out this ${card.isBatch ? 'post' : 'photo'} from ${uploadedBy} at ${event?.title}`,
      url: shareUrl,
    }
    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setSharedId(card.id)
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
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    const diffY = e.changedTouches[0].clientY - touchStartY.current
    const atTop = feedRef.current?.scrollTop === 0
    if (diffY > 80 && atTop) handlePullRefresh()
  }

  function handleCarouselSwipe(cardId: string, totalItems: number, e: React.TouchEvent) {
    const diffX = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diffX) < 40) return
    setCarouselIndexes(prev => {
      const current = prev[cardId] ?? 0
      if (diffX > 0) return { ...prev, [cardId]: Math.min(current + 1, totalItems - 1) }
      return { ...prev, [cardId]: Math.max(current - 1, 0) }
    })
  }

  const allTags = Array.from(
    new Set(media.flatMap(m => m.hashtags))
  ).filter(Boolean)

  const filtered = activeTag
    ? media.filter(m => m.hashtags.includes(activeTag))
    : media

  const feedCards = buildFeedCards(filtered)

  if (loading) return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )

  if (!event) return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Event not found.</p>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', width: '100%' }}>

      <header
        ref={headerRef}
        style={{ backgroundColor: 'var(--bg-surface)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem', position: 'sticky', top: 0, zIndex: 10 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '1rem' }}>
              {event.title}
            </p>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.825rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {media.length} {media.length === 1 ? 'photo' : 'photos'}
            </span>
          </div>
          {event.description && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.description}
            </p>
          )}
        </div>
        {refreshing && (
          <div style={{ width: '20px', height: '20px', border: '2px solid var(--border)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        )}
        <ThemeToggle />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </header>

      {/* Hashtag category filter bar */}
      {allTags.length > 0 && (
        <div
          ref={filterRef}
          style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '0.625rem 1rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          <button
            onClick={() => setActiveTag(null)}
            style={{ height: '32px', paddingLeft: '0.875rem', paddingRight: '0.875rem', borderRadius: '2rem', border: '1px solid var(--border)', backgroundColor: activeTag === null ? 'var(--accent)' : 'var(--bg-input)', color: activeTag === null ? '#F7E7CE' : 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              style={{ height: '32px', paddingLeft: '0.875rem', paddingRight: '0.875rem', borderRadius: '2rem', border: '1px solid var(--border)', backgroundColor: activeTag === tag ? 'var(--accent)' : 'var(--bg-input)', color: activeTag === tag ? '#F7E7CE' : 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
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
        {feedCards.length === 0 && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
            <p style={{ fontSize: '2.5rem' }}>📷</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>
              {activeTag ? `No uploads tagged #${activeTag} yet.` : 'No uploads yet. Be the first to share!'}
            </p>
            {activeTag && (
              <button
                onClick={() => setActiveTag(null)}
                style={{ border: '1px solid var(--border)', borderRadius: '2rem', padding: '0.5rem 1rem', background: 'none', color: 'var(--text-muted)', fontSize: '0.825rem', cursor: 'pointer' }}
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {feedCards.map(card => {
          const activeIndex = carouselIndexes[card.id] ?? 0
          const activeItem = card.items[activeIndex]

          return (
            <div
              key={card.id}
              ref={el => attachViewObserver(el, activeItem.id)}
              style={{ scrollSnapAlign: 'start', height: feedHeight, width: '100%', position: 'relative', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}
            >
              {/* Media area — fills available space above the description */}
              <div
                style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
                onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
                onTouchEnd={e => card.isBatch && handleCarouselSwipe(card.id, card.items.length, e)}
              >
                {activeItem.type === 'image' ? (
                  <Image
                    src={activeItem.url}
                    alt=""
                    fill
                    sizes="100vw"
                    style={{ objectFit: 'contain' }}
                  />
                ) : (
                  <video
                    src={activeItem.url}
                    controls
                    playsInline
                    crossOrigin="anonymous"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                )}

                {/* Carousel dots */}
                {card.isBatch && (
                  <div style={{ position: 'absolute', top: '0.75rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '0.375rem' }}>
                    {card.items.map((_, i) => (
                      <div
                        key={i}
                        style={{ width: i === activeIndex ? '16px' : '6px', height: '6px', borderRadius: '999px', backgroundColor: i === activeIndex ? '#ffffff' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s ease' }}
                      />
                    ))}
                  </div>
                )}

                {/* Carousel count badge */}
                {card.isBatch && (
                  <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '999px', padding: '0.25rem 0.625rem', color: '#ffffff', fontSize: '0.775rem', fontWeight: 600 }}>
                    {activeIndex + 1}/{card.items.length}
                  </div>
                )}
              </div>

              {/* Description bar — always visible at the bottom */}
              <div style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border)', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexShrink: 0 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* Tappable hashtag pills */}
                  {activeItem.hashtags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      {activeItem.hashtags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                          style={{ height: '24px', paddingLeft: '0.5rem', paddingRight: '0.5rem', borderRadius: '2rem', border: '1px solid var(--border)', backgroundColor: activeTag === tag ? 'var(--accent)' : 'var(--bg-input)', color: activeTag === tag ? '#F7E7CE' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>
                    {activeItem.uploaded_by ?? 'Anonymous'}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: '0.125rem 0 0' }}>
                    {formatTimeAgo(activeItem.created_at)} · {activeItem.views} views
                  </p>
                </div>

                <button
                  onClick={() => handleShare(card)}
                  style={{ height: '44px', paddingLeft: '1rem', paddingRight: '1rem', borderRadius: '2rem', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  {sharedId === card.id ? '✓ Copied' : '↗ Share'}
                </button>
              </div>
            </div>
          )
        })}
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