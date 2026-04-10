import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Persona Feed — YouTube 알고리즘 시뮬레이터',
  description:
    '페르소나 기반 YouTube 피드 시뮬레이터. 다양한 관심사를 가진 페르소나가 실제로 어떤 영상을 추천받는지 확인하세요.',
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
    <html lang="ko" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-zinc-950 text-zinc-100 font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
