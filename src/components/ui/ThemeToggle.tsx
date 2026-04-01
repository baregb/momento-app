'use client'

import { useTheme } from '@/lib/theme-context'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-input)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.125rem',
        flexShrink: 0,
      }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}