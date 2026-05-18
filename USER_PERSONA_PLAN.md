# 유저 페르소나 기능 — 단계별 실행 체크리스트 (v4)

## 상태: 구현 대기
플랜 파일: `persona-feed-web/USER_PERSONA_PLAN.md`
브랜치 전략 준수: 모든 코드는 `dev` 브랜치, 사용자 OK 후 `release`→`main`

---

## Context

현재 Anomess는 12개 고정 시스템 페르소나만 존재. 유저가 직접 페르소나를 만들고 YouTube 링크를 추가하면 콘텐츠 규모가 확장된다. 다만 **비로그인 사용자에게 로그인을 강제하지 않고**, **자동 삭제는 위험하므로 어드민 검토 큐로 전환**한다.

핵심 정책 요약:
- 로그인은 페르소나 생성/편집 시점에만 요구 — 모든 피드는 비로그인 열람 가능
- 페르소나 한도 유저당 3개
- 72시간 무활동 → 자동 삭제 X → **어드민 알림 + 검토 큐** (이메일 + Telegram)
- 신고도 같은 큐로 수렴
- 약관/개인정보/DMCA 페이지 + 14세 확인 + 쿠키 옵트인 등 법적 의무 충족

---

## 실행 원칙

각 단계마다 다음 3가지를 명시:
- **왜**: 그 단계가 필요한 이유 (생략 시 어떤 문제)
- **무엇을**: 구체적 작업 내용
- **검증**: 다음 단계로 넘어가기 전 확인할 항목

각 Phase 종료 시점에 `dev` 브랜치에 푸시 → 사용자 OK 받은 후에만 다음 Phase 시작.

---

# Phase 1 — 인증 기반 (비강제 로그인)

> **목표**: 비로그인 사용자는 그대로 두고, 페르소나 생성 시점에만 로그인을 요구. 세션은 쿠키로 자동 유지.

## 1-1. Supabase Auth Google OAuth 설정 (대시보드 수동)
- **왜**: Auth 없이는 유저 식별 불가. Google OAuth만 쓰는 이유는 가입 마찰 최소화 + 이메일 검증 자동.
- **무엇을**: Supabase 대시보드 → Authentication → Providers → Google 활성화 + Google Cloud Console에서 OAuth client 생성 → callback URL `https://feed.anomess.com/auth/callback` + `http://localhost:3000/auth/callback` 등록
- **검증**: Supabase 대시보드에서 Google provider Enabled 표시 / client_id, secret 입력 완료

## 1-2. `lib/auth.ts` — Supabase 서버 클라이언트 헬퍼
- **왜**: 라우트마다 클라이언트를 새로 만들면 쿠키 동기화가 깨짐. `@supabase/ssr` 패턴 일관 적용.
- **무엇을**: `createServerClient()` 기반 `getUser()`, `requireUser()` 헬퍼. cookies() 통합. service_role 클라이언트는 별도 분리.
- **검증**: `import { getUser } from '@/lib/auth'` 정상 / Edge runtime에서도 에러 없음

## 1-3. `app/auth/callback/route.ts`
- **왜**: OAuth 응답을 받아 세션 쿠키를 굽고, 원래 페이지로 돌려보내야 함. redirect 검증 안 하면 open redirect 취약점.
- **무엇을**: code → session 교환 + `redirect` 쿼리 파라미터 읽기 + **같은 도메인만 허용** 검증 후 리다이렉트. user_profiles 없으면 `/onboarding`으로.
- **검증**: 로그인 직후 콜백 → user_profiles row 있으면 redirect 그대로 / 없으면 `/onboarding` / 외부 도메인 redirect 시도 시 `/` 로 강제 이동

## 1-4. `app/login/page.tsx`
- **왜**: 페르소나 만들기 클릭 시 진입할 단일 진입점.
- **무엇을**: "Google로 계속하기" 단일 버튼. `?redirect=` 그대로 전달.
- **검증**: `/login?redirect=/my/create` 접속 → 로그인 → /my/create 도착

