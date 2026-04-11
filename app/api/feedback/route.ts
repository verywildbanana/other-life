import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate Limit: IP당 5회/10분 (스팸 방지)
  const ip = getClientIp(req)
  const rl = checkRateLimit(ip, 5, 600)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { persona_id, rating, comment, lang } = body

  if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
  }
  if (comment && comment.length > 1000) {
    return NextResponse.json({ error: 'Comment too long' }, { status: 400 })
  }

  // IP 단방향 해시 (개인정보 보호)
  const salt = process.env.HASH_SALT ?? ''
  const ip_hash = createHash('sha256').update(ip + salt).digest('hex').slice(0, 16)

  const supabase = createServiceClient()
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
