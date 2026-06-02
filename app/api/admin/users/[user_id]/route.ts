import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function verifyAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  return token === process.env.ADMIN_SECRET_TOKEN
}

/** POST /api/admin/users/[user_id] — ban | unban */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user_id } = await params
  const { action } = await req.json() as { action: 'ban' | 'unban' }

  if (action !== 'ban' && action !== 'unban') {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const isBanning = action === 'ban'

  // user_profiles upsert — is_banned 설정
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id, is_banned: isBanning },
      { onConflict: 'user_id' }
    )

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // ban 시 기존 세션 강제 만료
  if (isBanning) {
    await supabase.auth.admin.signOut(user_id)
  }

  return NextResponse.json({ ok: true, is_banned: isBanning })
}
