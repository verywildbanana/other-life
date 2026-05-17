'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import Image from 'next/image'
import { FeedPageResponse, Video, Persona } from '@/types'
import { markViewed, getViewedSet } from '@/lib/viewedTracker'
import { useEventQueue } from '@/lib/useEventQueue'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import CookieBanner from '@/components/CookieBanner'

// ── 페이지 전환 Progress Bar ───────────────────────────────────────────────────
function NavigationProgress({ active }: { active: boolean }) {
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (active) {
      setVisible(true)
      setWidth(15)
      const t1 = setTimeout(() => setWidth(50), 200)
      const t2 = setTimeout(() => setWidth(75), 600)
      const t3 = setTimeout(() => setWidth(90), 1500)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    } else {
      // 완료: 100%로 채운 뒤 페이드아웃
      setWidth(100)
      const t = setTimeout(() => { setVisible(false); setWidth(0) }, 300)
      return () => clearTimeout(t)
    }
  }, [active])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-zinc-800">
      <div
        className="h-full bg-zinc-100 transition-all ease-out"
        style={{
          width: `${width}%`,
          transitionDuration: width === 100 ? '200ms' : width === 15 ? '150ms' : '600ms',
        }}
      />
    </div>
  )
}

// ── Share 버튼 ────────────────────────────────────────────────────────────────
function ShareButton({ lang, personaId }: { lang: Lang; personaId: string }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = `${window.location.origin}/p/${personaId}?lang=${lang}`
    const title = { ko: 'Anomess 피드', en: 'Anomess Feed', ja: 'Anomessフィード' }[lang]
    const text  = { ko: '이 피드를 확인해보세요!', en: 'Check out this feed!', ja: 'このフィードをチェックしてみてください！' }[lang]

    if (navigator.share) {
      try { await navigator.share({ title, text, url }) } catch { /* 취소 무시 */ }
      return
    }
    // 폴백: 클립보드 복사
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* 무시 */ }
  }

  const ariaLabel = { ko: copied ? '복사됨!' : '공유', en: copied ? 'Copied!' : 'Share', ja: copied ? 'コピー済み' : '共有' }[lang]

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={ariaLabel}
      className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${
        copied
          ? 'border-emerald-700 text-emerald-400 bg-emerald-900/20'
          : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
      }`}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
          <path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      )}
    </button>
  )
}

// ── Terms 버전 상수 — 약관 변경 시 이 숫자를 올리면 기존 유저에게 재동의 요청 ──────
const CURRENT_TERMS_VERSION = 1

// ── 약관 내용 ─────────────────────────────────────────────────────────────────
const TERMS_CONTENT: Record<Lang, string> = {
  ko: `이용약관

최종 업데이트: 2025년 5월

1. 서비스 개요
Anomess는 YouTube 알고리즘 시뮬레이터 서비스입니다. 유저는 개인 피드 페르소나를 만들고 YouTube 영상 링크를 추가할 수 있습니다.

2. 콘텐츠 정책
다음 유형의 콘텐츠는 업로드 금지입니다:
• 혐오 발언, 차별적 표현, 폭력·성적 콘텐츠
• 허위 정보, 사기, 스팸성 콘텐츠
• 타인의 저작권을 침해하는 콘텐츠
• 불법적 활동을 조장하거나 묘사하는 콘텐츠

위반 콘텐츠는 사전 통보 없이 삭제될 수 있으며, 반복 위반 시 계정이 제한될 수 있습니다.

3. 비활성 계정
6개월 이상 활동이 없는 유저 페르소나는 삭제 예정 30일 전에 이메일 알림을 발송합니다.
알림 후 30일 내 응답이 없으면 해당 페르소나와 영상 데이터가 삭제됩니다.

4. 서비스 변경 및 중단
운영 여건에 따라 서비스 내용을 변경하거나 중단할 수 있습니다.
중요한 변경은 사전에 이메일 또는 서비스 내 공지로 안내합니다.

5. 면책 조항
Anomess는 유저가 추가한 콘텐츠에 대해 책임지지 않습니다.
서비스 이용으로 인한 직·간접 손해에 대해 법적 책임을 지지 않습니다.

6. 약관 변경
약관이 변경될 경우 서비스 로그인 시 재동의를 요청합니다.
변경된 약관에 동의하지 않으면 서비스 이용이 제한될 수 있습니다.

이 약관에 동의하면 위 내용을 이해하고 수락한 것으로 간주합니다.`,

  en: `Terms of Service

Last updated: May 2025

1. Service Overview
Anomess is a YouTube algorithm simulator. Users can create personal feed personas and add YouTube video links.

2. Content Policy
The following types of content are prohibited:
• Hate speech, discriminatory expressions, violent or sexual content
• Misinformation, fraud, or spam content
• Content that infringes on others' copyrights
• Content that promotes or depicts illegal activities

Violating content may be removed without prior notice, and repeated violations may result in account restrictions.

3. Inactive Accounts
User personas inactive for 6 months or more will receive an email notification 30 days before scheduled deletion.
If there is no response within 30 days of notification, the persona and video data will be deleted.

4. Service Changes and Termination
We may modify or discontinue the service based on operational conditions.
Important changes will be communicated in advance via email or in-service notice.

5. Disclaimer
Anomess is not responsible for content added by users.
We are not legally liable for direct or indirect damages resulting from use of the service.

6. Changes to Terms
If the terms change, we will request re-agreement upon login.
Failure to agree to updated terms may result in restricted access to the service.

By agreeing to these terms, you acknowledge that you have read and accepted the above.`,

  ja: `利用規約

最終更新：2025年5月

1. サービス概要
AnolessはYouTubeアルゴリズムシミュレーターサービスです。ユーザーは個人フィードペルソナを作成し、YouTube動画リンクを追加できます。

2. コンテンツポリシー
以下の種類のコンテンツはアップロード禁止です：
• ヘイトスピーチ、差別的表現、暴力的・性的コンテンツ
• 虚偽情報、詐欺、スパムコンテンツ
• 他者の著作権を侵害するコンテンツ
• 違法行為を助長または描写するコンテンツ

違反コンテンツは事前通知なく削除される場合があり、繰り返し違反するとアカウントが制限される場合があります。

3. 非アクティブアカウント
6ヶ月以上活動のないユーザーペルソナは、削除予定の30日前にメール通知を送信します。
通知後30日以内に応答がない場合、該当ペルソナと動画データが削除されます。

4. サービスの変更・終了
運営状況に応じてサービス内容を変更または終了する場合があります。
重要な変更は事前にメールまたはサービス内通知でお知らせします。

5. 免責事項
Anomessはユーザーが追加したコンテンツについて責任を負いません。
サービス利用による直接・間接的な損害について法的責任を負いません。

6. 規約の変更
規約が変更された場合、ログイン時に再同意をお願いします。
変更された規約に同意しない場合、サービスの利用が制限される場合があります。

この規約に同意することで、上記内容を理解し承諾したものとみなします。`,
}

// ── 약관 동의 모달 ──────────────────────────────────────────────────────────────
function TermsModal({ lang, onAgree }: { lang: Lang; onAgree: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [activeLang, setActiveLang] = useState<Lang>(lang)
  const [agreeing, setAgreeing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 40) setScrolled(true)
  }

  const labels = {
    title:   { ko: '이용약관', en: 'Terms of Service', ja: '利用規約' }[lang],
    scroll:  { ko: '약관을 끝까지 읽어주세요', en: 'Please read to the end', ja: '最後までお読みください' }[lang],
    agree:   { ko: '동의하고 계속하기', en: 'Agree & Continue', ja: '同意して続ける' }[lang],
    agreeIng: { ko: '처리 중...', en: 'Processing...', ja: '処理中...' }[lang],
  }

  async function handleAgree() {
    setAgreeing(true)
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terms_version: CURRENT_TERMS_VERSION }),
      })
      onAgree()
    } catch {
      setAgreeing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 px-4 pb-4 sm:pb-0">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold">{labels.title}</h2>
          <div className="flex gap-1">
            {(['ko', 'en', 'ja'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => {
                  setActiveLang(l)
                  if (contentRef.current) contentRef.current.scrollTop = 0
                  setScrolled(false)
                }}
                className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                  activeLang === l ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* 약관 본문 */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-5 py-4 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {TERMS_CONTENT[activeLang]}
        </div>

        {/* 하단 */}
        <div className="px-5 pb-5 pt-3 border-t border-zinc-800">
          {!scrolled && (
            <p className="text-[11px] text-zinc-500 text-center mb-2">{labels.scroll}</p>
          )}
          <button
            onClick={handleAgree}
            disabled={!scrolled || agreeing}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {agreeing ? labels.agreeIng : labels.agree}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 피드백 모달 컴포넌트 ──────────────────────────────────────────────────────
interface FeedbackModalProps {
  lang: Lang
  personaId: string
  personaName: string
  onClose: () => void
}

const FEEDBACK_LABELS = {
  title: { ko: '이 피드, 어떠셨나요?', en: 'How was this feed?', ja: 'このフィードはいかがでしたか？' },
  suggestionLabel: {
    ko: (name: string) => `${name}에게 추천하는 유튜브 링크를 알려주세요.`,
    en: (name: string) => `Share a YouTube link you'd recommend for ${name}.`,
    ja: (name: string) => `${name}に勧めたいYouTubeリンクを教えてください。`,
  },
  suggestionPlaceholder: { ko: '예) 20대 직장인 남성, 게임과 테크에 관심 많은...', en: 'e.g. A 20s male office worker into gaming and tech...', ja: '例）20代の会社員男性、ゲームやテクノロジーに興味がある...' },
  submit: { ko: '의견 보내기', en: 'Submit', ja: '送信' },
  submitting: { ko: '보내는 중...', en: 'Submitting...', ja: '送信中...' },
  thanks: { ko: '감사합니다! 더 현실감 있는 피드를 만드는 데 반영됩니다.', en: 'Thank you! Your input helps make the feed more realistic.', ja: 'ありがとうございます！よりリアルなフィードに活かされます。' },
  close: { ko: '닫기', en: 'Close', ja: '閉じる' },
}

