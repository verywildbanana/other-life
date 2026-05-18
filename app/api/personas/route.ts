import { NextResponse } from 'next/server'
import { listAllPersonas } from '@/lib/personas'

/** GET /api/personas — 시스템 + 공개 유저 페르소나 전체 목록 (캐시 없음) */
export const dynamic = 'force-dynamic'

export async function GET() {
  const personas = await listAllPersonas()
  return NextResponse.json({ personas })
}
