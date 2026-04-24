import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const GA_ID = 'G-JNHYK6SN57'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const BASE_URL = 'https://other-life.vercel.app'

export const metadata: Metadata = {
  title: 'Persona Feed — YouTube 알고리즘 시뮬레이터',
  description:
    '페르소나 기반 YouTube 피드 시뮬레이터. 다양한 관심사를 가진 페르소나가 실제로 어떤 영상을 추천받는지 확인하세요.',
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
    title: 'Persona Feed — YouTube 알고리즘 시뮬레이터',
    description:
      '페르소나 기반 YouTube 피드 시뮬레이터. 다양한 관심사를 가진 페르소나가 실제로 어떤 영상을 추천받는지 확인하세요.',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary',
    title: 'Persona Feed',
    description: 'YouTube 알고리즘 페르소나 시뮬레이터',
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
      </head>
      <body className="min-h-full bg-zinc-950 text-zinc-100 font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