## 1-5. `app/onboarding/page.tsx`
- **왜**: 첫 로그인 시 닉네임 + 약관 동의 + 14세 확인이 없으면 법적 의무 위반. 한 번만 수행.
- **무엇을**: 닉네임 입력 + [약관 동의(필수)] [개인정보 수집 동의(필수)] [만 14세 이상(필수)] [쿠키-분석 동의(선택)] 체크박스 → POST `/api/user/profile` → user_profiles INSERT + `tos_version` 기록 → 원래 redirect 경로 복귀
- **검증**: 첫 로그인 → onboarding 노출 / 동의 후 다시 로그인 → onboarding 스킵 / 약관 버전 환경변수 올리면 재진입

## 1-6. `middleware.ts` 통합
- **왜**: Supabase 토큰 자동 갱신(access 1h→refresh) + banned 유저 차단 + 약관 미동의자 onboarding 강제 필요.
- **무엇을**: `@supabase/ssr` updateSession 호출 + user_profiles 조회 → `banned=true` → `/banned` / `tos_version` 불일치 → `/onboarding`. 기존 `feed_token` 미들웨어 로직과 공존.
- **검증**: 토큰 만료 직전 페이지 새로고침 → 쿠키 자동 갱신 / banned 토글한 유저로 접속 → `/banned`

## 1-7. FeedView 헤더 (비로그인 vs 로그인)
- **왜**: 비로그인 강요 금지. 로그인 상태가 보이지 않으면 본인 페르소나 진입점이 없음.
- **무엇을**: 비로그인 → 작은 텍스트 "로그인" 링크 / 로그인 → 아바타 → 드롭다운 [내 페르소나 / 새 페르소나 만들기 / 알림 설정 / 로그아웃]
- **검증**: 비로그인 상태에서 모든 피드 정상 동작 / 로그인 후 드롭다운 표시

## 1-8. 쿠키 옵트인 배너
- **왜**: GDPR + 한국 정보통신망법 — 분석 쿠키는 사전 동의 필요.
- **무엇을**: 첫 방문 시 하단 배너 [필수 쿠키만 / 모두 허용] → localStorage 저장 → 분석 쿠키(GA4)는 동의 시에만 로드. 로그인 유저는 `user_profiles.cookie_analytics`에도 기록.
- **검증**: 거부 시 GA4 스크립트 미로딩 (Network 탭 확인) / 동의 시 정상 로딩

## 1-9. 법적 정적 페이지 — `/legal/terms`, `/legal/privacy`, `/legal/dmca`
- **왜**: 약관·개인정보처리방침·DMCA 채널은 서비스 운영 법적 의무. onboarding에서 링크 필요.
- **무엇을**: 정적 마크다운 페이지. 약관 버전 명시 (`TOS_VERSION=1.0`). 12개 조항 + 개인정보 항목 + DMCA 신고 양식.
- **검증**: 각 URL 200 응답 / onboarding에서 새 창 열림 / 약관 버전 표시

## 1-10. Phase 1 종합 검증
- [ ] 비로그인 사용자는 기존과 동일하게 모든 피드 열람 가능
- [ ] `/login?redirect=/my/create` → Google 로그인 → onboarding → /my/create 도달
- [ ] 재방문 시 세션 자동 유지 (쿠키 살아 있는 동안)
- [ ] 약관 버전 환경변수 변경 시 다음 접속에 재동의 요구
- [ ] dev 푸시 → 프리뷰 URL 확인 → 사용자 OK 받기

---

# Phase 2 — DB 스키마 + 유저 페르소나 CRUD

> **목표**: 페르소나/영상/프로필/신고/큐/감사로그 모든 테이블 한 번에 생성. 페르소나 CRUD UI 완성.

## 2-1. Supabase SQL 실행 (사용자 직접)
- **왜**: 한 번에 모든 테이블을 만들면 마이그레이션 부담 최소화. RLS 빠뜨리면 보안 사고.
- **무엇을**: 아래 테이블 전체 생성 + 트리거 + 인덱스 + RLS:
  - `user_profiles` (display_name, email_notify, banned, tos_version, age_confirmed, cookie_analytics)
  - `user_personas` (persona_id, name_i18n, description_i18n, is_public, video_count, is_removed, last_activity_at, warning_sent_at, flagged_for_review, flagged_at)
  - `user_videos` (persona_id, video_id, title, channel, url, thumbnail_url, user_intro, is_removed, UNIQUE(persona_id, video_id))
  - `reports` (target_type, target_id, reason, status)
  - `moderation_queue` (reason, target_type, target_id, user_id, detail, status, resolved_by, resolved_at)
  - `audit_logs` (admin_id, action, target_type, target_id, reason)
  - 트리거: video_count 자동 카운터, 3개 페르소나 한도 BEFORE INSERT
