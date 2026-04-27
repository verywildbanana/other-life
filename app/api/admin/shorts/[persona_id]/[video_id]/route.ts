import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

function verifyAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  return token === process.env.ADMIN_SECRET_TOKEN
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ persona_id: string; video_id: string }> },
) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { persona_id, video_id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('shorts')
    .delete()
    .eq('persona_id', persona_id)
    .eq('video_id', video_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePath(`/p/${persona_id}`)

  return NextResponse.json({ status: 'ok' })
}
