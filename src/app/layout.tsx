import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { ServiceWorkerRegistration } from '@/components/pwa/install-prompt'
import { AppUpdateWatcher } from '@/components/pwa/app-update'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'NowTransformed Back Office',
  description: 'Coach and Administrator portal for NowTransformed',
  applicationName: 'NowTransformed',
  appleWebApp: { capable: true, title: 'NowTransformed', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
        <AppUpdateWatcher />
      </body>
    </html>
  )
}
