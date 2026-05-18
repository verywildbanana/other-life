-- persona_likes 테이블: 유저 피드 좋아요
CREATE TABLE IF NOT EXISTS public.persona_likes (
  persona_id text NOT NULL REFERENCES public.user_personas(persona_id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, user_id)
);

CREATE INDEX IF NOT EXISTS persona_likes_persona_idx ON public.persona_likes(persona_id);

ALTER TABLE public.persona_likes ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 (카운트 조회용)
CREATE POLICY "공개 읽기" ON public.persona_likes FOR SELECT USING (true);
-- 로그인 유저만 본인 좋아요 삽입
CREATE POLICY "본인 삽입" ON public.persona_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
-- 본인 좋아요 취소
CREATE POLICY "본인 삭제" ON public.persona_likes FOR DELETE USING (auth.uid() = user_id);
