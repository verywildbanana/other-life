import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { listPersonas } from '@/lib/personas'

function verifyAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  return token === process.env.ADMIN_SECRET_TOKEN
}

// POST /api/admin/revalidate?persona_id=xxx  (없으면 전체)
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const personaId = searchParams.get('persona_id')

  if (personaId) {
    revalidatePath(`/p/${personaId}`)
    return NextResponse.json({ revalidated: [`/p/${personaId}`] })
  }

  // 전체 페르소나 일괄 무효화
  const personas = listPersonas()
  const paths = personas.map(p => `/p/${p.id}`)
  paths.forEach(path => revalidatePath(path))

  return NextResponse.json({ revalidated: paths })
}
