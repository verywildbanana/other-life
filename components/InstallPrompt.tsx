'use client'

/**
 * InstallPrompt — 홈 화면 추가 안내 컴포넌트
 *
 * Android (Chrome): beforeinstallprompt 이벤트 캐치 → 버튼 클릭 시 네이티브 설치 팝업
 * iOS (Safari):     자동 팝업 불가 → 수동 안내 모달 (공유 → 홈 화면에 추가)
 * 이미 설치됨:      display:standalone 감지 → 아무것도 표시 안 함
 */

import { useState, useEffect } from 'react'

type Platform = 'android' | 'ios' | 'other'
type Lang = 'ko' | 'en' | 'ja'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// ── 다국어 텍스트 ─────────────────────────────────────────────────────────────
const LABELS = {
  // 안드로이드 플로팅 버튼
  installBtn: {
    ko: '홈 화면에 추가',
    en: 'Add to Home Screen',
    ja: 'ホーム画面に追加',
  },
  // iOS 안내 모달 제목
  iosTitle: {
    ko: '홈 화면에 추가하는 방법',
    en: 'Add to Home Screen',
    ja: 'ホーム画面への追加方法',
  },
  // iOS 안내 단계
  iosStep1: {
    ko: '하단 공유 버튼(⬆)을 탭하세요',
    en: 'Tap the Share button (⬆) at the bottom',
    ja: '下部の共有ボタン（⬆）をタップ',
  },
  iosStep2: {
    ko: '"홈 화면에 추가"를 선택하세요',
    en: 'Select "Add to Home Screen"',
    ja: '「ホーム画面に追加」を選択',
  },
  iosNote: {
    ko: 'Safari에서만 가능합니다 (Chrome·Firefox 불가)',
    en: 'Only available in Safari (not Chrome/Firefox)',
    ja: 'Safariのみ対応（Chrome・Firefoxは不可）',
  },
  close: {
    ko: '닫기',
    en: 'Close',
    ja: '閉じる',
  },
}

function t(key: keyof typeof LABELS, lang: Lang): string {
  return LABELS[key][lang] ?? LABELS[key]['ko']
}

// ── iOS 안내 모달 ─────────────────────────────────────────────────────────────
function IosGuideModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center px-4 pb-6">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-5 shadow-2xl">
        <h3 className="text-sm font-semibold text-zinc-100 mb-4">
          {t('iosTitle', lang)}
        </h3>

        <ol className="space-y-3 mb-4">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-700 text-zinc-200 text-xs flex items-center justify-center font-bold">
              1
            </span>
            <span className="text-sm text-zinc-300 pt-0.5">{t('iosStep1', lang)}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-700 text-zinc-200 text-xs flex items-center justify-center font-bold">
              2
            </span>
            <span className="text-sm text-zinc-300 pt-0.5">{t('iosStep2', lang)}</span>
          </li>
        </ol>

        {/* iOS Safari 시각적 힌트 */}
        <div className="flex items-center justify-center gap-2 bg-zinc-800 rounded-xl py-3 mb-4">
          {/* 공유 아이콘 */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          <span className="text-xs text-zinc-400">⬆ Share</span>
          <span className="text-zinc-600">→</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-zinc-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span className="text-xs text-zinc-300">Add to Home</span>
        </div>

        <p className="text-xs text-zinc-500 text-center mb-4">
          {t('iosNote', lang)}
        </p>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-sm text-zinc-200 transition-colors"
        >
          {t('close', lang)}
        </button>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function InstallPrompt({ lang = 'ko' }: { lang?: Lang }) {
  const [platform, setPlatform] = useState<Platform>('other')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // 이미 standalone(앱)으로 실행 중이면 숨김
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    // 이번 세션에 이미 닫았으면 숨김
    if (sessionStorage.getItem('pwa-prompt-dismissed')) {
      setDismissed(true)
      return
    }

    // 플랫폼 감지
    const ua = navigator.userAgent
    const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream
    const isAndroid = /Android/.test(ua)
    setPlatform(isIos ? 'ios' : isAndroid ? 'android' : 'other')

    // Android: beforeinstallprompt 이벤트 캐치
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // 앱 설치 완료 감지
    window.addEventListener('appinstalled', () => setInstalled(true))

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-prompt-dismissed', '1')
    setDismissed(true)
  }

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
  }

  // 숨김 조건
  if (installed || dismissed) return null

  // Android — beforeinstallprompt 이벤트가 왔을 때만 버튼 표시
  if (platform === 'android' && deferredPrompt) {
    return (
      <button
        onClick={handleAndroidInstall}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-4 py-2.5 rounded-full shadow-lg border border-zinc-700 transition-colors"
        aria-label={t('installBtn', lang)}
      >
        {/* 홈 아이콘 */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        {t('installBtn', lang)}
        {/* 닫기 */}
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); handleDismiss() }}
          className="ml-1 text-zinc-400 hover:text-zinc-200"
          aria-label="닫기"
        >
          ✕
        </span>
      </button>
    )
  }

  // iOS — Safari인지 확인 후 안내 버튼 표시
  if (platform === 'ios') {
    // iOS Chrome/Firefox는 홈 화면 추가 불가 → 숨김
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (!isSafari) return null

    return (
      <>
        <button
          onClick={() => setShowIosGuide(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-4 py-2.5 rounded-full shadow-lg border border-zinc-700 transition-colors"
          aria-label={t('installBtn', lang)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          {t('installBtn', lang)}
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); handleDismiss() }}
            className="ml-1 text-zinc-400 hover:text-zinc-200"
            aria-label="닫기"
          >
            ✕
          </span>
        </button>

        {showIosGuide && (
          <IosGuideModal lang={lang} onClose={() => setShowIosGuide(false)} />
        )}
      </>
    )
  }

  return null
}
