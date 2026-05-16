import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '개인정보처리방침 | Anomess',
  robots: { index: false },
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-300 px-6 py-12 max-w-2xl mx-auto space-y-6">
      <h1 className="text-white text-2xl font-bold">개인정보처리방침</h1>
      <p className="text-zinc-500 text-sm">최종 수정: 2026년 5월 17일</p>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">1. 수집하는 개인정보</h2>
        <ul className="text-sm leading-relaxed list-disc list-inside space-y-1">
          <li>Google OAuth 인증 시: 이메일 주소, 이름, 프로필 사진 URL</li>
          <li>서비스 이용 시: 접속 IP 해시, 국가, 페르소나 조회 기록</li>
          <li>유저 생성 콘텐츠: 닉네임, 생성한 페르소나, 추가한 YouTube 링크</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">2. 수집 목적</h2>
        <ul className="text-sm leading-relaxed list-disc list-inside space-y-1">
          <li>회원 인증 및 서비스 제공</li>
          <li>서비스 품질 향상 및 어뷰징 방지</li>
          <li>중요 공지사항 전달 (이메일)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">3. 보유 기간</h2>
        <p className="text-sm leading-relaxed">
          회원 탈퇴 요청 시 30일 이내 모든 개인정보를 삭제합니다.
          법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">4. 제3자 제공</h2>
        <p className="text-sm leading-relaxed">
          수집한 개인정보는 제3자에게 제공하거나 판매하지 않습니다.
          서비스 운영을 위한 인프라 제공자(Supabase, Vercel)에게 필요 최소 범위에서
          위탁됩니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">5. 쿠키</h2>
        <p className="text-sm leading-relaxed">
          서비스는 세션 유지 및 서비스 분석을 위해 쿠키를 사용합니다.
          브라우저 설정에서 쿠키를 거부할 수 있으나, 일부 기능이 제한될 수 있습니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-white font-semibold">6. 이용자 권리</h2>
        <p className="text-sm leading-relaxed">
          개인정보 열람, 수정, 삭제를 요청할 수 있습니다.
          아래 이메일로 문의해주세요.
        </p>
      </section>

      <p className="text-zinc-600 text-xs pt-4">
        개인정보 보호 책임자: verywildbanana@gmail.com
      </p>
    </main>
  )
}
