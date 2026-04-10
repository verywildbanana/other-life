import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function verifyAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  return token === process.env.ADMIN_SECRET_TOKEN
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ persona_id: string }> },
) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { persona_id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('videos')
    .select('video_id, title, channel, url, score, collected_date, feed_source, titles_i18n')
    .eq('persona_id', persona_id)
    .order('collected_date', { ascending: false })
    .order('score', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ videos: data ?? [] })
}