- **검증**: Supabase Table Editor에서 6개 테이블 + RLS Enabled 표시 / 한도 트리거 SQL 직접 INSERT 4번째 시도 시 에러 / RLS 비로그인 SELECT 차단 확인

## 2-2. `types/index.ts` 타입 정의
- **왜**: DB row를 그대로 props로 흘리면 컴파일 단계에서 누락 발견 못 함.
- **무엇을**: `UserProfile`, `UserPersona`, `UserVideo`, `Report`, `ModerationQueueItem`, `AuditLog` 타입 추가. 기존 `Persona` 타입에 `kind: 'system' | 'user'` 필드 추가해 분기.
- **검증**: `npm run build` 통과 / 기존 페르소나 컴포넌트가 kind 추론으로 정상 동작

## 2-3. `app/api/user/profile/route.ts`
- **왜**: 닉네임/알림/계정 삭제 통합 엔드포인트. 계정 삭제는 법적 의무.
- **무엇을**: GET(본인 프로필), PATCH(닉네임/email_notify/cookie_analytics 수정), DELETE(auth.users 삭제 → cascade로 모든 데이터 제거). 인증 필수.
- **검증**: PATCH로 alarm OFF → DB 반영 / DELETE → 30초 내 모든 페르소나/영상도 삭제됨 (cascade)

## 2-4. `app/api/user/personas/route.ts` + `[persona_id]/route.ts`
- **왜**: 페르소나 생성/조회/수정/삭제/공개 토글의 단일 진실 소스.
- **무엇을**: POST(생성, 3개 한도 enforce + nanoid6으로 persona_id 생성), GET(내 페르소나 목록), PATCH(name/description/is_public 수정 + `last_activity_at` 갱신), DELETE(본인 페르소나만)
- **검증**: 4번째 페르소나 생성 시 API가 422 반환 / PATCH 시 last_activity_at 갱신 확인 / 타인 페르소나 DELETE → 403

## 2-5. `/my/create` 페이지
- **왜**: 페르소나 생성 진입점. 비로그인 유저는 미들웨어가 `/login`으로 리다이렉트.
- **무엇을**: 폼 — 이름(한/일/영 중 최소 1개 필수), 소개(한/일/영 선택), 공개/비공개 토글 → POST → 성공 시 `/p/u_xxxx` 이동
- **검증**: 1개 언어만 입력해도 생성 성공 / 비공개로 생성 → 다른 유저 접근 시 404

## 2-6. `/my/personas` 페이지
- **왜**: 자기 페르소나를 한눈에 볼 곳이 없으면 관리 불가.
- **무엇을**: 카드 리스트 (이름, 영상 수, last_activity, 공개 여부) → [편집] [공개 토글] [삭제] 버튼
- **검증**: 페르소나 3개 표시 / 삭제 → cascade로 영상도 삭제 / 공개 토글 즉시 반영

## 2-7. `/my/settings` 페이지
- **왜**: 닉네임 변경, 알림 OFF, 계정 삭제 진입점.
- **무엇을**: 닉네임 입력 / email_notify 토글 / cookie_analytics 토글 / [계정 삭제] 버튼 (확인 다이얼로그 필수)
- **검증**: 계정 삭제 누름 → 확인 → 30초 내 로그아웃 + 모든 데이터 사라짐 / GA4 Network에서 확인

## 2-8. Phase 2 종합 검증
- [ ] 페르소나 3개 생성 → 4번째 차단 메시지
- [ ] 공개 → 비공개 → 공개 토글 모두 즉시 반영
- [ ] 계정 삭제 → user_profiles + user_personas + user_videos cascade 삭제 확인
- [ ] RLS: 타 유저 페르소나 직접 SQL SELECT → 비공개면 0 row
- [ ] dev 푸시 → 사용자 OK

---

# Phase 3 — 피드 통합 (시스템 + 유저 페르소나 한 화면)

> **목표**: `u_` prefix만으로 피드 라우팅이 분기되고, 기존 시스템 페르소나는 그대로 동작.

