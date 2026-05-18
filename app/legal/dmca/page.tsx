import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DMCA | Anomess',
  robots: { index: false },
}

export default function DmcaPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-300 px-6 py-12 max-w-2xl mx-auto space-y-6">
      <h1 className="text-white text-2xl font-bold">DMCA 저작권 침해 신고</h1>

      <p className="text-sm leading-relaxed">
        Anomess는 YouTube의 공개 영상 링크를 큐레이션하는 서비스로,
        영상 콘텐츠를 직접 호스팅하지 않습니다. 모든 영상은 YouTube에서 재생됩니다.
      </p>

      <p className="text-sm leading-relaxed">
        YouTube의 영상에 대한 저작권 침해 신고는{' '}
        <a
          href="https://www.youtube.com/copyright_complaint_form"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white"
        >
          YouTube 저작권 신고 센터
        </a>
        를 이용해주세요.
      </p>

      <p className="text-sm leading-relaxed">
        Anomess 서비스 자체(페르소나 소개 텍스트 등)에 대한 저작권 침해 신고는
        아래 이메일로 연락해주세요. DMCA 신고 서한에는 다음 내용을 포함해야 합니다:
      </p>

      <ul className="text-sm leading-relaxed list-disc list-inside space-y-1">
        <li>저작권자(또는 대리인)의 전자 서명 또는 물리적 서명</li>
        <li>침해된 저작물에 대한 설명</li>
        <li>침해가 의심되는 자료의 URL</li>
        <li>연락처 정보(이름, 주소, 전화번호, 이메일)</li>
        <li>해당 자료 사용이 저작권자, 그 대리인, 또는 법률에 의해 허가되지 않았다는 선의의 신념 선언</li>
        <li>위 정보가 정확하며 위증 시 처벌을 감수한다는 선언</li>
      </ul>

      <p className="text-zinc-600 text-xs pt-4">
        DMCA 문의: verywildbanana@gmail.com
      </p>
    </main>
  )
}
