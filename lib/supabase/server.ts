import { createClient } from '@supabase/supabase-js'

// 서버 전용 — service_role 키로 RLS 우회 (쓰기/삭제)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// 서버 전용 — anon 키 (읽기, RLS 적용)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
