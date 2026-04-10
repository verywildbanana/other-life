import { redirect } from 'next/navigation'
import { listPersonas } from '@/lib/personas'

// 루트(/) 접속 시 첫 번째 페르소나 피드 페이지로 리다이렉트
// 실제 콘텐츠는 /p/[persona_id] SSR 페이지에서 렌더링 (크롤러 SEO 적용)
export default function RootPage() {
  const personas = listPersonas()
  const first = personas[0]?.id ?? 'wealthy_single_30s'
  redirect(`/p/${first}`)
}