## 3-1. `lib/user-feed.ts`
- **왜**: 시스템 피드(`lib/feed.ts`)와 데이터 소스가 다름 — 분리해야 유지보수 가능.
- **무엇을**: `getPaginatedUserFeed(persona_id, offset, limit)` — user_videos 쿼리 + collected_at DESC + is_removed=false 필터
- **검증**: 단위 테스트 또는 직접 호출 → 페이지네이션 정상

## 3-2. `lib/personas.ts` DB 병합
- **왜**: 페르소나 팝업/홈에서 시스템+유저 페르소나를 동시에 보여줘야 함.
- **무엇을**: 기존 `listPersonas()`가 JSON만 읽던 것을 → JSON + `user_personas` (is_public=true AND is_removed=false AND user_profiles.banned=false) 병합. `kind` 필드로 구분.
- **검증**: 어드민/유저 차단된 페르소나는 목록에서 사라짐 / 시스템 페르소나 12개 + 공개 유저 페르소나 모두 표시

## 3-3. `/api/feed/[persona_id]/route.ts` 분기
- **왜**: 한 라우트로 두 소스를 다 다루지 않으면 prefix별 라우트가 늘어남.
- **무엇을**: `persona_id.startsWith('u_')` → user-feed / 아니면 기존 feed. banned/removed 체크 후 결과 반환.
- **검증**: `/api/feed/wealthy_single_30s` 기존대로 / `/api/feed/u_xxxx` 신규 user_videos 반환

## 3-4. `/p/[persona_id]/page.tsx` 메타데이터
- **왜**: SEO + 공유 미리보기. 비공개는 noindex 강제.
- **무엇을**: generateMetadata에서 DB 페르소나 조회 → name/description으로 title, description, og:image. is_public=false → `<meta name="robots" content="noindex">` 추가.
- **검증**: 공유 시 SNS 미리보기 한국어 제목 표시 / 비공개 URL을 Google에 알려도 noindex 확인

## 3-5. Phase 3 종합 검증
- [ ] `/p/u_xxxx` 빈 피드 정상 렌더링
- [ ] 시스템 페르소나 동작 무변경 (회귀 없음)
- [ ] 비공개 페르소나 다른 유저로 접근 → 404 / 본인 접근 → 정상
- [ ] dev 푸시 → 사용자 OK

---

# Phase 4 — 영상 추가 + 이메일 + Rate Limit

> **목표**: 유저가 YouTube URL을 붙여 넣어 영상을 큐레이팅하고, 피드백은 페르소나 오너 메일로 도착.

## 4-1. `lib/rate-limit.ts`
- **왜**: Vercel Serverless에서 인메모리는 인스턴스 간 공유 안 됨 → 의미 없는 보안. DB 기반 카운터 필수.
- **무엇을**: Supabase `rate_limits` 테이블(`key`, `count`, `window_start`) 또는 기존 `events` 테이블 활용한 카운터. user_id + IP 병행 키.
- **검증**: 분당 10회 초과 시 429 반환 / 다른 유저는 별도 카운트

## 4-2. `app/api/user/videos/route.ts`
- **왜**: oEmbed 호출 + 검증 + 중복 체크 + last_activity_at 갱신 모두 한 곳.
- **무엇을**: YouTube URL 정규식 검증 → oEmbed 호출 → 실패(비공개/삭제/지역제한) 시 명시적 에러 → user_videos INSERT(UNIQUE 위반 시 "이미 추가됨") → user_personas.last_activity_at = now() → warning_sent_at/flagged_for_review 리셋
- **검증**: 같은 URL 두 번 추가 → 두 번째는 409 / 비공개 영상 URL → 400 / 추가 후 페르소나 last_activity_at 즉시 갱신

## 4-3. `app/api/user/videos/[video_id]/route.ts`
- **왜**: 영상 삭제와 user_intro 수정은 분리된 의미. 본인 페르소나 영상만 가능.
- **무엇을**: DELETE(본인 영상만), PATCH(user_intro ko/en/ja 수정 + last_activity_at 갱신)
- **검증**: 타인 영상 DELETE → 403 / PATCH 후 카드 텍스트 즉시 변경

