-- comments 테이블: 유저 피드 공개 댓글/오너 답글 시스템
CREATE TABLE IF NOT EXISTS public.comments (
  id         bigserial PRIMARY KEY,
  persona_id text NOT NULL REFERENCES public.user_personas(persona_id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id  bigint REFERENCES public.comments(id) ON DELETE CASCADE,  -- NULL=댓글, 값=오너 답글
  content    text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  nickname   text NOT NULL,   -- user_profiles.nickname 캐시
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_persona_created_idx ON public.comments(persona_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON public.comments(parent_id) WHERE parent_id IS NOT NULL;

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기
CREATE POLICY "공개 읽기" ON public.comments FOR SELECT USING (true);
-- 로그인 유저만 댓글 (본인 user_id만)
CREATE POLICY "본인 삽입" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
-- 본인 댓글 삭제
CREATE POLICY "본인 삭제" ON public.comments FOR DELETE USING (auth.uid() = user_id);
