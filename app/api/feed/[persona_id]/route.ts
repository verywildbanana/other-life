import { NextRequest, NextResponse } from 'next/server'
import { getFeedByPersona } from '@/lib/feed'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ persona_id: string }> },
) {
  const { persona_id } = await params
  const feed = await getFeedByPersona(persona_id)

  if (!feed) {
    return NextResponse.json({ error: '피드 없음' }, { status: 404 })
  }

  return NextResponse.json(feed)
}