## 4-4. FeedView 영상 추가 UI
- **왜**: 본인 페르소나에서만 노출돼야 함 (다른 사람 피드에 추가 버튼 보이면 혼란).
- **무엇을**: persona.user_id === currentUser.id 일 때만 피드 상단 "+ YouTube 추가" 버튼 노출. 모달 → URL 입력 → oEmbed 미리보기 (썸네일/제목/채널) → user_intro 한/일/영 폼 → 추가
- **검증**: 본인 페르소나에만 버튼 / 추가 즉시 최신 상단에 노출 / 추가 후 즉시 ★/⋯ 메뉴 표시

## 4-5. iframe 에러 핸들링
- **왜**: oEmbed가 성공해도 임베드가 차단된 영상이 있음. 클릭 시 검정 화면이면 UX 파괴.
- **무엇을**: iframe `onerror` 또는 YouTube IFrame API의 error 이벤트 → "이 영상은 임베드 차단됨" 안내 + YouTube 원본으로 이동 버튼
- **검증**: 임베드 차단된 영상 추가 → 카드에 경고 뱃지 표시

## 4-6. 500개 제한 UI
- **왜**: video_count가 500 도달하면 추가 버튼이 작동 안 하는 이유를 유저가 알아야 함.
- **무엇을**: video_count >= 500 시 추가 버튼 비활성 + "오래된 영상을 삭제해야 추가할 수 있어요" 안내 + 오래된 순 영상 목록(체크박스 다중 선택 삭제)
- **검증**: 500 도달 시 안내 노출 / 5개 삭제 후 추가 버튼 재활성

## 4-7. `lib/resend.ts` + 환경변수
- **왜**: 피드백이 와도 오너가 모르면 의미 없음. Telegram은 어드민 전용이라 유저 알림은 이메일.
- **무엇을**: `sendEmail(to, subject, html)` 헬퍼. bounce/complaint 웹훅 처리 → user_profiles.email_notify = false 자동 OFF.
- **검증**: 테스트 이메일 발송 성공 / 잘못된 주소로 발송 → bounce 후 email_notify 자동 OFF

## 4-8. `/api/feedback/route.ts` 분기
- **왜**: 기존 시스템 페르소나 피드백은 DB 저장만, 유저 페르소나는 오너에게 이메일.
- **무엇을**: persona_id가 `u_` 시작 → user_personas 조회 → user_profiles.email_notify=true → Resend 이메일. 별점 + 메시지 포함.
- **검증**: 시스템 피드백 → 이메일 미발송 / 유저 피드백 → 오너 메일 도착 / email_notify OFF 시 미발송

## 4-9. Phase 4 종합 검증
- [ ] 영상 30개 추가 → 분당 11번째는 429
- [ ] 중복 URL → 409
- [ ] 임베드 차단 영상 → 경고 표시
- [ ] 500개 제한 UI 정상
- [ ] 피드백 → 이메일 수신 확인 (verywildbanana 계정으로 테스트)
- [ ] dev 푸시 → 사용자 OK

---

# Phase 5 — 팝업 그리드 + Share + 신고

> **목표**: 페르소나가 많아져도 팝업이 헤비해지지 않도록 그리드 + 탭 + 즐겨찾기로 정리. 공유와 신고 진입.

## 5-1. PersonaBottomSheet 2열 그리드 리팩토링
- **왜**: 페르소나 수가 늘면 단일 스크롤 리스트는 탐색 비용 폭증.
- **무엇을**: 320px 팝업 기준 `grid-cols-2 gap-2`, 카드 약 140×80px. 검색 필터 유지.
- **검증**: 모바일 320px에서 2열 정상 / 터치 타겟 44px 이상

## 5-2. 카드 3종 시각 구분
- **왜**: 내 페르소나/시스템/커뮤니티가 같은 톤이면 식별 비용 발생.
- **무엇을**: 내 페르소나 `bg-indigo-950/60 border-indigo-700` + "내 피드" 뱃지 / 시스템 `bg-zinc-900` / 커뮤니티 `bg-zinc-950 border-zinc-800` + "커뮤니티" 뱃지
- **검증**: 한눈에 구분 가능 (스크린샷 확인)

## 5-3. 즐겨찾기 ★
- **왜**: 자주 보는 페르소나가 멀리 있으면 마찰. localStorage라 로그인 없이도 동작.
- **무엇을**: 카드 우상단 ★ 토글 → `localStorage.feed_favorites` 배열. 팝업 최상단 "⭐ 즐겨찾기" 섹션 노출 (빈 배열이면 섹션 숨김).
- **검증**: 즐겨찾기 추가 후 팝업 재오픈 → 상단 노출 / 브라우저 재시작 후도 유지

