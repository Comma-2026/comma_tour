export interface Pin {
  id: string
  contentId: string        // 관광공사 contentId
  place_name: string
  region: string           // 예: "봉화군"
  latitude: number
  longitude: number
  visited_at: string       // "YYYY-MM-DD"
  memo: string | null
  photo_url: string | null
  phrase: string | null    // 캐치프레이즈 API 문구
}
