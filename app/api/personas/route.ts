import { NextResponse } from 'next/server'
import { listPersonas } from '@/lib/personas'

export async function GET() {
  return NextResponse.json({ personas: listPersonas() })
}
