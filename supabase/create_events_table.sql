-- 유저 행동 이벤트 테이블
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS events (
  id          bigserial PRIMARY KEY,
  session_id  text NOT NULL,        -- feed_token UUID (세션 단위 유저 식별)
  persona_id  text NOT NULL,
  event_type  text NOT NULL,        -- 'video_click' | 'scroll_load' | 'shorts_click'
  video_id    text,                 -- video_click / shorts_click 시 설정
  position    int,                  -- 피드 내 위치 (1-based, video_click 시)
  scroll_page int,                  -- 몇 번째 배치 로드 (scroll_load 시, 1-based)
  lang        text,                 -- 'ko' | 'en' | 'ja'
  country     text,                 -- x-vercel-ip-country
  ip_hash     text,                 -- SHA-256(IP).slice(0,16)
  created_at  timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS events_persona_event_idx
  ON events(persona_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS events_video_idx
  ON events(video_id)
  WHERE video_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_session_idx
  ON events(session_id);

CREATE INDEX IF NOT EXISTS events_created_at_idx
  ON events(created_at DESC);

-- RLS 비활성화 (service role key로만 접근)
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
