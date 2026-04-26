export interface Video {
  video_id: string
  persona_id: string
  title: string
  channel: string
  url: string
  thumbnail_url: string
  view_count: number
  keyword: string
  score: number
  collected_at: string
  feed_source: string
  collected_date: string | null
  published_at: string | null  // YouTube 실제 업로드 날짜 (YYYY-MM-DD)
  titles_i18n: Record<string, string>
}

export interface DateGroup {
  date: string
  feed_source: string
  videos: Video[]
}

export interface FeedResponse {
  persona_id: string
  persona_name: string
  total_accumulated: number
  dates: DateGroup[]
}

export interface Persona {
  id: string
  name: string
  description: string
  name_i18n?: Record<string, string>
  description_i18n?: Record<string, string>
}

// 페이지네이션용 플랫 피드 응답
export interface FeedPageResponse {
  persona_id: string
  persona_name: string
  total_accumulated: number
  videos: Video[]
  has_more: boolean
  next_offset: number
}

export interface IngestItem {
  id: string
  title: string
  channel: string
  url: string
  thumbnail: string
  view_count: number
  titles_i18n: Record<string, string>
  published_at?: string | null  // YouTube 실제 업로드 날짜 (YYYY-MM-DD), 옵셔널
  keyword?: string               // 수집 키워드 (shorts 파이프라인에서 사용)
}
