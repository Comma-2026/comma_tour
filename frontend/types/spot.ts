// 'night'은 SpotMockData.ts(더 이상 안 씀)와의 호환을 위해 남겨둠 — 실데이터로 채울 수 없어 탭에선 안 씀.
export type SpotCategory = 'nature' | 'history' | 'culture' | 'experience' | 'night' | 'etc';

export interface SpotMarker {
    id: string;
    contentId: string;
    place_name: string;
    region: string;
    category: SpotCategory;
    latitude: number;
    longitude: number;
    description: string;
}