function FeedbackModal({ lang, personaId, personaName, onClose }: FeedbackModalProps) {
  const [suggestion, setSuggestion] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')

  const isEmpty = suggestion.trim() === ''

  async function handleSubmit() {
    if (isEmpty) return
    setStatus('submitting')
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: personaId, content_suggestion: suggestion.trim() || null, lang }),
      })
      setStatus('done')
      setTimeout(onClose, 2500)
    } catch {
      setStatus('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        {status === 'done' ? (
          <p className="text-center text-sm text-emerald-400 py-4">{FEEDBACK_LABELS.thanks[lang]}</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">{FEEDBACK_LABELS.title[lang]}</h3>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">×</button>
            </div>

            {/* 페르소나 제안 */}
            <p className="text-xs text-zinc-400 mb-2">{FEEDBACK_LABELS.suggestionLabel[lang](personaName)}</p>
            <textarea
              value={suggestion}
              onChange={e => setSuggestion(e.target.value)}
              placeholder={FEEDBACK_LABELS.suggestionPlaceholder[lang]}
              maxLength={300}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500 mb-4"
            />

            <button
              onClick={handleSubmit}
              disabled={isEmpty || status === 'submitting'}
              className="w-full bg-zinc-100 text-zinc-900 font-medium py-2 rounded-lg text-sm hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === 'submitting' ? FEEDBACK_LABELS.submitting[lang] : FEEDBACK_LABELS.submit[lang]}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── 영상 추가 모달 ─────────────────────────────────────────────────────────────
interface AddVideoModalProps {
  lang: Lang
  personaId: string
  onClose: () => void
  onAdded: (video: { video_id: string; title: string; channel: string; thumbnail_url: string; added_at: string; db_id: number; user_intro: Record<string, string> | null; titles_i18n: Record<string, string> }) => void
}

function AddVideoModal({ lang, personaId, onClose, onAdded }: AddVideoModalProps) {
  const [url, setUrl] = useState('')
  // 타이틀 ko/en/ja
  const [titleKo, setTitleKo] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [titleJa, setTitleJa] = useState('')
  // 소개글 ko/en/ja
  const [introKo, setIntroKo] = useState('')
  const [introEn, setIntroEn] = useState('')
  const [introJa, setIntroJa] = useState('')
  const [preview, setPreview] = useState<{ video_id: string; title: string; channel: string; thumbnail_url: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'previewing' | 'adding' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  // YouTube video ID 추출 (클라이언트)
  function extractVideoId(input: string): string | null {
    const patterns = [
      /(?:v=|\/embed\/|youtu\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/,
      /^([A-Za-z0-9_-]{11})$/,
    ]
    for (const p of patterns) {
      const m = input.trim().match(p)
      if (m?.[1]) return m[1]
    }
    return null
  }

  async function handlePreview() {
    setError(null)
    const videoId = extractVideoId(url)
    if (!videoId) { setError({ ko: '유효한 YouTube URL이 아닙니다.', en: 'Invalid YouTube URL.', ja: '無効なYouTube URLです。' }[lang]); return }
    setStatus('previewing')
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      if (!res.ok) throw new Error()
      const data = await res.json() as { title: string; author_name: string; thumbnail_url: string }
      const p = {
        video_id: videoId,
        title: data.title,
        channel: data.author_name,
        thumbnail_url: data.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      }
      setPreview(p)
      // 타이틀 필드가 비어있으면 원본 제목으로 초기화
      setTitleKo(v => v || p.title)
      setTitleEn(v => v || p.title)
      setTitleJa(v => v || p.title)
    } catch {
      setError({ ko: '영상 정보를 가져올 수 없습니다. 공개된 영상인지 확인해주세요.', en: 'Could not fetch video info. Make sure it\'s a public video.', ja: '動画情報を取得できません。公開動画か確認してください。' }[lang])
    } finally {
      setStatus('idle')
    }
  }

  async function handleAdd() {
    if (!preview) return
    setStatus('adding')
    setError(null)
    try {
      const titlesI18n = { ko: titleKo.trim() || preview.title, en: titleEn.trim() || preview.title, ja: titleJa.trim() || preview.title }
      const userIntro = (introKo.trim() || introEn.trim() || introJa.trim())
        ? { ko: introKo.trim(), en: introEn.trim(), ja: introJa.trim() }
        : null
      const res = await fetch('/api/user/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona_id: personaId,
          url: `https://www.youtube.com/watch?v=${preview.video_id}`,
          titles_i18n: titlesI18n,
          user_intro: userIntro,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'error')
      setStatus('done')
      setTimeout(() => {
        onAdded({
          ...preview,
          added_at: new Date().toISOString(),
          db_id: data.video?.id ?? 0,
          user_intro: userIntro,
          titles_i18n: titlesI18n,
        })
        onClose()
      }, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error')
      setStatus('idle')
    }
  }

  const labels = {
    title: { ko: 'YouTube 영상 추가', en: 'Add YouTube Video', ja: 'YouTube動画を追加' }[lang],
    urlPlaceholder: { ko: 'YouTube URL 또는 영상 ID', en: 'YouTube URL or video ID', ja: 'YouTube URLまたは動画ID' }[lang],
    previewBtn: { ko: '미리보기', en: 'Preview', ja: 'プレビュー' }[lang],
    addBtn: { ko: '추가하기', en: 'Add', ja: '追加する' }[lang],
    adding: { ko: '추가 중...', en: 'Adding...', ja: '追加中...' }[lang],
    done: { ko: '추가 완료!', en: 'Added!', ja: '追加しました！' }[lang],
    titleLabel: { ko: '타이틀', en: 'Title', ja: 'タイトル' }[lang],
    introLabel: { ko: '소개 글 (선택)', en: 'Intro text (optional)', ja: '紹介文（任意）' }[lang],
    introPlaceholder: { ko: '이 영상을 추천하는 이유', en: 'Why do you recommend this?', ja: 'おすすめの理由' }[lang],
    cancel: { ko: '취소', en: 'Cancel', ja: 'キャンセル' }[lang],
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{labels.title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">×</button>
        </div>

        {status === 'done' ? (
          <p className="text-center text-emerald-400 text-sm py-4">{labels.done}</p>
        ) : (
          <>
            {/* URL 입력 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={e => { setUrl(e.target.value); setPreview(null); setError(null) }}
                onKeyDown={e => e.key === 'Enter' && handlePreview()}
                placeholder={labels.urlPlaceholder}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <button
                onClick={handlePreview}
                disabled={!url.trim() || status === 'previewing'}
                className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-sm rounded-lg transition-colors shrink-0"
              >
                {status === 'previewing' ? (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : labels.previewBtn}
              </button>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            {/* 미리보기 카드 */}
            {preview && (
              <div className="flex gap-3 bg-zinc-800 rounded-xl p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.thumbnail_url} alt="" className="w-24 h-[54px] rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white line-clamp-2 leading-snug">{preview.title}</p>
                  <p className="text-[11px] text-zinc-400 mt-1 truncate">{preview.channel}</p>
                </div>
              </div>
            )}

            {/* 타이틀 + 소개글 (미리보기 확인 후) */}
            {preview && (
              <div className="space-y-3">
                {/* 번역기 버튼 */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => window.open('https://translate.google.com/', '_blank', 'width=700,height=520,noopener')}
                    className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    {{ ko: '번역기 열기', en: 'Open Translator', ja: '翻訳ツールを開く' }[lang]}
                  </button>
                </div>

                {/* 타이틀 KO/EN/JA */}
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400">{labels.titleLabel}</label>
                  {([
                    { lbl: 'KO', val: titleKo, set: setTitleKo },
                    { lbl: 'EN', val: titleEn, set: setTitleEn },
                    { lbl: 'JA', val: titleJa, set: setTitleJa },
                  ] as const).map(({ lbl, val, set }) => (
                    <div key={lbl} className="flex gap-2 items-center">
                      <span className="text-[11px] text-zinc-500 w-5">{lbl}</span>
                      <input
                        value={val}
                        onChange={e => set(e.target.value)}
                        maxLength={120}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                      />
                    </div>
                  ))}
                </div>

                {/* 소개글 KO/EN/JA */}
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400">{labels.introLabel}</label>
                  {([
                    { lbl: 'KO', val: introKo, set: setIntroKo },
                    { lbl: 'EN', val: introEn, set: setIntroEn },
                    { lbl: 'JA', val: introJa, set: setIntroJa },
                  ] as const).map(({ lbl, val, set }) => (
                    <div key={lbl} className="flex gap-2 items-start">
                      <span className="text-[11px] text-zinc-500 w-5 pt-1.5">{lbl}</span>
                      <textarea
                        value={val}
                        onChange={e => set(e.target.value)}
                        placeholder={labels.introPlaceholder}
                        maxLength={200}
                        rows={2}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:border-zinc-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
              >
                {labels.cancel}
              </button>
              {preview && (
                <button
                  onClick={handleAdd}
                  disabled={status === 'adding'}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {status === 'adding' ? labels.adding : labels.addBtn}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

type Lang = 'ko' | 'en' | 'ja'

// ── 페르소나 바텀시트 ──────────────────────────────────────────────────────────
interface PersonaSheetProps {
  personas: import('@/types').Persona[]
  currentId: string
  lang: Lang
  myPersonaIds: Set<string>
  onSelect: (id: string) => void
  onClose: () => void
}

function PersonaBottomSheet({ personas, currentId, lang, myPersonaIds, onSelect, onClose }: PersonaSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const [hasScrollBelow, setHasScrollBelow] = useState(true)

  // 스크롤 여부 감지 — 하단에 더 내용이 있으면 마스크 표시
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const check = () => {
      setHasScrollBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    return () => el.removeEventListener('scroll', check)
  }, [])

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // 마운트 직후 바로 등록하면 열린 클릭이 바깥 클릭으로 판정됨 → 1 tick 지연
    const id = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handleClick) }
  }, [onClose])

  // ESC 닫기
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/60" />

      {/* 시트 */}
      <div
        ref={sheetRef}
        className="relative w-full sm:max-w-xs bg-zinc-900 rounded-t-2xl sm:rounded-2xl
                   border border-zinc-700 shadow-2xl
                   max-h-[60vh] flex flex-col overflow-hidden
                   animate-in slide-in-from-bottom-4 duration-200"
      >
        {/* 핸들 바 (모바일) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-zinc-600" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {{ ko: '누구의 피드를 볼까요?', en: 'Whose feed are you exploring?', ja: '誰のフィードを見ますか？' }[lang]}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="닫기"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 목록 */}
        <div
          ref={listRef}
          className="overflow-y-auto flex-1 py-1"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {(() => {
            const myPersonas        = personas.filter(p => myPersonaIds.has(p.id))
            const systemPersonas    = personas.filter(p => !p.id.startsWith('u_'))
            const communityPersonas = personas.filter(p => p.id.startsWith('u_') && !myPersonaIds.has(p.id))

            const labels = {
              my:        { ko: '내 피드',   en: 'My Feeds',       ja: 'マイフィード' }[lang],
              system:    { ko: '시스템 피드', en: 'System Feeds',   ja: 'システムフィード' }[lang],
              community: { ko: '인기 피드',  en: 'Popular Feeds',  ja: '人気フィード' }[lang],
            }

            const renderItem = (p: import('@/types').Persona, badge?: 'my') => {
              const isActive = p.id === currentId
              const name = p.name_i18n?.[lang] ?? p.name
              return (
                <button
                  key={p.id}
                  onClick={() => { onSelect(p.id); onClose() }}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors
                    ${isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800/60'}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm truncate ${isActive ? 'font-medium' : ''}`}>{name}</span>
                    {badge === 'my' && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">MY</span>
                    )}
                  </div>
                  {isActive && (
                    <svg className="shrink-0 text-zinc-400" width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M1.5 6.5l3.5 3.5 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              )
            }

            const SectionHeader = ({ label, color = 'text-zinc-500' }: { label: string; color?: string }) => (
              <div className="px-4 pt-2.5 pb-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${color}`}>{label}</span>
              </div>
            )

            const Divider = () => <div className="mx-4 my-1 border-t border-zinc-800" />

            return (
              <>
                {myPersonas.length > 0 && (
                  <>
                    <SectionHeader label={labels.my} color="text-indigo-400" />
                    {myPersonas.map(p => renderItem(p, 'my'))}
                    <Divider />
                  </>
                )}
                <SectionHeader label={labels.system} />
                {systemPersonas.map(p => renderItem(p))}
                {communityPersonas.length > 0 && (
                  <>
                    <Divider />
                    <SectionHeader label={labels.community} color="text-amber-500/80" />
                    {communityPersonas.map(p => renderItem(p))}
                  </>
                )}
              </>
            )
          })()}
        </div>

        {/* 하단 페이드 마스크 — 스크롤 끝에 도달하면 사라짐 (pointer-events-none으로 스크롤 방해 안 함) */}
        {hasScrollBelow && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12
                          bg-gradient-to-t from-zinc-900 to-transparent rounded-b-2xl" />
        )}
      </div>
    </div>
  )
}

const LABELS = {
  subtitle: {
    ko: 'YouTube 알고리즘 시뮬레이터',
    en: 'YouTube Algorithm Simulator',
    ja: 'YouTubeアルゴリズム シミュレーター',
  },
  selectPersona: {
    ko: '다른 사람 피드 보기',
    en: 'Explore another feed',
    ja: '別の人のフィードを見る',
  },
  langToggle: {
    ko: '언어 변경',
    en: 'Switch language',
    ja: '言語を変更',
  },
  accumulated: {
    ko: (n: number) => `누적 ${n}/500개`,
    en: (n: number) => `${n}/500 videos`,
    ja: (n: number) => `累計 ${n}/500件`,
  },
  viewCount: {
    ko: (weekly: number, total: number) => `이번 주 ${weekly}회 · 누적 ${total}회`,
    en: (weekly: number, total: number) => `${weekly} this week · ${total} total`,
    ja: (weekly: number, total: number) => `今週 ${weekly}回 · 累計 ${total}回`,
  },
  showing: {
    ko: (n: number, total: number) => `${n} / ${total}개 표시 중`,
    en: (n: number, total: number) => `Showing ${n} of ${total}`,
    ja: (n: number, total: number) => `${n} / ${total}件表示中`,
  },
  loading: {
    ko: '불러오는 중...',
    en: 'Loading...',
    ja: '読み込み中...',
  },
  published: {
    ko: '업로드',
    en: 'uploaded',
    ja: '投稿',
  },
  collected: {
    ko: '수집',
    en: 'collected',
    ja: '収集',
  },
  noFeed: {
    ko: '아직 수집된 피드가 없습니다.',
    en: 'No feed collected yet.',
    ja: 'まだフィードが収集されていません。',
  },
  noResults: {
    ko: '결과 없음',
    en: 'No results',
    ja: '結果なし',
  },
  noThumbnail: {
    ko: '썸네일 없음',
    en: 'No thumbnail',
    ja: 'サムネイルなし',
  },
  feedback: {
    ko: '피드백',
    en: 'Feedback',
    ja: 'フィードバック',
  },
  aiSummary: {
    ko: 'AI 요약',
    en: 'AI Summary',
    ja: 'AI 要約',
  },
  userIntro: {
    ko: '소개',
    en: 'Intro',
    ja: '紹介',
  },
  addVideo: {
    ko: '+ YouTube 링크 추가',
    en: '+ Add YouTube Link',
    ja: '+ YouTubeリンクを追加',
  },
  addVideoTitle: {
    ko: 'YouTube 영상 추가',
    en: 'Add YouTube Video',
    ja: 'YouTube動画を追加',
  },
  urlPlaceholder: {
    ko: 'YouTube URL 또는 영상 ID',
    en: 'YouTube URL or video ID',
    ja: 'YouTube URLまたは動画ID',
  },
  preview: {
    ko: '미리보기',
    en: 'Preview',
    ja: 'プレビュー',
  },
  addConfirm: {
    ko: '추가하기',
    en: 'Add',
    ja: '追加する',
  },
  adding: {
    ko: '추가 중...',
    en: 'Adding...',
    ja: '追加中...',
  },
  addSuccess: {
    ko: '영상이 추가되었습니다!',
    en: 'Video added!',
    ja: '動画を追加しました！',
  },
  introOptional: {
    ko: '소개 글 (선택)',
    en: 'Intro text (optional)',
    ja: '紹介文（任意）',
  },
  introPlaceholder: {
    ko: '이 영상을 추천하는 이유를 적어주세요',
    en: 'Why do you recommend this video?',
    ja: 'この動画をおすすめする理由を書いてください',
  },
  maxReached: {
    ko: '영상 500개 한도에 도달했습니다. 오래된 영상을 삭제 후 추가할 수 있습니다.',
    en: 'You\'ve reached the 500 video limit. Delete older videos to add more.',
    ja: '500件の上限に達しました。古い動画を削除してから追加できます。',
  },
  emptyUserFeed: {
    ko: '아직 추가된 영상이 없습니다. YouTube 링크를 추가해보세요.',
    en: 'No videos yet. Add a YouTube link to get started.',
    ja: 'まだ動画がありません。YouTubeリンクを追加してみましょう。',
  },
  cancel: {
    ko: '취소',
    en: 'Cancel',
    ja: 'キャンセル',
  },
  login: {
    ko: 'Log in',
    en: 'Log in',
    ja: 'Log in',
  },
  myAccount: {
    ko: '내 계정',
    en: 'My account',
    ja: 'マイアカウント',
  },
  myFeedManage: {
    ko: '내 피드 관리',
    en: 'Manage my feeds',
    ja: 'フィード管理',
  },
  newFeed: {
    ko: '새 피드 만들기',
    en: 'Create new feed',
    ja: '新しいフィードを作成',
  },
  signOut: {
    ko: '로그아웃',
    en: 'Sign out',
    ja: 'ログアウト',
  },
  cookieMsg: {
    ko: 'Anomess는 서비스 품질 향상을 위해 분석용 쿠키를 사용합니다.',
    en: 'Anomess uses analytics cookies to improve our service.',
    ja: 'Anomessはサービス改善のために分析用クッキーを使用しています。',
  },
  cookieLearnMore: {
    ko: '자세히 보기',
    en: 'Learn more',
    ja: '詳しく見る',
  },
  cookieDecline: {
    ko: '거부',
    en: 'Decline',
    ja: '拒否',
  },
  cookieAccept: {
    ko: '동의',
    en: 'Accept',
    ja: '同意',
  },
} as const

function t(key: keyof typeof LABELS, lang: Lang): string {
  const val = LABELS[key][lang]
  return typeof val === 'function' ? '' : (val as string)
}

function getLangTitle(video: Video, lang: Lang): string {
  const i18n = video.titles_i18n ?? {}
  const en = (i18n.en as string) || video.title
  if (lang === 'ko') return (i18n.ko as string) || en
  if (lang === 'ja') return (i18n.ja as string) || en
  return en
}

function getPersonaName(persona: Persona, lang: Lang): string {
  return persona.name_i18n?.[lang] ?? persona.name
}

// GA4 이벤트 전송 헬퍼
function gtag(event: string, params: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    ;(window as any).gtag('event', event, params)
  }
}


// ── 삭제 확인 팝업이 포함된 버튼 ──────────────────────────────────────────────
function DeleteButton({ dbId, lang, onDelete }: { dbId: number; lang: Lang; onDelete: (id: number) => void }) {
  const [confirming, setConfirming] = useState(false)

  const labels = {
    confirm:  { ko: '이 영상을 삭제할까요?', en: 'Delete this video?', ja: 'この動画を削除しますか？' }[lang],
    yes:      { ko: '삭제', en: 'Delete', ja: '削除' }[lang],
    no:       { ko: '취소', en: 'Cancel', ja: 'キャンセル' }[lang],
  }

  if (confirming) {
    return (
      <div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/80 rounded-none"
        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
      >
        <p className="text-white text-xs text-center px-3 leading-snug">{labels.confirm}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { onDelete(dbId); setConfirming(false) }}
            className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
          >
            {labels.yes}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="px-3 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs transition-colors"
          >
            {labels.no}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true) }}
      className="absolute top-1.5 right-1.5 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-black/70 hover:bg-red-600 text-white transition-colors"
      aria-label="삭제"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    </button>
  )
}

// ── VideoCard — memo로 분리해 isPlaying/isHovered 변경 시 해당 카드만 재렌더 ──────
interface VideoCardProps {
  video: Video
  idx: number
  lang: Lang
  today: string
  isPlaying: boolean
  isHovered: boolean
  personaId: string
  isOwner?: boolean
  onMouseEnter: (videoId: string) => void
  onMouseLeave: () => void
  onVideoClick: (video: Video, title: string, idx: number) => void
  onDelete?: (dbId: number) => void
}

const VideoCard = memo(function VideoCard({
  video, idx, lang, today, isPlaying, isHovered, personaId,
  isOwner, onMouseEnter, onMouseLeave, onVideoClick, onDelete,
}: VideoCardProps) {
  // collected_at(타임스탬프) 기준 FRESH_HOURS 이내면 NEW — 날짜만 비교하면 하루종일 NEW 뱃지가 붙음
  const isNew = video.collected_at
    ? (Date.now() - new Date(video.collected_at).getTime()) < FRESH_HOURS * 3_600_000
    : video.collected_date === today
  const title = getLangTitle(video, lang)
  const dateLabel = video.published_at ?? video.collected_date
  const [summaryOpen, setSummaryOpen] = useState(false)

  // 툴팁 외부 클릭 시 닫기
  useEffect(() => {
    if (!summaryOpen) return
    const close = () => setSummaryOpen(false)
    document.addEventListener('click', close, { once: true })
    return () => document.removeEventListener('click', close)
  }, [summaryOpen])

  // iframe lazy mount + 영구 유지 패턴
  // 첫 재생(isPlaying=true) 또는 hover 시 한 번만 DOM에 추가하고,
  // 이후 isPlaying=false여도 절대 unmount하지 않음.
  // Android Chrome의 compositor 레이어 teardown → 흰 깜박임 방지
  const [iframeActive, setIframeActive] = useState(false)
  useEffect(() => {
    if (isPlaying || isHovered) setIframeActive(true)
  }, [isPlaying, isHovered])

  const showIframe = isPlaying || isHovered

  return (
    <a
      href={video.url}
      title={video.title}
      data-video-id={video.video_id}
      className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      onMouseEnter={() => onMouseEnter(video.video_id)}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        e.preventDefault()
        onVideoClick(video, title, idx)
      }}
    >
      {/* 썸네일 + 미리보기 오버레이
          contain:paint + translateZ(0): GPU 레이어 고정 → iframe 전환 시 부모 레이어 재합성 방지
          isolation:isolate: stacking context 격리 → Android 레이어 재합성 범위 제한 */}
      <div
        className="relative w-full aspect-video bg-zinc-800"
        style={{ contain: 'paint', isolation: 'isolate', transform: 'translateZ(0)' }}
      >
        {video.thumbnail_url ? (
          <Image
            src={video.thumbnail_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover"
            priority={idx < 4}
          />
        ) : null}
        {/* iframeActive: 한 번 true가 되면 DOM에서 제거하지 않음 (unmount 자체가 플래시 원인)
            showIframe: opacity + pointer-events로만 show/hide → 레이어 유지
            transition-opacity: 마운트 직후 YouTube 흰 로딩 화면 fade-in으로 완화 */}
        {iframeActive && (
          <iframe
            src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&mute=1&controls=${isPlaying ? 1 : 0}&loop=1&playlist=${video.video_id}&modestbranding=1&rel=0`}
            className={`absolute inset-0 w-full h-full transition-opacity duration-200 ${
              showIframe ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            title={video.title}
          />
        )}
        {/* 오너 전용 삭제 버튼 — 썸네일 우상단 오버레이 */}
        {isOwner && video.db_id != null && onDelete && (
          <DeleteButton dbId={video.db_id} lang={lang} onDelete={onDelete} />
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p
          className="text-sm font-medium leading-snug line-clamp-2 mb-1.5 flex-1"
          data-ko={video.titles_i18n?.ko || video.title}
          data-en={video.titles_i18n?.en || video.title}
          data-ja={video.titles_i18n?.ja || video.title}
        >
          {title}
        </p>
        <div className="mt-auto pt-2">
          <span className="text-xs text-zinc-500 truncate block max-w-full mb-1.5">
            {video.channel}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isNew && (
              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-semibold">
                NEW
              </span>
            )}
            {dateLabel && (
              <span
                className={`text-[10px] ${video.published_at ? 'text-zinc-400' : 'text-zinc-600'}`}
                title={video.published_at
                  ? `${t('published', lang)}: ${video.published_at}`
                  : `${t('collected', lang)}: ${video.collected_date}`}
              >
                {dateLabel}
              </span>
            )}
            {video.summary_i18n && (video.summary_i18n[lang] || video.summary_i18n['en']) && (
              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSummaryOpen(v => !v)
                  }}
                  className={`text-[10px] border px-1.5 py-0.5 rounded transition-colors ${
                    video.feed_source === 'user'
                      ? 'text-indigo-400 hover:text-indigo-200 border-indigo-800 hover:border-indigo-500'
                      : 'text-zinc-500 hover:text-zinc-300 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {video.feed_source === 'user' ? t('userIntro', lang) : t('aiSummary', lang)}
                </button>
                {summaryOpen && (
                  <div
                    className="absolute bottom-full right-0 mb-1.5 w-64 bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {video.summary_i18n[lang] || video.summary_i18n['en']}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  )
})

// ── ShortCard — 9:16 세로형 카드 ─────────────────────────────────────────
// isPlaying: 모바일 자동재생 (캐로셀 좌측 카드)
// isHovered: 데스크톱 hover 재생
interface ShortCardProps {
  video: Video
  lang: Lang
  isPlaying: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onCardClick: (video: Video) => void
}

const ShortCard = memo(function ShortCard({
  video, lang, isPlaying, isHovered, onMouseEnter, onMouseLeave, onCardClick,
}: ShortCardProps) {
  const title = getLangTitle(video, lang)
  // VideoCard와 동일한 lazy-mount 패턴 — 한 번 mount 후 절대 unmount 안 함
  const [iframeActive, setIframeActive] = useState(false)
  const showIframe = isPlaying || isHovered
  useEffect(() => {
    if (showIframe) setIframeActive(true)
  }, [showIframe])

  // 앱 복귀 시 iframe 제거 → 썸네일 복원 (YouTube 앱에서 돌아올 때 검은 화면 방지)
  useEffect(() => {
    function onVisibility() {
      if (!document.hidden) setIframeActive(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      data-short-id={video.video_id}
      className="flex-shrink-0 w-36 snap-start group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => { e.preventDefault(); onCardClick(video) }}
    >
      <div
        className="relative w-full aspect-[9/16] bg-zinc-800 rounded-xl overflow-hidden"
        style={{ contain: 'paint', isolation: 'isolate', transform: 'translateZ(0)' }}
      >
        {/* 썸네일 */}
        {video.thumbnail_url && (
          <Image
            src={video.thumbnail_url}
            alt=""
            fill
            sizes="144px"
            className="object-cover"
          />
        )}
        {/* 자동재생 iframe — lazy mount, 음소거 */}
        {iframeActive && (
          <iframe
            src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${video.video_id}&modestbranding=1&rel=0`}
            className={`absolute inset-0 w-full h-full transition-opacity duration-200 ${
              showIframe ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            title={video.title}
          />
        )}
        {/* Shorts 배지 */}
        <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
          Shorts
        </div>
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="text-xs text-zinc-200 line-clamp-2 leading-tight">{title}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{video.channel}</p>
      </div>
    </a>
  )
})

// ── ShortsCarousel — 수평 스크롤 선반, 최신 콘텐츠가 왼쪽 ─────────────────────
const ShortsCarousel = memo(function ShortsCarousel({
  shorts,
  lang,
  playingId,
  onPlay,
  isMobile,
  hasMore,
  onLoadMore,
  onStopAll,
  onCardClick,
}: {
  shorts: Video[]
  lang: Lang
  playingId: string | null
  onPlay: (id: string | null) => void
  isMobile: boolean
  hasMore: boolean
  onLoadMore: () => void
  onStopAll: () => void
  onCardClick: (video: Video) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const scrollRef   = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isScrolling = useRef(false)

  // 가로 스크롤 끝 감지 — IntersectionObserver (root = 캐로셀 컨테이너)
  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = scrollRef.current
    if (!sentinel || !container || !hasMore) return

    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) onLoadMore() },
      { root: container, rootMargin: '0px 300px 0px 0px', threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore])

  // 세로 스크롤 재진입 감지는 FeedView의 playCardInZone에서 통합 처리
  // (data-shorts-section 마킹 → playCardInZone이 Shorts 존 체크 후 onPlay 호출)

  // 가로 스크롤 멈춤 감지 → 가장 왼쪽에 보이는 카드 자동재생 (모바일 전용)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    // 초기 로드 시 첫 번째 카드 자동재생 — 모바일에서만 (600ms 후 — 렌더 완료 대기)
    const initTimer = setTimeout(() => {
      if (isMobile && shorts.length > 0) onPlay(shorts[0].video_id)
    }, 600)

    // 컨테이너 안에서 오른쪽 끝이 containerLeft 보다 오른쪽에 있는 카드 중 가장 왼쪽 카드 반환
    function findLeftmostVisibleCard(): string | null {
      if (!el) return null
      const containerLeft = el.getBoundingClientRect().left
      const cards = el.querySelectorAll<HTMLElement>('[data-short-id]')
      for (const card of cards) {
        const rect = card.getBoundingClientRect()
        if (rect.right > containerLeft) return card.dataset.shortId ?? null
      }
      return null
    }

    function onScroll() {
      if (!isMobile) return  // 데스크톱은 scroll 자동재생 없음
      // 스크롤 시작 → 재생 중단
      if (!isScrolling.current) {
        isScrolling.current = true
        onPlay(null)
      }
      // 스크롤 멈춤 감지 (600ms debounce)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
      scrollTimer.current = setTimeout(() => {
        isScrolling.current = false
        const id = findLeftmostVisibleCard()
        if (id) onPlay(id)
      }, 600)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(initTimer)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
      el.removeEventListener('scroll', onScroll)
    }
  }, [shorts, onPlay, isMobile])

  if (shorts.length === 0) return null

  return (
    <section data-shorts-section className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.77 10.32l-1.2-.5L18 9.06a3.74 3.74 0 00-4.64-5.88L6 7.18H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V13a2.69 2.69 0 00-4.23-2.68zM10 17.18v-6l5 3z"/>
        </svg>
        <h2 className="text-sm font-semibold text-zinc-300">Shorts</h2>
      </div>
      {/* overflow-x-auto + scrollbar 숨김 + snap */}
      <div
        ref={scrollRef}
        data-shorts-scroll
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {shorts.map(video => (
          <ShortCard
            key={video.video_id}
            video={video}
            lang={lang}
            isPlaying={playingId === video.video_id}
            isHovered={hoveredId === video.video_id}
            onMouseEnter={() => setHoveredId(video.video_id)}
            onMouseLeave={() => setHoveredId(null)}
            onCardClick={onCardClick}
          />
        ))}
        {/* 가로 스크롤 끝 sentinel — has_more일 때만 존재 */}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex-shrink-0 flex items-center justify-center w-12 self-stretch"
          >
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </section>
  )
})

// ── 랜덤 순서 유틸 ────────────────────────────────────────────────────────────
const FEED_PAGE = 20
// NEXT_PUBLIC_FRESH_HOURS: 이 시간 이내 수집된 콘텐츠를 신규로 간주 (기본 12시간)
const FRESH_HOURS = Number(process.env.NEXT_PUBLIC_FRESH_HOURS ?? 12)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Epoch 셔플 — 한 번만 실행하고 cursor로 이동 (weightedShuffle 대체)
// 우선순위: fresh+summary > fresh > rest+summary > rest > seen
// viewed: localStorage 시청 이력 → 본 영상은 뒤쪽 seen 버킷으로 패널티
function epochShuffle(videos: Video[], viewed: Set<string>): Video[] {
  const cutoffMs = Date.now() - FRESH_HOURS * 3_600_000
  const freshSummarized: Video[] = []
  const freshRaw: Video[] = []
  const restSummarized: Video[] = []
  const restRaw: Video[] = []
  const seen: Video[] = []

  for (const v of videos) {
    // stt_skip 마킹된 영상은 요약 없는 것으로 취급 (summary_i18n = {stt_skip:true} 형태)
    const hasSummary = v.summary_i18n
      && !v.summary_i18n.stt_skip
      && (v.summary_i18n.ko || v.summary_i18n.en || v.summary_i18n.ja)
    if (viewed.has(v.video_id)) {
      seen.push(v)
    } else if (
      v.collected_at
        ? new Date(v.collected_at).getTime() >= cutoffMs
        : (v.collected_date ?? '') >= new Date(cutoffMs).toISOString().slice(0, 10)
    ) {
      hasSummary ? freshSummarized.push(v) : freshRaw.push(v)
    } else {
      hasSummary ? restSummarized.push(v) : restRaw.push(v)
    }
  }
  return [
    ...shuffle(freshSummarized),
    ...shuffle(freshRaw),
    ...shuffle(restSummarized),
    ...shuffle(restRaw),
    ...shuffle(seen),
  ]
}

interface Props {
  feed: FeedPageResponse | null
  persona: Persona
  allPersonas: Persona[]
}

export default function FeedView({ feed, persona, allPersonas }: Props) {
  const { enqueueEvent } = useEventQueue()

  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'ko'
    // URL 쿼리 파라미터 ?lang=ja 우선 → 없으면 localStorage → 기본 ko
    const urlLang = new URLSearchParams(window.location.search).get('lang') as Lang | null
    if (urlLang && ['ko', 'en', 'ja'].includes(urlLang)) {
      localStorage.setItem('feed_lang', urlLang)  // 다음 방문에도 유지
      return urlLang
    }
    const saved = localStorage.getItem('feed_lang') as Lang | null
    return (saved && ['ko', 'en', 'ja'].includes(saved)) ? saved : 'ko'
  })
  const [currentPersona, setCurrentPersona] = useState<Persona>(() => {
    if (typeof window === 'undefined') return persona
    const savedId = localStorage.getItem('feed_last_persona')
    if (!savedId) return persona
    return allPersonas.find(p => p.id === savedId) ?? persona
  })
  const [videos, setVideos] = useState<Video[]>([])
  const [hasMore, setHasMore] = useState(false)
  const hasMoreRef = useRef(false)
  const [nextOffset, setNextOffset] = useState(0)
  // nextOffsetRef / hasMoreRef: loadMore useCallback deps에서 state를 제거하기 위해 ref로 동기화
  // state가 deps에 있으면 매 로드마다 loadMore 함수가 교체 → IntersectionObserver 재생성 →
  // sentinel이 이미 뷰포트 안에 있을 때 다음 스크롤까지 발화 안 함 (Read More 동작 안 하는 원인)
  const nextOffsetRef = useRef(0)
  const updateNextOffset = useCallback((v: number) => {
    nextOffsetRef.current = v
    setNextOffset(v)
  }, [])
  const updateHasMore = useCallback((v: boolean) => {
    hasMoreRef.current = v
    setHasMore(v)
  }, [])
  const [isLoading, setIsLoading] = useState(false)
  const [total, setTotal] = useState(0)
  // 초기 클라이언트 fetch 완료 전 로딩 상태
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  // fetch 완료 후 실제 영상이 0개인 경우 — "피드 없음" 표시용 (로딩 중에는 false 유지)
  const [isEmpty, setIsEmpty] = useState(false)
  const [viewStats, setViewStats] = useState<{ weekly: number; total: number } | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showPersonaSheet, setShowPersonaSheet] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [myPersonaIds, setMyPersonaIds] = useState<Set<string>>(new Set())
  const [showTerms, setShowTerms] = useState(false)
  const [addVideoOpen, setAddVideoOpen] = useState(false)
  // PTR 완료 후 fade-in 제어 — false: 콘텐츠 숨김(no-transition), true: fade-in(300ms)
  // 초기 진입 시에도 false → 클라이언트 fetch 완료 후 fade-in (SSR flash 방지)
  const [contentReady, setContentReady] = useState(false)
  // hover 미리보기 — 현재 hover 중인 video_id (데스크톱)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 모바일 자동재생 — 두 상태를 분리하되 동시 재생 방지 (하나 set 시 다른 것 null)
  const [shortPlayId, setShortPlayId]     = useState<string | null>(null)
  const [regularPlayId, setRegularPlayId] = useState<string | null>(null)
  // 동기적으로 shortPlayId를 읽기 위한 ref (useEffect 클로저에서 최신값 참조용)
  const shortPlayIdRef = useRef<string | null>(null)
  shortPlayIdRef.current = shortPlayId
  // 포인터 지원 여부 감지 (hover: hover = 데스크톱, hover: none = 터치 기기)
  const [supportsHover, setSupportsHover] = useState(false)
  // 모바일 스크롤 자동재생용 타이머 ref
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 스크롤 중 여부 — setMobilePlayingId(null)을 첫 이벤트에서만 1회 호출하기 위한 가드
  const isScrollingRef = useRef(false)
  // 현재 활성 페르소나 ID를 ref로도 보관 — loadMore가 비동기 완료 시점에 페르소나가 바뀌었는지 확인용
  // localStorage 복원값이 있으면 그걸 우선 사용 (초기 마운트 시 URL 페르소나보다 우선)
  const activePersonaIdRef = useRef<string>(currentPersona.id)
  // 최초 마운트 여부 — 초기 진입 시 localStorage 복원 페르소나를 URL 페르소나로 덮어쓰지 않기 위해 사용
  const isFirstMountRef = useRef<boolean>(true)
  // loadMore 동시 실행 방지 — state는 리렌더 전까지 반영 안 되므로 ref로 동기 가드
  const isLoadingRef = useRef(false)

  // ── 로그인 유저 상태 로드 ─────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── 약관 동의 체크 — 로그인 유저만, 버전 낮으면 모달 표시 ─────────────────────────
  useEffect(() => {
    if (!user) { setShowTerms(false); return }
    fetch('/api/user/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const version = data?.profile?.terms_version ?? 0
        if (version < CURRENT_TERMS_VERSION) setShowTerms(true)
      })
      .catch(() => { /* 실패 시 약관 강제하지 않음 */ })
  }, [user])

  // ── 유저 페르소나 오너 체크 + 내 피드 ID 목록 ───────────────────────────────────
  useEffect(() => {
    if (!user) {
      setIsOwner(false)
      setMyPersonaIds(new Set())
      return
    }
    fetch('/api/user/personas')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.personas) {
          const ids = new Set<string>(data.personas.map((p: { persona_id: string }) => p.persona_id))
          setMyPersonaIds(ids)
          setIsOwner(currentPersona.id.startsWith('u_') && ids.has(currentPersona.id))
        } else {
          setMyPersonaIds(new Set())
          setIsOwner(false)
        }
      })
      .catch(() => { setIsOwner(false); setMyPersonaIds(new Set()) })
  }, [user, currentPersona.id])

  // ── 피드 전체 풀 (셔플 후 가상 페이지네이션용) ────────────────────────────────
  const allVideosRef = useRef<Video[]>([])

  // ── Shorts 캐로셀 상태 ────────────────────────────────────────────────────────
  const [shorts, setShorts]                     = useState<Video[]>([])
  const [shortsHasMore, setShortsHasMore]       = useState(false)
  const [shortsNextOffset, setShortsNextOffset] = useState(0)
  const shortsLoadingRef                        = useRef(false)

  // Shorts 재생 콜백 — shortPlayId 갱신 + 일반 피드 재생 중단
  const handleShortsPlay = useCallback((id: string | null) => {
    shortPlayIdRef.current = id  // debounce 클로저에서 동기 참조 가능하도록 즉시 갱신
    setShortPlayId(id)
    if (id !== null) setRegularPlayId(null)
  }, [])

  // 페르소나 변경 시 Shorts 전체 로드 (limit=100) + 랜덤 셔플
  useEffect(() => {
    let cancelled = false
    setShorts([])
    setShortPlayId(null)
    setShortsHasMore(false)
    setShortsNextOffset(0)
    shortsLoadingRef.current = false
    fetch(`/api/feed/shorts/${currentPersona.id}?offset=0&limit=100`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!cancelled && d?.videos) {
          const shuffledShorts = epochShuffle(d.videos, getViewedSet())
          shortsOrderCacheRef.current.set(currentPersona.id, shuffledShorts)  // 순서 캐시 저장
          setShorts(shuffledShorts)
          setShortsHasMore(false)
          setShortsNextOffset(d.videos.length)
        }
      })
      .catch(() => {/* 에러 무시 — Shorts 없어도 메인 피드는 정상 동작 */})
    return () => { cancelled = true }
  }, [currentPersona.id])

  // 페르소나 변경 시 조회수 통계 fetch
  useEffect(() => {
    let cancelled = false
    fetch(`/api/feed/stats/${currentPersona.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data) setViewStats(data) })
      .catch(() => {/* 에러 무시 */})
    return () => { cancelled = true }
  }, [currentPersona.id])

  // 가로 스크롤 끝 도달 시 다음 페이지 로드
  const loadMoreShorts = useCallback(async () => {
    if (shortsLoadingRef.current || !shortsHasMore) return
    shortsLoadingRef.current = true
    try {
      const res = await fetch(`/api/feed/shorts/${currentPersona.id}?offset=${shortsNextOffset}&limit=10`)
      if (!res.ok) return
      const data = await res.json()
      setShorts(prev => {
        const ids = new Set(prev.map(v => v.video_id))
        const fresh = (data.videos ?? []).filter((v: Video) => !ids.has(v.video_id))
        return [...prev, ...fresh]
      })
      setShortsHasMore(data.has_more ?? false)
      setShortsNextOffset(data.next_offset ?? 0)
    } catch { /* 무시 */ }
    finally { shortsLoadingRef.current = false }
  }, [shortsHasMore, shortsNextOffset, currentPersona.id])

  // ── 피드 캐시 (TTL: 1시간) ─────────────────────────────────────────────────
  const FEED_CACHE_TTL_MS = 60 * 60 * 1000
  type FeedCacheEntry = {
    data: FeedPageResponse
    shuffled: Video[]   // 최초 셔플된 순서 — 페르소나 전환 시 그대로 재사용 (재셔플 없음)
    cachedAt: number
  }
  const feedCacheRef = useRef<Map<string, FeedCacheEntry>>(new Map())
  // Shorts 셔플 순서 캐시 — 페르소나 전환 시 재사용 (feedCacheRef와 별도 관리)
  const shortsOrderCacheRef = useRef<Map<string, Video[]>>(new Map())

  function getCachedFeed(personaId: string): FeedCacheEntry | null {
    const entry = feedCacheRef.current.get(personaId)
    if (!entry) return null
    if (Date.now() - entry.cachedAt > FEED_CACHE_TTL_MS) {
      feedCacheRef.current.delete(personaId)
      return null
    }
    return entry
  }

  function setCachedFeed(personaId: string, data: FeedPageResponse, shuffled: Video[]) {
    feedCacheRef.current.set(personaId, { data, shuffled, cachedAt: Date.now() })
  }

  // ── Pull to Refresh ────────────────────────────────────────────────────────
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pullStartYRef = useRef<number | null>(null)
  const PULL_THRESHOLD = 72  // px — 이 이상 당기면 새로고침 트리거

  // 터치 기기 감지 — maxTouchPoints 사용 (hover 미디어쿼리는 Chrome DevTools 에뮬레이션에서도 true라 부정확)
  // maxTouchPoints > 0 이면 터치 기기(실제 모바일 + DevTools 에뮬레이션 모두 정확)
  useEffect(() => {
    const isTouch = navigator.maxTouchPoints > 0
    setSupportsHover(!isTouch)
  }, [])

  // 데스크톱 hover 핸들러
  // useCallback 필수 — 미사용 시 mobilePlayingId/hoveredId 변경마다 새 함수 레퍼런스 생성 →
  // VideoCard memo 무력화 → 전체 카드 리렌더 → 피드 깜박임 발생
  const handleMouseEnter = useCallback((videoId: string) => {
    if (!supportsHover) return
    hoverTimerRef.current = setTimeout(() => setHoveredId(videoId), 600)
  }, [supportsHover])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setHoveredId(null)
  }, [])

  // 모바일 스크롤 자동재생 — 스크롤 멈춤 감지 후 뷰포트 중앙 zone의 카드 재생
  // zone: 뷰포트 세로 30~70% (사용자에게 비노출 — 순수 로직용)
  useEffect(() => {
    if (supportsHover) return  // 데스크톱은 hover 방식 사용

    // viewport 상단 10~60% 영역 안에 중심이 있는 카드를 반환
    // 초기 로드 시 첫 번째 카드가 상단에 위치하므로 zoneTop을 0.10으로 설정
    function findCardInZone(): string | null {
      const vh = window.innerHeight
      const zoneTop    = vh * 0.10
      const zoneBottom = vh * 0.60
      const cards = document.querySelectorAll<HTMLElement>('[data-video-id]')
      for (const card of cards) {
        const { top, bottom } = card.getBoundingClientRect()
        const center = (top + bottom) / 2
        if (center >= zoneTop && center <= zoneBottom) {
          return card.getAttribute('data-video-id')
        }
      }
      return null
    }

    function playCardInZone() {
      const vh = window.innerHeight
      const zoneTop    = vh * 0.10
      const zoneBottom = vh * 0.60

      // 1. Shorts 섹션이 활성 존에 있는지 먼저 확인
      const shortsSection = document.querySelector<HTMLElement>('[data-shorts-section]')
      if (shortsSection) {
        const { top, bottom } = shortsSection.getBoundingClientRect()
        const center = (top + bottom) / 2
        if (center >= zoneTop && center <= zoneBottom) {
          // Shorts 섹션이 존 안에 있음 — 현재 가장 왼쪽에 보이는 카드 재생
          const cards = shortsSection.querySelectorAll<HTMLElement>('[data-short-id]')
          const containerEl = shortsSection.querySelector<HTMLElement>('[data-shorts-scroll]')
          const containerLeft = containerEl?.getBoundingClientRect().left ?? 0
          let leftmostId: string | null = null
          for (const card of cards) {
            if (card.getBoundingClientRect().right > containerLeft) {
              leftmostId = card.dataset.shortId ?? null
              break
            }
          }
          if (leftmostId) {
            handleShortsPlay(leftmostId)
            return
          }
        }
      }

      // 2. 일반 영상 존 체크
      const videoId = findCardInZone()
      if (videoId) {
        setShortPlayId(null)
        setRegularPlayId(videoId)
      }
    }

    function onScroll() {
      // 스크롤 첫 이벤트에서만 null 설정 — 매 이벤트마다 호출하면 초당 수십 번 리렌더 → 흰 깜박임
      if (!isScrollingRef.current) {
        isScrollingRef.current = true
        shortPlayIdRef.current = null
        setShortPlayId(null)
        setRegularPlayId(null)
      }
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      // 300ms 멈추면 zone 안 카드 재생
      scrollTimerRef.current = setTimeout(() => {
        isScrollingRef.current = false
        playCardInZone()
      }, 300)
    }

    // 초기 로드 시 스크롤 이벤트 없이도 첫 카드를 자동재생
    // 600ms: 피드 카드 DOM 마운트 완료 대기
    // Shorts가 먼저 재생 중이면 일반 피드 자동재생 생략 (두 개 동시 재생 방지)
    const initialTimer = setTimeout(() => {
      if (shortPlayIdRef.current) return  // Shorts가 이미 재생 중 — 일반 피드는 대기
      playCardInZone()
    }, 600)

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(initialTimer)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      setRegularPlayId(null)
      setShortPlayId(null)
    }
  // shorts: 제거 — 숏츠 페이지네이션 시 playCardInZone이 재실행되어 현재 재생을 방해하는 것 방지
  }, [supportsHover, videos[0]?.video_id, handleShortsPlay])

  // ── Pull to Refresh — 터치 이벤트 ─────────────────────────────────────────
  useEffect(() => {
    if (supportsHover) return  // 데스크톱에서는 불필요

    async function doRefresh() {
      setIsRefreshing(true)
      feedCacheRef.current.delete(currentPersona.id)  // 캐시 무효화
      const viewed = getViewedSet()
      try {
        // Stage 1: Shorts와 병렬 + 피드 빠른 로드
        const [feedRes, shortsRes] = await Promise.all([
          fetch(`/api/feed/${currentPersona.id}?offset=0&limit=50&skip_count=1`),
          fetch(`/api/feed/shorts/${currentPersona.id}?offset=0&limit=100`),
        ])
        if (!feedRes.ok) throw new Error('fetch failed')

        const data: FeedPageResponse = await feedRes.json()
        const shuffled = epochShuffle(data.videos, viewed)
        const ptrStage1Displayed = shuffled.slice(0, FEED_PAGE)
        allVideosRef.current = shuffled
        setVideos(ptrStage1Displayed)
        updateHasMore(true)  // Stage 2에서 보완
        updateNextOffset(FEED_PAGE)

        // Shorts 재셔플
        if (shortsRes.ok) {
          const shortsData = await shortsRes.json()
          if (shortsData?.videos) {
            const newShorts = epochShuffle(shortsData.videos, viewed)
            stopAllPlayback()
            shortsOrderCacheRef.current.set(currentPersona.id, newShorts)
            setShorts(newShorts)
            setShortsHasMore(false)
            setShortsNextOffset(newShorts.length)
          }
        }

        window.scrollTo({ top: 0, behavior: 'instant' })

        // Stage 2: 백그라운드 풀 로드
        const fullRes = await fetch(`/api/feed/${currentPersona.id}?offset=0&limit=300`)
        if (fullRes.ok) {
          const fullData: FeedPageResponse = await fullRes.json()
          const fullShuffled = epochShuffle(fullData.videos, viewed)
          // Stage 1 표시분 보존 + 나머지 붙임 (dedup 버그 방지)
          const shownIds = new Set(ptrStage1Displayed.map(v => v.video_id))
          const remaining = fullShuffled.filter(v => !shownIds.has(v.video_id))
          allVideosRef.current = [...ptrStage1Displayed, ...remaining]
          updateHasMore(remaining.length > 0)
          setTotal(fullData.total_accumulated ?? fullShuffled.length)
          setCachedFeed(currentPersona.id, fullData, allVideosRef.current)
        }
      } catch { /* 실패 시 현재 피드 유지 */ }
      finally { setIsRefreshing(false) }
    }

    function onTouchStart(e: TouchEvent) {
      // 스크롤이 최상단일 때만 pull 시작
      if (window.scrollY > 0) return
      pullStartYRef.current = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      if (pullStartYRef.current === null) return
      const dist = e.touches[0].clientY - pullStartYRef.current
      if (dist < 0) { pullStartYRef.current = null; return }
      // 최대 100px까지만 당김 (rubber band 효과)
      setPullDistance(Math.min(dist * 0.5, 100))
    }

    function onTouchEnd() {
      if (pullDistance >= PULL_THRESHOLD) doRefresh()
      setPullDistance(0)
      pullStartYRef.current = null
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [supportsHover, pullDistance, currentPersona.id])

  // 서버에서 직접 접근 시 (URL 직접 입력, 새로고침) 전체 풀 로드 + 셔플
  // window.history.pushState 사용으로 Next.js navigation이 트리거되지 않아 이 effect는
  // 초기 마운트 시에만 발동됨 (브라우저 직접 접근 / 새로고침)
  useEffect(() => {
    // 최초 마운트: localStorage에서 복원된 페르소나가 URL 페르소나와 다르면 복원값 사용
    // (setCurrentPersona로 덮어쓰지 않음 — useState 초기화에서 이미 올바른 값 설정됨)
    const isFirst = isFirstMountRef.current
    isFirstMountRef.current = false

    const targetPersona = isFirst ? currentPersona : persona
    if (!isFirst) {
      setCurrentPersona(persona)
      activePersonaIdRef.current = persona.id
    }

    // 최초 마운트 + 복원 페르소나가 URL과 다를 경우 URL을 조용히 교체
    if (isFirst && currentPersona.id !== persona.id) {
      window.history.replaceState(null, '', `/p/${currentPersona.id}`)
    }

    let cancelled = false
    const viewed = getViewedSet()
    // Stage 1에서 실제 표시된 영상 — Stage 2 재조합 시 앞에 보존 (dedup 버그 방지)
    let stage1Displayed: Video[] = []

    // Stage 1: 빠른 첫 화면 (50개, COUNT 스킵)
    fetch(`/api/feed/${targetPersona.id}?offset=0&limit=50&skip_count=1`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        // data가 null이거나 videos 배열이 없으면 → 빈 피드 (신규 유저 페르소나 등)
        // isInitialLoading은 반드시 해제해야 추후 영상 추가 시 그리드가 렌더됨
        if (!data?.videos) {
          setIsInitialLoading(false)
          setContentReady(true)
          setIsEmpty(true)
          return
        }
        const shuffled = epochShuffle(data.videos, viewed)
        stage1Displayed = shuffled.slice(0, FEED_PAGE)
        allVideosRef.current = shuffled
        setVideos(stage1Displayed)
        updateHasMore(true)  // Stage 2에서 더 로드될 예정
        updateNextOffset(FEED_PAGE)
        setIsEmpty(false)
        setIsInitialLoading(false)
        setContentReady(true)

        // Stage 2: 백그라운드 풀 로드 (300개, COUNT 포함)
        return fetch(`/api/feed/${targetPersona.id}?offset=0&limit=300`)
      })
      .then(r => r?.ok ? r.json() : null)
      .then(fullData => {
        if (cancelled || !fullData?.videos) return
        const fullShuffled = epochShuffle(fullData.videos, viewed)
        // Stage 1 표시분을 앞에 보존 + 나머지를 뒤에 붙임 → loadMore가 slice(20~)부터 읽으면 중복 없음
        const shownIds = new Set(stage1Displayed.map(v => v.video_id))
        const remaining = fullShuffled.filter(v => !shownIds.has(v.video_id))
        allVideosRef.current = [...stage1Displayed, ...remaining]
        updateHasMore(remaining.length > 0)
        setTotal(fullData.total_accumulated ?? fullShuffled.length)
        setIsEmpty(fullShuffled.length === 0)
        setCachedFeed(targetPersona.id, fullData, allVideosRef.current)
      })
      .catch(() => { setIsInitialLoading(false); setContentReady(true) })
    return () => { cancelled = true }
  }, [persona.id])  // eslint-disable-line react-hooks/exhaustive-deps

  // 클라이언트사이드 페르소나 전환 (새로고침 없음)
  const switchPersona = useCallback(async (nextPersonaId: string) => {
    const nextPersona = allPersonas.find(p => p.id === nextPersonaId)
    if (!nextPersona || nextPersonaId === currentPersona.id) return

    gtag('persona_switch', { from: currentPersona.id, to: nextPersonaId, lang })

    // 마지막 선택 페르소나 저장
    localStorage.setItem('feed_last_persona', nextPersonaId)

    // ref 즉시 갱신 — inflight loadMore가 응답 도착 시 stale 체크로 결과를 버리게 함
    activePersonaIdRef.current = nextPersonaId

    setCurrentPersona(nextPersona)
    window.history.pushState(null, '', `/p/${nextPersonaId}`)

    // 캐시 히트 — 저장된 셔플 순서 그대로 표시 (재셔플 없음 → 전환 시 순서 안정)
    const cached = getCachedFeed(nextPersonaId)
    if (cached) {
      allVideosRef.current = cached.shuffled
      setVideos(cached.shuffled.slice(0, FEED_PAGE))
      updateHasMore(cached.shuffled.length > FEED_PAGE)
      updateNextOffset(FEED_PAGE)
      setTotal(cached.data.total_accumulated)
      setIsEmpty(cached.shuffled.length === 0)
      // Shorts 캐시 히트 시 재사용 (없으면 useEffect가 별도 fetch)
      const cachedShorts = shortsOrderCacheRef.current.get(nextPersonaId)
      if (cachedShorts && cachedShorts.length > 0) {
        setShorts(cachedShorts)
        setShortsHasMore(false)
        setShortsNextOffset(cachedShorts.length)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // 캐시 미스 — 2단계 fetch
    setVideos([])
    updateHasMore(false)
    updateNextOffset(0)
    setNavigating(true)
    const viewed = getViewedSet()

    try {
      // Stage 1: 빠른 첫 화면
      const res = await fetch(`/api/feed/${nextPersonaId}?offset=0&limit=50&skip_count=1`)
      if (!res.ok) throw new Error('fetch failed')
      const data: FeedPageResponse = await res.json()

      const shuffled = epochShuffle(data.videos, viewed)
      allVideosRef.current = shuffled
      setVideos(shuffled.slice(0, FEED_PAGE))
      updateHasMore(true)
      updateNextOffset(FEED_PAGE)
      setIsEmpty(false)
      setNavigating(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Stage 2: 백그라운드 풀 로드
      const fullRes = await fetch(`/api/feed/${nextPersonaId}?offset=0&limit=300`)
      if (fullRes.ok) {
        const fullData: FeedPageResponse = await fullRes.json()
        const fullShuffled = epochShuffle(fullData.videos, viewed)
        // Stage 1 표시분 보존 + 나머지 붙임 (dedup 버그 방지)
        const shownIds = new Set(shuffled.slice(0, FEED_PAGE).map(v => v.video_id))
        const remaining = fullShuffled.filter(v => !shownIds.has(v.video_id))
        allVideosRef.current = [...shuffled.slice(0, FEED_PAGE), ...remaining]
        setCachedFeed(nextPersonaId, fullData, allVideosRef.current)
        updateHasMore(remaining.length > 0)
        setTotal(fullData.total_accumulated ?? fullShuffled.length)
        setIsEmpty(fullShuffled.length === 0)
      }
    } catch {
      window.location.href = `/p/${nextPersonaId}`
    } finally {
      setNavigating(false)
    }
  }, [currentPersona.id, allPersonas, lang])

  const loadMore = useCallback(() => {
    // isLoadingRef: 동기 가드 — IntersectionObserver 중복 발화 방지
    if (isLoadingRef.current || !hasMoreRef.current) return
    isLoadingRef.current = true
    setIsLoading(true)

    // nextOffsetRef로 최신 offset 읽기 — state(nextOffset)를 deps에서 제거해
    // loadMore 함수가 교체되지 않으므로 IntersectionObserver 재생성이 없음
    const currentOffset = nextOffsetRef.current
    const next = allVideosRef.current.slice(currentOffset, currentOffset + FEED_PAGE)
    if (next.length > 0) {
      setVideos(prev => {
        const ids = new Set(prev.map(v => v.video_id))
        return [...prev, ...next.filter(v => !ids.has(v.video_id))]
      })
      const newOffset = currentOffset + next.length
      updateNextOffset(newOffset)
      updateHasMore(newOffset < allVideosRef.current.length)
      gtag('infinite_scroll_load', { persona_id: currentPersona.id, offset: currentOffset, loaded: next.length })
      enqueueEvent({ type: 'scroll_load', persona_id: currentPersona.id, scroll_page: Math.floor(currentOffset / FEED_PAGE) + 1, lang })
    } else {
      updateHasMore(false)
    }

    isLoadingRef.current = false
    setIsLoading(false)
  }, [currentPersona.id, updateNextOffset, updateHasMore])

  // sentinelRef: callback ref — DOM에 붙는 순간 Observer 자동 연결
  // useRef + useEffect 방식은 sentinel이 조건부 렌더링될 때 effect 재실행 안 됨 → Read More 불작동
  // callback ref는 element mount/unmount 시 즉시 호출 → 항상 올바르게 Observer 연결/해제
  const sentinelObserverRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (sentinelObserverRef.current) {
      sentinelObserverRef.current.disconnect()
      sentinelObserverRef.current = null
    }
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    sentinelObserverRef.current = observer
  }, [loadMore])

  // 비디오 클릭 핸들러 — useCallback으로 메모이제이션해 VideoCard 불필요한 재렌더 방지
  const stopAllPlayback = useCallback(() => {
    shortPlayIdRef.current = null
    setShortPlayId(null)
    setRegularPlayId(null)
  }, [])

  // Shorts 클릭 — 모바일에서 YouTube 앱으로 열기 (일반 피드 handleVideoClick과 동일 딥링크 로직)
  const handleShortsClick = useCallback((video: Video) => {
    stopAllPlayback()
    markViewed(video.video_id)
    gtag('shorts_click', { video_id: video.video_id, persona_id: currentPersona.id, lang })
    enqueueEvent({ type: 'shorts_click', persona_id: currentPersona.id, video_id: video.video_id, lang })
    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    const isAndroid = /Android/i.test(ua)
    if (isIOS) {
      // iOS: youtube.com은 Universal Links로 등록돼 네이티브 앱이 가로챔
      // m.youtube.com 서브도메인은 Universal Links 미등록 → Safari에서 직접 열림
      window.location.href = `https://m.youtube.com/shorts/${video.video_id}`
    } else if (isAndroid) {
      window.location.href = `intent://www.youtube.com/shorts/${video.video_id}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=https://www.youtube.com/shorts/${video.video_id};end`
    } else {
      window.open(`https://www.youtube.com/shorts/${video.video_id}`, '_blank')
    }
  }, [currentPersona.id, lang, stopAllPlayback])

  const handleVideoClick = useCallback((video: Video, title: string, idx: number) => {
    stopAllPlayback()  // 클릭 시 현재 재생 즉시 중단
    markViewed(video.video_id)
    gtag('video_click', {
      video_id: video.video_id,
      video_title: title,
      persona_id: currentPersona.id,
      position: idx + 1,
      lang,
    })
    enqueueEvent({ type: 'video_click', persona_id: currentPersona.id, video_id: video.video_id, position: idx + 1, lang })
    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    const isAndroid = /Android/i.test(ua)
    if (isIOS) {
      // iOS: youtube.com은 Universal Links로 등록돼 네이티브 앱이 가로챔
      // m.youtube.com 서브도메인은 Universal Links 미등록 → Safari에서 직접 열림
      window.location.href = `https://m.youtube.com/watch?v=${video.video_id}`
    } else if (isAndroid) {
      window.location.href = `intent://www.youtube.com/watch?v=${video.video_id}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=https://www.youtube.com/watch?v=${video.video_id};end`
    } else {
      window.open(video.url, '_blank')
    }
  }, [currentPersona.id, lang, stopAllPlayback])

  // 탭 숨김/복귀 감지 — 숨김 시 재생 중단, 복귀 시 재생 안 함 (중복 재생 방지)
  useEffect(() => {
    if (supportsHover) return  // 데스크톱은 hover 방식이므로 불필요
    function onVisibility() {
      if (document.hidden) {
        stopAllPlayback()
      }
      // 복귀 시에는 자동 재생 안 함 — 사용자가 다시 스크롤할 때 playCardInZone이 처리
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [supportsHover, stopAllPlayback])

  // IntersectionObserver는 sentinelRef callback ref 안에서 직접 처리됨 (위 sentinelRef 정의 참조)

  // 영상 추가 완료 → 피드 맨 앞에 삽입
  const handleVideoAdded = useCallback((added: { video_id: string; title: string; channel: string; thumbnail_url: string; added_at: string; db_id: number; user_intro: Record<string, string> | null; titles_i18n: Record<string, string> }) => {
    const newVideo: Video = {
      video_id: added.video_id,
      persona_id: currentPersona.id,
      title: added.title,
      channel: added.channel,
      url: `https://www.youtube.com/watch?v=${added.video_id}`,
      thumbnail_url: added.thumbnail_url,
      view_count: 0,
      keyword: '',
      score: 0,
      collected_at: added.added_at,
      feed_source: 'user',
      collected_date: added.added_at.split('T')[0],
      published_at: null,
      titles_i18n: added.titles_i18n,
      summary_i18n: added.user_intro ?? null,
      db_id: added.db_id,
    }
    setVideos(prev => [newVideo, ...prev])
    setTotal(prev => prev + 1)
    setIsEmpty(false)
  }, [currentPersona.id])

  // 영상 삭제 — db_id로 API 호출 후 state에서 제거
  const handleVideoDelete = useCallback(async (dbId: number) => {
    try {
      const res = await fetch(`/api/user/videos/${dbId}`, { method: 'DELETE' })
      if (!res.ok) return
      setVideos(prev => prev.filter(v => v.db_id !== dbId))
      setTotal(prev => Math.max(0, prev - 1))
    } catch {
      // 삭제 실패 시 무시 — 사용자에게 UI 변화 없음
    }
  }, [])

  function switchLang(l: Lang) {
    gtag('language_switch', { from: lang, to: l, persona_id: currentPersona.id })
    setLang(l)
    localStorage.setItem('feed_lang', l)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      {/* 페이지 전환 Progress Bar */}
      <NavigationProgress active={navigating} />

      {/* Pull to Refresh 인디케이터 */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center items-end pointer-events-none"
          style={{ height: isRefreshing ? 48 : pullDistance }}
        >
          <div className={`mb-2 flex items-center gap-2 text-xs text-zinc-400 transition-opacity ${
            pullDistance >= PULL_THRESHOLD || isRefreshing ? 'opacity-100' : 'opacity-60'
          }`}>
            {isRefreshing ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {t('loading', lang)}
              </>
            ) : (
              <span>{pullDistance >= PULL_THRESHOLD ? '↑ 놓으면 새로고침' : '↓ 당겨서 새로고침'}</span>
            )}
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="border-b border-zinc-800 px-4 py-3 sticky top-0 bg-zinc-950 z-10">
        <div className="flex items-center justify-between mb-2">
          <a href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/anomess-logo.png"
              alt="Anomess"
              className="h-[66px] w-auto rounded-xl"
            />
          </a>
          <div className="flex items-center gap-2 shrink-0">
            {/* Share 버튼 */}
            <ShareButton lang={lang} personaId={currentPersona.id} />

            {/* 언어 토글 */}
            <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-xs font-medium">
              {(['ko', 'en', 'ja'] as Lang[]).map(l => (
                <button
                  key={l}
                  onClick={() => switchLang(l)}
                  className={`px-2.5 py-1.5 ${
                    lang === l
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                  aria-label={`${t('langToggle', lang)}: ${l.toUpperCase()}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* 로그인/아바타 */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(v => !v)}
                  className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold"
                  aria-label={t('myAccount', lang)}
                >
                  {(user.user_metadata?.full_name as string)?.[0]?.toUpperCase() ?? 'U'}
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-10 w-44 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-50 py-1 text-sm">
                    <a
                      href={`/my/personas?lang=${lang}`}
                      className="block px-4 py-2 text-zinc-200 hover:bg-zinc-700"
                      onClick={() => setShowUserMenu(false)}
                    >
                      {t('myFeedManage', lang)}
                    </a>
                    <a
                      href={`/my/create?lang=${lang}`}
                      className="block px-4 py-2 text-zinc-200 hover:bg-zinc-700"
                      onClick={() => setShowUserMenu(false)}
                    >
                      {t('newFeed', lang)}
                    </a>
                    <hr className="border-zinc-700 my-1" />
                    <button
                      onClick={async () => {
                        const supabase = createClient()
                        await supabase.auth.signOut()
                        setShowUserMenu(false)
                      }}
                      className="w-full text-left px-4 py-2 text-zinc-400 hover:bg-zinc-700"
                    >
                      {t('signOut', lang)}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <a
                href={`/login?lang=${lang}`}
                className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                {t('login', lang)}
              </a>
            )}
          </div>
        </div>

        {/* 페르소나 선택 버튼 */}
        <button
          onClick={() => setShowPersonaSheet(true)}
          className="w-full flex items-center justify-between gap-2
                     bg-zinc-800 border border-zinc-700 hover:border-zinc-500
                     text-sm text-zinc-100 rounded-lg px-3 py-1.5
                     transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-500"
          aria-label={t('selectPersona', lang)}
        >
          <span className="truncate">{getPersonaName(currentPersona, lang)}</span>
          <svg className="shrink-0 text-zinc-400" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </header>

      {/* 상태 바 */}
      {videos.length > 0 && (
        <div className="px-4 py-2 text-xs text-zinc-400 border-b border-zinc-800">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span>
              {getPersonaName(currentPersona, lang)} · {(LABELS.accumulated[lang] as (n: number) => string)(total)}
            </span>
            <span className="text-zinc-600">
              {(LABELS.showing[lang] as (n: number, total: number) => string)(videos.length, total)}
            </span>
          </div>
          {viewStats && (
            <div className="mt-0.5 text-zinc-500">
              {(LABELS.viewCount[lang] as (w: number, t: number) => string)(viewStats.weekly, viewStats.total)}
            </div>
          )}
        </div>
      )}

      {/* 오너 전용 영상 추가 버튼 */}
      {isOwner && currentPersona.id.startsWith('u_') && (
        <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500">
            {total}/500
          </span>
          {total >= 500 ? (
            <p className="text-xs text-amber-500">
              {{ ko: '500개 한도 도달 — 오래된 영상 삭제 후 추가 가능', en: '500 limit reached — delete older videos first', ja: '500件上限 — 古い動画を削除してから追加可能' }[lang]}
            </p>
          ) : (
            <button
              onClick={() => setAddVideoOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {{ ko: 'YouTube 링크 추가', en: 'Add YouTube Link', ja: 'YouTubeリンクを追加' }[lang]}
            </button>
          )}
        </div>
      )}

      {/* 초기 로딩 스피너 */}
      {isInitialLoading && (
        <div className="flex items-center justify-center py-32 gap-2 text-zinc-500 text-sm">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {t('loading', lang)}
        </div>
      )}

      {/* 피드 없음 — fetch 완료 후 실제로 영상 0개일 때만 */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-zinc-500 text-sm">
          {isOwner && currentPersona.id.startsWith('u_') ? (
            <>
              <p>{{ ko: '아직 추가된 영상이 없습니다.', en: 'No videos yet.', ja: 'まだ動画がありません。' }[lang]}</p>
              <button
                onClick={() => setAddVideoOpen(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {{ ko: 'YouTube 링크 추가하기', en: 'Add YouTube Link', ja: 'YouTubeリンクを追加する' }[lang]}
              </button>
            </>
          ) : (
            t('noFeed', lang)
          )}
        </div>
      )}

      {/* 피드 그리드 */}
      {!isInitialLoading && videos.length > 0 && (
        <main
          className="px-6 py-6 max-w-7xl mx-auto"
          style={{
            opacity: contentReady ? 1 : 0,
            transition: contentReady ? 'opacity 300ms ease' : 'none',
          }}
        >
          {/* Shorts 캐로셀 — 수평 스크롤, 최신 콘텐츠가 왼쪽 */}
          <ShortsCarousel
            shorts={shorts}
            lang={lang}
            playingId={shortPlayId}
            onPlay={handleShortsPlay}
            isMobile={!supportsHover}
            hasMore={shortsHasMore}
            onLoadMore={loadMoreShorts}
            onStopAll={stopAllPlayback}
            onCardClick={handleShortsClick}
          />

          {videos.length === 0 && !navigating && (
            <p className="text-zinc-500 text-sm text-center py-16">{t('noResults', lang)}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video, idx) => (
              <VideoCard
                key={video.video_id}
                video={video}
                idx={idx}
                lang={lang}
                today={today}
                isPlaying={regularPlayId === video.video_id}
                isHovered={hoveredId === video.video_id}
                personaId={currentPersona.id}
                isOwner={isOwner}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onVideoClick={handleVideoClick}
                onDelete={handleVideoDelete}
              />
            ))}
          </div>

          {/* 무한 스크롤 sentinel — 항상 DOM에 유지해야 Observer가 작동함
               hasMore 조건부 렌더링 시: hasMore=false → sentinel 미마운트 → Observer 미설정
               → hasMore=true가 돼도 Observer가 재실행 안 됨 → Read More 영구 불작동 */}
          <div ref={sentinelRef} className="flex justify-center py-8">
            {isLoading && hasMore && (
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {t('loading', lang)}
              </div>
            )}
          </div>
        </main>
      )}

      {/* 피드백 플로팅 버튼 */}
      <button
        onClick={() => {
          gtag('feedback_click', { persona_id: currentPersona.id, lang })
          setShowFeedback(true)
        }}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-4 py-2.5 rounded-full shadow-lg border border-zinc-700 transition-colors"
        aria-label={t('feedback', lang)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.83L3 20l1.09-3.27C3.4 15.46 3 13.77 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {t('feedback', lang)}
      </button>

      {/* 피드백 모달 */}
      {showFeedback && (
        <FeedbackModal
          lang={lang}
          personaId={currentPersona.id}
          personaName={currentPersona.name}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {showPersonaSheet && (
        <PersonaBottomSheet
          personas={allPersonas}
          currentId={currentPersona.id}
          lang={lang}
          myPersonaIds={myPersonaIds}
          onSelect={switchPersona}
          onClose={() => setShowPersonaSheet(false)}
        />
      )}

      {/* 영상 추가 모달 */}
      {addVideoOpen && (
        <AddVideoModal
          lang={lang}
          personaId={currentPersona.id}
          onClose={() => setAddVideoOpen(false)}
          onAdded={handleVideoAdded}
        />
      )}

      {/* 쿠키 배너 — lang 상태를 직접 전달해 정확한 언어로 표시 */}
      <CookieBanner lang={lang} />

      {/* 약관 동의 모달 — 로그인 유저 최초 또는 약관 변경 시 표시 */}
      {showTerms && (
        <TermsModal lang={lang} onAgree={() => setShowTerms(false)} />
      )}
    </>
  )
}
