-- ============================================================
-- Phase 2 — 유저 페르소나 테이블 + RLS + 트리거
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. user_profiles (프로필/닉네임)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname    text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 20),
  tos_agreed  boolean NOT NULL DEFAULT false,
  is_banned   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인만 읽기"  ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "본인만 수정"  ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "본인만 삽입"  ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. user_personas
CREATE TABLE IF NOT EXISTS public.user_personas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id    text UNIQUE NOT NULL,
  name_i18n     jsonb NOT NULL DEFAULT '{}',
  description_i18n jsonb NOT NULL DEFAULT '{}',
  is_public     boolean NOT NULL DEFAULT true,
  is_banned     boolean NOT NULL DEFAULT false,
  video_count   int NOT NULL DEFAULT 0,
  last_updated_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_personas_user_id_idx ON public.user_personas(user_id);
CREATE INDEX IF NOT EXISTS user_personas_public_idx  ON public.user_personas(is_public, created_at DESC);
ALTER TABLE public.user_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공개 읽기" ON public.user_personas
  FOR SELECT USING (is_public = true AND is_banned = false);
CREATE POLICY "본인 읽기" ON public.user_personas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "본인 수정" ON public.user_personas
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "본인 삭제" ON public.user_personas
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "본인 삽입" ON public.user_personas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. user_videos
CREATE TABLE IF NOT EXISTS public.user_videos (
  id            bigserial PRIMARY KEY,
  persona_id    text NOT NULL REFERENCES public.user_personas(persona_id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id      text NOT NULL,
  title         text NOT NULL,
  channel       text NOT NULL,
  thumbnail_url text NOT NULL,
  user_intro    jsonb,
  added_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(persona_id, video_id)
);
CREATE INDEX IF NOT EXISTS user_videos_persona_idx ON public.user_videos(persona_id, added_at DESC);
CREATE INDEX IF NOT EXISTS user_videos_user_idx    ON public.user_videos(user_id);
ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공개 영상 읽기" ON public.user_videos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_personas up
      WHERE up.persona_id = user_videos.persona_id
        AND up.is_public = true
        AND up.is_banned = false
    )
  );
CREATE POLICY "본인 영상 수정" ON public.user_videos
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "본인 영상 삭제" ON public.user_videos
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "본인 영상 삽입" ON public.user_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. video_count 자동 증감 트리거
CREATE OR REPLACE FUNCTION public.update_persona_video_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_personas
    SET video_count = video_count + 1,
        last_updated_at = now()
    WHERE persona_id = NEW.persona_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_personas
    SET video_count = GREATEST(video_count - 1, 0)
    WHERE persona_id = OLD.persona_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_videos_count ON public.user_videos;
CREATE TRIGGER trg_user_videos_count
  AFTER INSERT OR DELETE ON public.user_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_persona_video_count();

-- 5. user_profiles updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
