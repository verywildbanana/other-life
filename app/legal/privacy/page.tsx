'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Lang = 'ko' | 'en' | 'ja'

const content: Record<Lang, { title: string; updated: string; sections: { heading: string; body: string | string[] }[]; contact: string }> = {
  ko: {
    title: '개인정보처리방침',
    updated: '최종 수정: 2026년 5월 17일',
    contact: '개인정보 보호 책임자: verywildbanana@gmail.com',
    sections: [
      { heading: '1. 수집하는 개인정보', body: ['Google OAuth 인증 시: 이메일 주소, 이름, 프로필 사진 URL', '서비스 이용 시: 접속 IP 해시, 국가, 페르소나 조회 기록', '유저 생성 콘텐츠: 닉네임, 생성한 페르소나, 추가한 YouTube 링크'] },
      { heading: '2. 수집 목적', body: ['회원 인증 및 서비스 제공', '서비스 품질 향상 및 어뷰징 방지', '중요 공지사항 전달 (이메일)'] },
      { heading: '3. 보유 기간', body: '회원 탈퇴 요청 시 30일 이내 모든 개인정보를 삭제합니다. 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.' },
      { heading: '4. 제3자 제공', body: '수집한 개인정보는 제3자에게 제공하거나 판매하지 않습니다. 서비스 운영을 위한 인프라 제공자(Supabase, Vercel)에게 필요 최소 범위에서 위탁됩니다.' },
      { heading: '5. 쿠키', body: '서비스는 세션 유지 및 서비스 분석을 위해 쿠키를 사용합니다. 브라우저 설정에서 쿠키를 거부할 수 있으나, 일부 기능이 제한될 수 있습니다.' },
      { heading: '6. 이용자 권리', body: '개인정보 열람, 수정, 삭제를 요청할 수 있습니다. 아래 이메일로 문의해주세요.' },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: May 17, 2026',
    contact: 'Privacy contact: verywildbanana@gmail.com',
    sections: [
      { heading: '1. Information We Collect', body: ['Upon Google OAuth authentication: email address, name, profile picture URL', 'During service use: hashed IP address, country, persona view history', 'User-generated content: nickname, created personas, added YouTube links'] },
      { heading: '2. Purpose of Collection', body: ['Member authentication and service provision', 'Service quality improvement and abuse prevention', 'Delivery of important notices (via email)'] },
      { heading: '3. Retention Period', body: 'All personal information will be deleted within 30 days of a withdrawal request. Data required to be retained by law will be kept for the legally required period.' },
      { heading: '4. Third-Party Sharing', body: 'We do not provide or sell collected personal information to third parties. Infrastructure providers (Supabase, Vercel) receive only the minimum data necessary for service operation.' },
      { heading: '5. Cookies', body: 'The service uses cookies for session management and analytics. You may disable cookies in your browser settings, though some features may be limited.' },
      { heading: '6. Your Rights', body: 'You may request access to, correction of, or deletion of your personal information. Please contact us at the email address below.' },
    ],
  },
  ja: {
    title: 'プライバシーポリシー',
    updated: '最終更新：2026年5月17日',
    contact: '個人情報保護責任者：verywildbanana@gmail.com',
    sections: [
      { heading: '1. 収集する個人情報', body: ['Google OAuth認証時：メールアドレス、氏名、プロフィール画像URL', 'サービス利用時：アクセスIPハッシュ、国、ペルソナ閲覧履歴', 'ユーザー生成コンテンツ：ニックネーム、作成したペルソナ、追加したYouTubeリンク'] },
      { heading: '2. 収集目的', body: ['会員認証およびサービス提供', 'サービス品質向上および不正利用防止', '重要なお知らせの配信（メール）'] },
      { heading: '3. 保有期間', body: '退会申請から30日以内にすべての個人情報を削除します。法令により保存が必要な場合は、該当期間保管します。' },
      { heading: '4. 第三者提供', body: '収集した個人情報を第三者に提供・販売することはありません。サービス運営に必要なインフラ提供者（Supabase、Vercel）には必要最小限の範囲で委託されます。' },
      { heading: '5. クッキー', body: 'サービスはセッション維持およびサービス分析のためにクッキーを使用します。ブラウザ設定でクッキーを拒否できますが、一部の機能が制限される場合があります。' },
      { heading: '6. 利用者の権利', body: '個人情報の閲覧・修正・削除を申請できます。下記メールアドレスまでお問い合わせください。' },
    ],
  },
}

function PrivacyContent() {
  const params = useSearchParams()
  const lang = (['ko', 'en', 'ja'].includes(params.get('lang') ?? '') ? params.get('lang') : 'ko') as Lang
  const c = content[lang]

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-300 px-6 py-12 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">{c.title}</h1>
        <div className="flex gap-1">
          {(['ko', 'en', 'ja'] as Lang[]).map(l => (
            <a key={l} href={`?lang=${l}`} className={`text-xs px-2 py-0.5 rounded transition-colors ${lang === l ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {l.toUpperCase()}
            </a>
          ))}
        </div>
      </div>
      <p className="text-zinc-500 text-sm">{c.updated}</p>
      {c.sections.map(s => (
        <section key={s.heading} className="space-y-3">
          <h2 className="text-white font-semibold">{s.heading}</h2>
          {Array.isArray(s.body)
            ? <ul className="text-sm leading-relaxed list-disc list-inside space-y-1">{s.body.map(b => <li key={b}>{b}</li>)}</ul>
            : <p className="text-sm leading-relaxed">{s.body}</p>
          }
        </section>
      ))}
      <p className="text-zinc-600 text-xs pt-4">{c.contact}</p>
    </main>
  )
}

export default function PrivacyPage() {
  return <Suspense><PrivacyContent /></Suspense>
}
