export interface Diary {
  id: string;
  pin_id: string;           // 프론트 로컬 핀 id (Pin.id)와 1:1
  content_id: string | null; // 관광공사 contentId
  place_name: string;       // 예: "영양 자작나무 숲"
  region: string;           // 예: "영양군"
  title: string;
  content: string;
  visited_at: string | null; // "YYYY-MM-DD"
  has_photo: boolean;        // 첨부 사진 존재 여부(실제 이미지는 /photo 엔드포인트로 조회)
  created_at: string;        // ISO8601
  updated_at: string;        // ISO8601
}
