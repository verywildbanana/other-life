'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Lang = 'ko' | 'en' | 'ja'

const content: Record<Lang, { title: string; updated: string; articles: { heading: string; body: string | string[] }[] }> = {
  ko: {
    title: '이용약관',
    updated: '최종 수정: 2026년 5월 17일',
    articles: [
      { heading: '제1조 (목적)', body: 'Anomess(이하 "서비스")가 제공하는 YouTube 피드 큐레이션 서비스의 이용에 관한 조건 및 절차 등을 규정함을 목적으로 합니다.' },
      { heading: '제2조 (이용 자격)', body: '서비스는 만 14세 이상 누구나 이용할 수 있습니다. 만 14세 미만은 서비스에 가입하거나 유저 페르소나를 생성할 수 없습니다.' },
      { heading: '제3조 (서비스 내용)', body: '서비스는 다양한 페르소나의 YouTube 피드를 탐색하고, 로그인 후 자신만의 유저 페르소나를 최대 3개까지 생성·공유할 수 있는 기능을 제공합니다.' },
      { heading: '제4조 (유저 페르소나 및 콘텐츠)', body: '유저가 생성한 페르소나에 72시간 이상 아무런 업데이트(영상 추가)가 없는 경우, 운영자에게 검토 알림이 전송되며 운영자 판단에 따라 해당 페르소나가 삭제될 수 있습니다. 삭제 전 이메일로 안내가 제공됩니다. 부적절한 콘텐츠(스팸, 혐오, 저작권 침해 등)가 포함된 페르소나는 사전 통보 없이 즉시 삭제될 수 있습니다.' },
      { heading: '제5조 (금지 행위)', body: ['타인을 사칭하거나 허위 정보를 등록하는 행위', '서비스를 자동화 도구로 남용하는 행위', '저작권이 있는 콘텐츠를 무단으로 공유하는 행위', '혐오·폭력·음란물 등 불법·유해 콘텐츠를 게시하는 행위'] },
      { heading: '제6조 (계정 정지 및 해지)', body: '운영자는 금지 행위 위반 시 사전 경고 없이 계정을 정지하거나 해지할 수 있습니다. 이용자는 언제든지 서비스 탈퇴를 요청할 수 있으며, 탈퇴 시 관련 데이터는 30일 내 삭제됩니다.' },
      { heading: '제7조 (면책)', body: '서비스는 YouTube 링크를 큐레이션하는 플랫폼으로, 링크된 영상의 내용에 대해 책임을 지지 않습니다. 서비스는 YouTube의 공개 영상만 참조하며 저작권 침해를 목적으로 하지 않습니다.' },
      { heading: '제8조 (약관 변경)', body: '본 약관은 사전 공지 후 변경될 수 있습니다. 중요 변경 사항은 서비스 내 공지 또는 이메일로 안내합니다.' },
    ],
  },
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: May 17, 2026',
    articles: [
      { heading: 'Article 1 (Purpose)', body: 'These terms govern the conditions and procedures for using the YouTube feed curation service provided by Anomess (hereinafter "the Service").' },
      { heading: 'Article 2 (Eligibility)', body: 'The Service is available to anyone aged 14 or older. Users under 14 may not register or create user personas.' },
      { heading: 'Article 3 (Service Description)', body: 'The Service allows users to explore YouTube feeds of various personas and, after logging in, to create and share up to 3 personal user personas.' },
      { heading: 'Article 4 (User Personas and Content)', body: 'If a user-created persona goes 72 hours or more without any update (video addition), a review notification will be sent to the operator, who may delete the persona at their discretion. Email notice will be provided before deletion. Personas containing inappropriate content (spam, hate speech, copyright infringement, etc.) may be deleted immediately without prior notice.' },
      { heading: 'Article 5 (Prohibited Activities)', body: ['Impersonating others or registering false information', 'Abusing the service with automated tools', 'Sharing copyrighted content without authorization', 'Posting illegal or harmful content including hate speech, violence, or obscenity'] },
      { heading: 'Article 6 (Account Suspension and Termination)', body: 'The operator may suspend or terminate an account without prior warning for violations. Users may request withdrawal at any time; related data will be deleted within 30 days.' },
      { heading: 'Article 7 (Disclaimer)', body: 'The Service curates YouTube links and is not responsible for the content of linked videos. The Service references only publicly available YouTube videos and does not intend to infringe on any copyrights.' },
      { heading: 'Article 8 (Changes to Terms)', body: 'These terms may be amended with prior notice. Important changes will be announced via in-service notice or email.' },
    ],
  },
  ja: {
    title: '利用規約',
    updated: '最終更新：2026年5月17日',
    articles: [
      { heading: '第1条（目的）', body: '本規約は、Anomess（以下「サービス」）が提供するYouTubeフィードキュレーションサービスの利用に関する条件および手続き等を定めることを目的とします。' },
      { heading: '第2条（利用資格）', body: 'サービスは14歳以上であれば誰でも利用できます。14歳未満の方はサービスへの登録またはユーザーペルソナの作成はできません。' },
      { heading: '第3条（サービス内容）', body: 'サービスは、様々なペルソナのYouTubeフィードを探索し、ログイン後に自分だけのユーザーペルソナを最大3つまで作成・共有する機能を提供します。' },
      { heading: '第4条（ユーザーペルソナおよびコンテンツ）', body: 'ユーザーが作成したペルソナに72時間以上何もアップデート（動画追加）がない場合、運営者に確認通知が送信され、運営者の判断によりペルソナが削除される場合があります。削除前にメールでご案内します。不適切なコンテンツ（スパム、ヘイト、著作権侵害等）を含むペルソナは、事前通知なく即時削除される場合があります。' },
      { heading: '第5条（禁止行為）', body: ['他者を詐称したり虚偽情報を登録する行為', 'サービスを自動化ツールで不正利用する行為', '著作権のあるコンテンツを無断で共有する行為', 'ヘイト・暴力・わいせつ物等の違法・有害コンテンツを投稿する行為'] },
      { heading: '第6条（アカウント停止および解約）', body: '運営者は禁止行為違反時、事前警告なくアカウントを停止または解約できます。利用者はいつでもサービスからの退会を申請でき、退会時の関連データは30日以内に削除されます。' },
      { heading: '第7条（免責）', body: 'サービスはYouTubeリンクをキュレーションするプラットフォームであり、リンクされた動画の内容については責任を負いません。サービスはYouTubeの公開動画のみを参照し、著作権侵害を目的とするものではありません。' },
      { heading: '第8条（規約の変更）', body: '本規約は事前告知の上変更される場合があります。重要な変更はサービス内通知またはメールでお知らせします。' },
    ],
  },
}

function TermsContent() {
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
      {c.articles.map(a => (
        <section key={a.heading} className="space-y-3">
          <h2 className="text-white font-semibold">{a.heading}</h2>
          {Array.isArray(a.body)
            ? <ul className="text-sm leading-relaxed list-disc list-inside space-y-1">{a.body.map(b => <li key={b}>{b}</li>)}</ul>
            : <p className="text-sm leading-relaxed">{a.body}</p>
          }
        </section>
      ))}
      <p className="text-zinc-600 text-xs pt-4">Contact: verywildbanana@gmail.com</p>
    </main>
  )
}

export default function TermsPage() {
  return <Suspense><TermsContent /></Suspense>
}
