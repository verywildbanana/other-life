import fs from 'fs'
import path from 'path'
import { Persona } from '@/types'

// config/personas/ JSON 파일에서 페르소나 목록 로드
const PERSONAS_DIR = path.join(process.cwd(), 'config', 'personas')

export function listPersonas(): Persona[] {
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

export function loadPersona(id: string): Persona | null {
  const personas = listPersonas()
  return personas.find((p) => p.id === id) ?? null
}
