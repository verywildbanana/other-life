-- user_profiles에 terms_version / terms_agreed_at 컬럼 추가
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS terms_version    int          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terms_agreed_at  timestamptz;
