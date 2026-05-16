import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '이용약관 | Anomess',
  robots: { index: false },
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-300 px-6 py-12 max-w-2xl mx-auto space-y-6">
      <h1 className="text-white text-2xl font-bold">이용약관</h1>
      <p className="text-zinc-500 text-sm">최종 수정: 2026년 5월 17일</p>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">제1조 (목적)</h2>
        <p className="text-sm leading-relaxed">
          본 약관은 Anomess(이하 "서비스")가 제공하는 YouTube 피드 큐레이션 서비스의
          이용에 관한 조건 및 절차 등을 규정함을 목적으로 합니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">제2조 (이용 자격)</h2>
        <p className="text-sm leading-relaxed">
          서비스는 만 14세 이상 누구나 이용할 수 있습니다. 만 14세 미만은 서비스에
          가입하거나 유저 페르소나를 생성할 수 없습니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">제3조 (서비스 내용)</h2>
        <p className="text-sm leading-relaxed">
          서비스는 다양한 페르소나의 YouTube 피드를 탐색하고, 로그인 후 자신만의
          유저 페르소나를 최대 3개까지 생성·공유할 수 있는 기능을 제공합니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">제4조 (유저 페르소나 및 콘텐츠)</h2>
        <p className="text-sm leading-relaxed">
          유저가 생성한 페르소나에 72시간 이상 아무런 업데이트(영상 추가)가 없는 경우,
          운영자에게 검토 알림이 전송되며 운영자 판단에 따라 해당 페르소나가 삭제될 수
          있습니다. 삭제 전 이메일로 안내가 제공됩니다. 부적절한 콘텐츠(스팸, 혐오,
          저작권 침해 등)가 포함된 페르소나는 사전 통보 없이 즉시 삭제될 수 있습니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">제5조 (금지 행위)</h2>
        <ul className="text-sm leading-relaxed list-disc list-inside space-y-1">
          <li>타인을 사칭하거나 허위 정보를 등록하는 행위</li>
          <li>서비스를 자동화 도구로 남용하는 행위</li>
          <li>저작권이 있는 콘텐츠를 무단으로 공유하는 행위</li>
          <li>혐오·폭력·음란물 등 불법·유해 콘텐츠를 게시하는 행위</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">제6조 (계정 정지 및 해지)</h2>
        <p className="text-sm leading-relaxed">
          운영자는 금지 행위 위반 시 사전 경고 없이 계정을 정지하거나 해지할 수 있습니다.
          이용자는 언제든지 서비스 탈퇴를 요청할 수 있으며, 탈퇴 시 관련 데이터는
          30일 내 삭제됩니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">제7조 (면책)</h2>
        <p className="text-sm leading-relaxed">
          서비스는 YouTube 링크를 큐레이션하는 플랫폼으로, 링크된 영상의 내용에 대해
          책임을 지지 않습니다. 서비스는 YouTube의 공개 영상만 참조하며 저작권 침해를
          목적으로 하지 않습니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">제8조 (약관 변경)</h2>
        <p className="text-sm leading-relaxed">
          본 약관은 사전 공지 후 변경될 수 있습니다. 중요 변경 사항은 서비스 내 공지
          또는 이메일로 안내합니다.
        </p>
      </section>

      <p className="text-zinc-600 text-xs pt-4">
        문의: verywildbanana@gmail.com
      </p>
    </main>
  )
}