## 5-4. 탭 3개
- **왜**: 카테고리별 탐색을 명시적으로.
- **무엇을**: [내 피드] [시스템] [커뮤니티]. 비로그인은 "내 피드" 탭 비활성 또는 로그인 유도.
- **검증**: 탭 전환 시 검색 필터 유지

## 5-5. 헤더 Share 버튼
- **왜**: 일본/미국 친구에게 공유할 때 언어 선택된 URL이 가야 의미 있음.
- **무엇을**: Web Share API 지원(iOS/Android) → native sheet / 미지원 → `https://feed.anomess.com/p/{id}?lang={lang}` 클립보드 복사 + 토스트
- **검증**: iOS Safari에서 share sheet / 데스크톱 Chrome에서 클립보드 복사

## 5-6. 카드 ⋯ 메뉴 → 신고
- **왜**: 부적절 콘텐츠 신고 채널이 없으면 유저가 떠난다.
- **무엇을**: 유저 페르소나/영상 카드 ⋯ → "신고하기" → 모달 (사유 라디오: 스팸/혐오/저작권/기타 + 자유 메모) → `/api/reports` POST → moderation_queue INSERT + 어드민 알림 트리거
- **검증**: 신고 후 어드민 큐에 표시 / 같은 유저 신고 일 20회 초과 시 429

## 5-7. (선택) OG 이미지 자동 생성
- **왜**: SNS 공유 시 텍스트만 보이면 클릭률 낮음.
- **무엇을**: `app/p/[persona_id]/opengraph-image.tsx` — Next.js 동적 OG. 페르소나 이름 + Anomess 로고.
- **검증**: SNS 공유 미리보기 표시

## 5-8. Phase 5 종합 검증
- [ ] 모바일 그리드 터치 타겟 적정
- [ ] 즐겨찾기 ★ 동작
- [ ] Share → 클립보드/네이티브
- [ ] 신고 → 큐 + 어드민 알림 도착
- [ ] dev 푸시 → 사용자 OK

---

# Phase 6 — 어드민 모더레이션 + 비활성 큐 + 알림

> **목표**: 어드민이 한 화면에서 신고/비활성/욕설 의심 페르소나를 모두 처리. 자동 삭제 없음 — 모든 삭제는 어드민 확인.

## 6-1. `lib/admin-notify.ts` — 이중 알림 헬퍼
- **왜**: 이메일만 쓰면 모바일에서 즉시성 떨어짐. Telegram 봇을 운영 중이므로 같이 보내면 빠르게 인지.
- **무엇을**: `notifyAdmin({ title, body, link })` → Resend(verywildbanana@gmail.com) + Telegram(`mini_dong_bot` 채널) 동시 발송. 둘 다 실패 시 로그 남김.
- **검증**: 테스트 호출 → 이메일 + Telegram 동시 수신

## 6-2. `/admin/users` + `/api/admin/users`
- **왜**: 누가 가입했고 뭘 하는지 파악할 곳이 없으면 운영 불가.
- **무엇을**: 테이블 (이메일, 닉네임, 가입일, 페르소나 수, 영상 수, 최근 활동, 신고받은 횟수, banned 토글). admin_token 인증.
- **검증**: 차단 토글 → user_profiles.banned 즉시 반영 → 그 유저 페르소나 자동 숨김 / audit_logs row 기록

## 6-3. `/admin/moderation-queue` + `/api/admin/moderate`
- **왜**: 신고/비활성/욕설을 분리된 화면에서 처리하면 누락 발생.
- **무엇을**: moderation_queue 통합 리스트. 각 row에 [유지] [삭제] 버튼. 처리 시 status 변경 + audit_logs + (삭제 시) target의 is_removed=true.
- **검증**: 신고 row → [삭제] → 페르소나/영상 is_removed → 피드에서 사라짐 / [유지] → 큐에서 제거되고 flagged_for_review=false 복구

