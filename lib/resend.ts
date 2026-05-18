import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')
  return new Resend(process.env.RESEND_API_KEY)
}
const FROM = 'Anomess <noreply@anomess.com>'

/** 유저 페르소나 오너 이메일 조회 (service role 필요) */
async function getOwnerEmail(supabase: SupabaseClient, personaId: string): Promise<{ email: string; personaName: string } | null> {
  const { data: persona } = await supabase
    .from('user_personas')
    .select('user_id, name_i18n')
    .eq('persona_id', personaId)
    .maybeSingle()

  if (!persona) return null

  const { data: userData } = await supabase.auth.admin.getUserById(persona.user_id)
  const email = userData?.user?.email
  if (!email) return null

  const name = (persona.name_i18n as Record<string, string>)?.ko ?? personaId
  return { email, personaName: name }
}

/** 유저 페르소나 피드백 알림 */
export async function sendFeedbackNotification({
  personaId,
  suggestion,
  lang,
  supabase,
}: {
  personaId: string
  suggestion: string
  lang: string
  supabase: SupabaseClient
}) {
  const owner = await getOwnerEmail(supabase, personaId)
  if (!owner) return

  const subject: Record<string, string> = {
    ko: `[Anomess] "${owner.personaName}" 피드에 새 피드백이 도착했습니다`,
    en: `[Anomess] New feedback on your feed "${owner.personaName}"`,
    ja: `[Anomess] フィード「${owner.personaName}」に新しいフィードバックが届きました`,
  }

  await getResend().emails.send({
    from: FROM,
    to: owner.email,
    subject: subject[lang] ?? subject.ko,
    text: `피드백 내용:\n${suggestion}\n\n---\n이 이메일은 Anomess에서 자동 발송되었습니다.\n문의: verywildbanana@gmail.com`,
  })
}

/** 비활성 페르소나 경고 이메일 */
export async function sendInactivePersonaWarning({
  toEmail,
  personaName,
  personaId,
  daysSinceUpdate,
}: {
  toEmail: string
  personaName: string
  personaId: string
  daysSinceUpdate: number
}) {
  await getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: `[Anomess] "${personaName}" 피드에 업데이트가 없습니다`,
    text: `안녕하세요,

Anomess에서 생성하신 "${personaName}" 피드가 ${daysSinceUpdate}일째 업데이트(영상 추가)가 없습니다.

7일 이상 업데이트가 없는 피드는 운영 검토 대상이 됩니다.
영상을 추가해 피드를 활성 상태로 유지해주세요.

피드 관리: https://feed.anomess.com/my/personas

---
이 이메일은 Anomess에서 자동 발송되었습니다.
문의: verywildbanana@gmail.com`,
  })
}
