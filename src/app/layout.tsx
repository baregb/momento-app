import type { Metadata } from 'next'
import { Urbanist } from 'next/font/google'
import { ThemeProvider } from '@/lib/theme-context'
import './globals.css'

const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-urbanist',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Momento',
  description: 'Share event memories together',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${urbanist.variable}`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}