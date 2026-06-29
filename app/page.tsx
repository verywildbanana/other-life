import { headers } from 'next/headers'
import { listAllPersonas } from '@/lib/personas'
import PersonaGrid from '@/components/PersonaGrid'

type Lang = 'ko' | 'en' | 'ja'

function detectLang(acceptLang: string): Lang {
  const l = acceptLang.toLowerCase()
  if (l.includes('ko')) return 'ko'
  if (l.includes('ja')) return 'ja'
  return 'en'
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const headersList = await headers()
  const params = await searchParams
  const lang: Lang =
    (params.lang as Lang) ??
    detectLang(headersList.get('accept-language') ?? '')

  const personas = await listAllPersonas()

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* 헤더 */}
      <header className="w-full px-4 py-3 flex items-center border-b border-zinc-800 bg-zinc-950 sticky top-0 z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/anomess-logo.png"
          alt="Anomess"
          className="h-[66px] w-auto rounded-xl"
        />
      </header>

      {/* 포털 그리드 */}
      <main className="px-3 py-3 max-w-4xl mx-auto">
        <PersonaGrid personas={personas} lang={lang} />
      </main>
    </div>
  )
}
