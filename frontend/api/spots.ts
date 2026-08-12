import { API_BASE_URL } from '@/constants/api';

export type SpotCard = {
  id: string;
  name: string;
  region: string;
  icon: string;
  /** 한국관광공사 제공 실제 사진 URL. 목업 모드거나 사진이 없으면 null. */
  imageUrl: string | null;
  /** 자연/역사/문화/체험/기타 대분류. TourAPI 분류 체계엔 "야경"에 대응하는 코드가 없어 표현 불가. */
  category: string;
  tags: string[];
  shortDesc: string;
  congestion: string;
  /** 대구 기준 서버 계산치(백업용). 화면에는 내 위치 기준 거리(utils/distance)를 우선 쓴다. */
  distanceFromDaegu: string;
  lat: number;
  lng: number;
};

/** 지도 탭 전체 목록(카탈로그)용 — 좌표 포함, 카드보다 가벼움(태그/혼잡도/거리 없음). */
export type SpotCatalogItem = {
  id: string;
  name: string;
  region: string;
  icon: string;
  category: string;
  shortDesc: string;
  lat: number;
  lng: number;
};

export type SpotDetail = SpotCard & {
  hasParking: boolean;
  admissionFee: string;
  businessHours: string;
  transportInfo: string;
};

/** 카드 하단 "어떤 점이 아쉬웠나요?" 피드백 칩. id는 백엔드 필터 키와 1:1로 맞춘다. */
export const FEEDBACK_TAGS: { id: string; label: string }[] = [
  { id: 'too_far', label: '너무 멀어요' },
  { id: 'want_quieter', label: '더 조용한 곳이 좋아요' },
  { id: 'want_food', label: '먹거리도 있었으면 해요' },
  { id: 'no_walking', label: '걷기 싫어요' },
  { id: 'lacking_sights', label: '볼거리가 부족해요' },
];

/**
 * 첫 진입 선호 설문 칩. id는 백엔드 필터 키와 1:1로 맞춘다.
 * 그룹 구분은 UI/UX 가독성용일 뿐, 알고리즘(필터 적용)에는 영향을 주지 않는다 — 선택된 id들은 그대로 합쳐져 전달된다.
 */
export const PREFERENCE_TAG_GROUPS: { title: string; tags: { id: string; label: string }[] }[] = [
  {
    title: '기본',
    tags: [
      { id: 'too_far', label: '가까운 곳이 좋아요' },
      { id: 'want_quieter', label: '조용한 곳이 좋아요' },
      { id: 'want_food', label: '먹거리도 있었으면 해요' },
      { id: 'no_walking', label: '걷기 싫어요' },
      { id: 'lacking_sights', label: '볼거리가 필요해요' },
    ],
  },
  {
    title: '테마별',
    tags: [
      { id: 'nature_healing', label: '자연 속에서 힐링하고 싶어요' },
      { id: 'history_culture', label: '역사·문화 탐방이 좋아요' },
      { id: 'activity_experience', label: '체험 위주가 좋아요' },
      { id: 'leisure_sports', label: '레저스포츠 위주가 좋아요' },
    ],
  },
  {
    title: '기타',
    tags: [
      { id: 'free_only', label: '무료로 즐기고 싶어요' },
      { id: 'parking_required', label: '주차가 꼭 가능해야 해요' },
      { id: 'pet_friendly', label: '반려동물과 함께해요' },
    ],
  },
];

/** 요청이 응답 없이 멈추는 것을 막기 위한 타임아웃(ms) */
const REQUEST_TIMEOUT = 10000;

async function getJson<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { signal: controller.signal });
    return (await res.json().catch(() => null)) as T | null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 디버그용 — 12(관광지)/14(문화시설)/28(레포츠)/38(쇼핑) 출처별로 실제로 잘 불러와졌는지 확인. */
export const DEBUG_SOURCE_TYPES: { id: number; label: string }[] = [
  { id: 12, label: '관광지(12)' },
  { id: 14, label: '문화시설(14)' },
  { id: 28, label: '레포츠(28)' },
  { id: 38, label: '쇼핑(38)' },
];

/**
 * 랜덤 관광지 5곳 추천.
 * - excludeIds: 이미 보여준 카드(재추첨 시 후보에서 제외)
 * - feedbackTags: 카드에서 선택한 "아쉬운 점" 태그(다음 추천 후보를 좁히는 데 사용)
 * - region: 지역(시군구) 선택 시 그 안에서만 추천. null/미지정이면 전체.
 * - sourceContentType: 디버그용. 특정 contentTypeId 출처만 보고 싶을 때(DEBUG_SOURCE_TYPES).
 */
export async function fetchRecommendedSpots(
  excludeIds: string[] = [],
  feedbackTags: string[] = [],
  region?: string | null,
  sourceContentType?: number | null,
): Promise<SpotCard[]> {
  const params = new URLSearchParams();
  if (excludeIds.length > 0) params.set('exclude', excludeIds.join(','));
  if (feedbackTags.length > 0) params.set('feedback', feedbackTags.join(','));
  if (region) params.set('region', region);
  if (sourceContentType) params.set('sourceType', String(sourceContentType));
  const query = params.toString() ? `?${params.toString()}` : '';

  const data = await getJson<{ spots: SpotCard[] }>(`/api/spots/recommend${query}`);
  return data?.spots ?? [];
}

/** 선택 가능한 지역(시군구) 목록. */
export async function fetchAvailableRegions(): Promise<string[]> {
  const data = await getJson<{ regions: string[] }>('/api/spots/regions');
  return data?.regions ?? [];
}

/** 지도 탭 전체 목록. region 주면 그 지역만. */
export async function fetchSpotCatalog(region?: string | null): Promise<SpotCatalogItem[]> {
  const query = region ? `?region=${encodeURIComponent(region)}` : '';
  const data = await getJson<{ spots: SpotCatalogItem[] }>(`/api/spots/catalog${query}`);
  return data?.spots ?? [];
}

/** 관광지 상세 정보 조회. 없으면 null. */
export async function fetchSpotDetail(id: string): Promise<SpotDetail | null> {
  const data = await getJson<{ success: boolean; spot?: SpotDetail }>(`/api/spots/${id}`);
  return data?.success ? (data.spot ?? null) : null;
}

/**
 * 내 위치 → 관광지 실제 도로 거리/시간(카카오모빌리티 자동차 길찾기).
 * 실패하면(네트워크 오류, 키 미설정 등) null — 호출부에서 직선거리 근사치(utils/distance)로 폴백한다.
 */
export async function fetchDriveDistance(
  origin: { latitude: number; longitude: number },
  destLat: number,
  destLng: number,
): Promise<{ label: string; minutes: number } | null> {
  const params = new URLSearchParams({
    originLat: String(origin.latitude),
    originLng: String(origin.longitude),
    destLat: String(destLat),
    destLng: String(destLng),
  });
  const data = await getJson<{ success: boolean; label?: string; minutes?: number }>(
    `/api/spots/route-distance?${params.toString()}`,
  );
  if (!data?.success || !data.label || data.minutes === undefined) return null;
  return { label: data.label, minutes: data.minutes };
}
