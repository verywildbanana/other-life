import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { persona_id, rating, comment, lang } = body

  if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
  }
  if (comment && comment.length > 1000) {
    return NextResponse.json({ error: 'Comment too long' }, { status: 400 })
  }

  const ip = getClientIp(req)
  const salt = process.env.HASH_SALT ?? ''
  const ip_hash = createHash('sha256').update(ip + salt).digest('hex').slice(0, 16)

  const supabase = createServiceClient()

  // Rate Limit: 5분 내 동일 IP 3회 초과 차단
  // Upstash Redis 없이 Supabase DB로 구현 (외부 서비스 추가 불필요)
  const RATE_WINDOW_MS = 5 * 60 * 1000  // 5분
  const RATE_LIMIT = 3                   // 최대 3회
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count: recentCount } = await supabase
    .from('feedbacks')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ip_hash)
    .gte('created_at', since)

  if ((recentCount ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: '잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': '300' } },
    )
  }

  const { error } = await supabase.from('feedbacks').insert({
    persona_id: persona_id ?? null,
    rating: rating ?? null,
    comment: comment?.trim() ?? null,
    lang: lang ?? null,
    ip_hash,
  })

  if (error) {
    console.error('[feedback] insert error:', error.message)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ status: 'ok' })
}