## 6-4. `/api/cron/inactive-personas`
- **왜**: 비활성 정책의 핵심. 자동 삭제는 안 하지만 큐 등록은 자동.
- **무엇을**: 
  - Step 1: `last_activity_at < now() - 48h AND warning_sent_at IS NULL` → 유저 경고 이메일 + warning_sent_at 기록
  - Step 2: `last_activity_at < now() - 72h AND warning_sent_at IS NOT NULL AND flagged_for_review = false` → flagged_for_review=true + moderation_queue INSERT(reason='inactive_72h') + `notifyAdmin()` 1회 호출 (당일 모든 건 합쳐서)
  - 인증: Vercel Cron의 `x-vercel-cron-signature` 또는 CRON_SECRET 헤더 검증
- **검증**: 가짜 시각으로 last_activity_at 조작 후 cron 수동 호출 → 경고 메일 / 큐 INSERT / 어드민 알림 수신

## 6-5. `vercel.json` crons 설정
- **왜**: Vercel은 vercel.json의 crons로만 스케줄 등록 가능.
- **무엇을**: 
  ```json
  { "crons": [{ "path": "/api/cron/inactive-personas", "schedule": "0 17 * * *" }] }
  ```
  (UTC 17:00 = KST 02:00)
- **검증**: Vercel 대시보드 → Crons 탭에 항목 표시 / 다음날 실행 로그 확인

## 6-6. 신고(`/api/reports`) → 큐 + 알림 연결
- **왜**: 신고가 큐에 안 오면 5-6의 어드민 화면이 무의미.
- **무엇을**: reports INSERT 직후 moderation_queue INSERT + notifyAdmin (디바운스: 동일 target 5분 내 중복 알림은 1회)
- **검증**: 신고 → 큐 표시 + 즉시 어드민 알림

## 6-7. Phase 6 종합 검증
- [ ] 차단 → 페르소나 비활성화 + audit_logs 기록
- [ ] 신고 → 큐 + 어드민 알림 (이메일 + Telegram)
- [ ] 가짜 시각으로 cron → D+2 유저 메일 / D+3 큐+알림
- [ ] 큐에서 [유지] → 큐 제거 / [삭제] → is_removed + audit_logs
- [ ] dev 푸시 → release → main 배포

---

# 환경변수 추가 (Vercel + .env.local)

| 변수 | 용도 |
|------|------|
| `RESEND_API_KEY` | 피드백/어드민 이메일 |
| `RESEND_FROM` | 발신 주소 (예: `noreply@anomess.com`) |
| `ADMIN_NOTIFY_EMAIL` | verywildbanana@gmail.com |
| `TELEGRAM_BOT_TOKEN` | mini_dong_bot |
| `TELEGRAM_ADMIN_CHAT_ID` | 어드민 채팅 ID |
| `CRON_SECRET` | Vercel Cron 인증 |
| `TOS_VERSION` | 약관 버전 (예: 1.0) |

---

# 인프라 감당 가능성

| 시나리오 | row 수 | 스토리지 | 판정 |
|----------|--------|---------|------|
| 시스템만 | 6,000 | ~3MB | ✅ |
| 유저 100명 | ~56,000 | ~28MB | ✅ |
| 유저 1,000명 | ~506,000 | ~253MB | ⚠️ Supabase Pro 검토 |

썸네일 YouTube CDN 직접 / oEmbed는 유저 액션 시에만 / RateLimit으로 스팸 차단.

---

# 최종 E2E 검증 시나리오

1. 비로그인 → 모든 시스템/공개 유저 피드 정상 열람
2. 비로그인 "페르소나 만들기" → 로그인 → onboarding → /my/create
3. 페르소나 3개 생성 → 4번째 차단
4. 영상 추가 → 피드 표시 / 임베드 차단 영상 경고 표시 / 500개 도달 시 안내
5. 다른 계정으로 신고 → 어드민 메일 + Telegram 동시 수신 → 큐 표시
6. 어드민 [삭제] → 페르소나 사라짐 + audit_logs 기록
7. 가짜 시각 D+2 → 유저 경고 메일 / D+3 → 큐 + 어드민 알림
8. 차단 토글 → 그 유저 모든 페르소나 즉시 숨김
9. 알림 OFF → 피드백 와도 메일 안 옴
10. 약관 버전 환경변수 변경 → 다음 로그인 시 onboarding 재진입
11. 계정 삭제 → 모든 데이터 cascade 삭제 / GA4 미로딩 (쿠키 거부 시)
12. main 배포 후 `feed.anomess.com` 동작 확인
