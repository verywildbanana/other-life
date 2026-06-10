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

// production 아닌 환경(dev 프리뷰, release 프리뷰 등)에서 noindex
const isProduction = process.env.VERCEL_ENV === 'production'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  robots: isProduction
    ? { index: true, follow: true }
    : { index: false, follow: false },
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
    'Peek into other people\'s YouTube feeds and discover what you never knew you were missing. See the world beyond your own algorithm.',
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
    // play.anomess.com 인증 + other-life.vercel.app 인증 (GSC 주소 변경용)
    google: ['-efCTUv6tXM5wHSb8WsTQ6ekRBdwBAKtCVeuK_ZGJxk', 'ARx7X1sVLfQHWKRkaF2bRaxvzfA-8nHXxJpQS4wMTSc'],
  },
  openGraph: {
    type: 'website',
    title: 'Anomess — See the world more than your algorithm',
    description:
      'Peek into other people\'s YouTube feeds and discover what you never knew you were missing. See the world beyond your own algorithm.',
    locale: 'en_US',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Anomess' }],
  },
  twitter: {
    card: 'summary',
    title: 'Anomess — See the world more than your algorithm',
    description: 'Peek into other people\'s YouTube feeds and discover what you never knew you were missing.',
    images: ['/icons/icon-512.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full dark`}>
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
