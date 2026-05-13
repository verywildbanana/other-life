import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import InstallPrompt from '@/components/InstallPrompt'
import './globals.css'

const GA_ID = 'G-JNHYK6SN57'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const BASE_URL = 'https://play.anomess.com'

export const metadata: Metadata = {
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Anomess',
  },
  title: 'Anomess — See the world more than your algorithm',
  description:
    '알고리즘 밖의 세상을 보세요. 나와 다른 사람들이 보는 유튜브 피드를 엿보며, 내가 몰랐던 취향과 더 넓은 세상을 직접 발견하세요.',
  alternates: {
    canonical: BASE_URL,
    languages: {
      'ko': `${BASE_URL}/p/wealthy_single_30s`,
      'en': `${BASE_URL}/p/wealthy_single_30s`,
      'ja': `${BASE_URL}/p/wealthy_single_30s`,
      'x-default': `${BASE_URL}/p/wealthy_single_30s`,
    },
  },
  verification: {
    google: 'ARx7X1sVLfQHWKRkaF2bRaxvzfA-8nHXxJpQS4wMTSc',
  },
  openGraph: {
    type: 'website',
    title: 'Anomess — See the world more than your algorithm',
    description:
      '알고리즘 밖의 세상을 보세요. 나와 다른 사람들이 보는 유튜브 피드를 엿보며, 내가 몰랐던 취향과 더 넓은 세상을 직접 발견하세요.',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary',
    title: 'Anomess — See the world more than your algorithm',
    description: '알고리즘 밖의 세상을 보세요. 다른 사람의 유튜브 피드를 엿보며 더 넓은 세상을 발견하세요.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={`${geist.variable} h-full dark`}>
      <head>
        {/* PWA */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#09090b" />
        {/* Google Analytics 4 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
        {/* Service Worker 등록 (PWA 홈 화면 추가 활성화) */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            }
          `}
        </Script>
      </head>
      <body className="min-h-full bg-zinc-950 text-zinc-100 font-sans antialiased">
        {children}
        <InstallPrompt />
      </body>
    </html>
  )
}
