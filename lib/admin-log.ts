import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

// Edge Runtime 호환 — Node.js crypto 대신 Web Crypto API 사용
async function hashIp(ip: string): Promise<string> {
  const encoded = new TextEncoder().encode(ip)
  const buf = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16)
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Admin 페이지 / API 접근 로깅 — fire-and-forget (응답 지연 없음)
 */
export function logAdminAccess(req: NextRequest): void {
  const ua = req.headers.get('user-agent') ?? ''

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  // async hash → fire-and-forget
  hashIp(ip).then(ip_hash => {
    const row = {
      ip_hash,
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
  })
}
