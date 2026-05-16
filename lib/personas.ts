import fs from 'fs'
import path from 'path'
import { Persona } from '@/types'
import { createClient } from '@supabase/supabase-js'

// config/personas/ JSON 파일에서 시스템 페르소나 목록 로드
const PERSONAS_DIR = path.join(process.cwd(), 'config', 'personas')

function listSystemPersonas(): Persona[] {
  if (!fs.existsSync(PERSONAS_DIR)) return []

  return fs
    .readdirSync(PERSONAS_DIR)
    .filter((f) => f.endsWith('.json') && !f.includes('training_queue'))
    .map((file) => {
      const raw = fs.readFileSync(path.join(PERSONAS_DIR, file), 'utf-8')
      const data = JSON.parse(raw)
      return {
        id: data.id ?? file.replace('.json', ''),
        name: data.name ?? file.replace('.json', ''),
        description: data.description ?? '',
        name_i18n: data.name_i18n ?? undefined,
        description_i18n: data.description_i18n ?? undefined,
      }
    })
}

/** DB에서 공개 유저 페르소나 목록 조회 */
async function listUserPersonas(): Promise<Persona[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data, error } = await supabase
    .from('user_personas')
    .select('persona_id, name_i18n, description_i18n')
    .eq('is_public', true)
    .eq('is_banned', false)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !data) return []

  return data.map((row) => ({
    id: row.persona_id as string,
    name: (row.name_i18n as Record<string, string>)?.ko ?? row.persona_id,
    description: (row.description_i18n as Record<string, string>)?.ko ?? '',
    name_i18n: row.name_i18n as Record<string, string> | undefined,
    description_i18n: row.description_i18n as Record<string, string> | undefined,
    isUser: true,
  }))
}

/** 시스템 페르소나 동기 목록 (기존 호환성 유지) */
export function listPersonas(): Persona[] {
  return listSystemPersonas()
}

/** 시스템 + DB 유저 페르소나 병합 (async, 새 코드에서 사용) */
export async function listAllPersonas(): Promise<Persona[]> {
  const [system, user] = await Promise.all([
    Promise.resolve(listSystemPersonas()),
    listUserPersonas(),
  ])
  return [...system, ...user]
}

/** 단일 페르소나 조회 (동기, 시스템 전용 — 기존 호환) */
export function loadPersona(id: string): Persona | null {
  if (id.startsWith('u_')) return null  // 유저 페르소나는 loadPersonaAsync 사용
  const personas = listSystemPersonas()
  return personas.find((p) => p.id === id) ?? null
}

/** 단일 페르소나 조회 — 시스템이면 파일에서, 유저면 DB에서 (async) */
export async function loadPersonaAsync(id: string): Promise<Persona | null> {
  if (id.startsWith('u_')) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await supabase
      .from('user_personas')
      .select('persona_id, name_i18n, description_i18n')
      .eq('persona_id', id)
      .eq('is_banned', false)
      .maybeSingle()

    if (!data) return null
    return {
      id: data.persona_id as string,
      name: (data.name_i18n as Record<string, string>)?.ko ?? id,
      description: (data.description_i18n as Record<string, string>)?.ko ?? '',
      name_i18n: data.name_i18n as Record<string, string> | undefined,
      description_i18n: data.description_i18n as Record<string, string> | undefined,
    }
  }
  return loadPersona(id)
}
