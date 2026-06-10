import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

// 루트(/) — Accept-Language 헤더로 언어 감지 후 서버사이드 리디렉션
// ko → ?lang=ko, ja → ?lang=ja, 그 외 → ?lang=en
export default async function RootPage() {
  const headersList = await headers()
  const acceptLang = headersList.get('accept-language') ?? ''

  let lang = 'en'
  if (acceptLang.toLowerCase().includes('ko')) lang = 'ko'
  else if (acceptLang.toLowerCase().includes('ja')) lang = 'ja'

  redirect(`/p/wealthy_single_30s?lang=${lang}`)
}
