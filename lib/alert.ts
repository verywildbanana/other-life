/**
 * alert.ts — Telegram 알림 전송
 *
 * ALERT_BOT_TOKEN, ALERT_CHAT_ID 환경변수 필요
 * Edge Runtime 호환 (fetch 사용)
 */

const BOT_TOKEN = process.env.ALERT_BOT_TOKEN
const CHAT_ID = process.env.ALERT_CHAT_ID

/** Telegram으로 알림 전송. 실패해도 서비스 영향 없게 에러를 삼킴 */
export async function sendAlert(message: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    })
  } catch {
    // 알림 실패가 서비스 응답을 막으면 안 됨 → 에러 무시
  }
}
