import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').substring(0, 16)
}

/**
 * Admin 페이지 / API 접근 로깅 — fire-and-forget (응답 지연 없음)
 */
export function logAdminAccess(req: NextRequest): void {
  const ua = req.headers.get('user-agent') ?? ''

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  const row = {
    ip_hash: hashIp(ip),
    path: req.nextUrl.pathname,
    method: req.method,
    user_agent: ua.substring(0, 200),
    referer: (req.headers.get('referer') ?? '').substring(0, 200),
    country: req.headers.get('x-vercel-ip-country') ?? null,
  }

  getServiceClient()
    .from('admin_logs')
    .insert(row)
    .then(({ error }) => {
      if (error) console.error('[admin-log] insert error:', error.message)
    })
}
