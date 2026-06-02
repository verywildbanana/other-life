import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function verifyAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  return token === process.env.ADMIN_SECRET_TOKEN
}

export type AdminUserPersona = {
  persona_id: string
  name: string
  video_count: number
  is_public: boolean
  days_since_update: number
  is_inactive: boolean
}

export type AdminUser = {
  id: string
  email: string
  nickname: string | null
  is_banned: boolean
  created_at: string
  last_sign_in_at: string | null
  personas: AdminUserPersona[]
}

/** GET /api/admin/users — 가입 유저 목록 + 페르소나 */
export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // 1. Supabase Auth 유저 전체 수집 (pagination 처리)
  const authUsers: { id: string; email: string; created_at: string; last_sign_in_at: string | null }[] = []
  let page = 1
  const perPage = 100
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error || !data?.users?.length) break
    for (const u of data.users) {
      authUsers.push({
        id: u.id,
        email: u.email ?? '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      })
    }
    if (data.users.length < perPage) break
    page++
  }

  const userIds = authUsers.map(u => u.id)
  if (userIds.length === 0) return NextResponse.json({ users: [] })

  // 2. user_profiles — nickname, is_banned
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, nickname, is_banned')
    .in('user_id', userIds)

  const profileMap: Record<string, { nickname: string | null; is_banned: boolean }> = {}
  for (const p of profiles ?? []) {
    profileMap[p.user_id] = { nickname: p.nickname ?? null, is_banned: p.is_banned ?? false }
  }

  // 3. user_personas — 유저별 페르소나 목록
  const { data: personas } = await supabase
    .from('user_personas')
    .select('persona_id, user_id, name_i18n, video_count, is_public, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })

  // 4. user_videos 최신 created_at — is_inactive 판정용
  const personaIds = (personas ?? []).map(p => p.persona_id as string)
  const { data: latestVideos } = personaIds.length > 0
    ? await supabase
        .from('user_videos')
        .select('persona_id, created_at')
        .in('persona_id', personaIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const latestMap: Record<string, string> = {}
  for (const v of latestVideos ?? []) {
    const pid = v.persona_id as string
    if (!latestMap[pid]) latestMap[pid] = v.created_at as string
  }

  // 5. 유저별 페르소나 그룹핑
  const now = Date.now()
  const WEEK_MS = 7 * 24 * 3600 * 1000
  const personasByUser: Record<string, AdminUserPersona[]> = {}
  for (const p of personas ?? []) {
    const uid = p.user_id as string
    const lastUpdate = latestMap[p.persona_id as string] ?? (p.created_at as string)
    const daysSince = Math.floor((now - new Date(lastUpdate).getTime()) / 86400_000)
    const entry: AdminUserPersona = {
      persona_id: p.persona_id as string,
      name: (p.name_i18n as Record<string, string>)?.ko ?? p.persona_id,
      video_count: (p.video_count as number) ?? 0,
      is_public: p.is_public as boolean ?? true,
      days_since_update: daysSince,
      is_inactive: now - new Date(lastUpdate).getTime() > WEEK_MS,
    }
    if (!personasByUser[uid]) personasByUser[uid] = []
    personasByUser[uid].push(entry)
  }

  // 6. 최종 조합 — 가입일 역순
  const users: AdminUser[] = authUsers
    .map(u => ({
      id: u.id,
      email: u.email,
      nickname: profileMap[u.id]?.nickname ?? null,
      is_banned: profileMap[u.id]?.is_banned ?? false,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      personas: personasByUser[u.id] ?? [],
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ users })
}
