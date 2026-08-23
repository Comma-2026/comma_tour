import type { SpotCategory } from '@/types/spot';

/**
 * 카테고리별 이모지/라벨/배경색 공용 정의.
 * 지도 탭과 핀 기록 화면이 각자 따로 들고 있으면 하나만 고치고 잊어버리기 쉬워서 여기로 뺐다.
 * (카카오맵 WebView 안의 JS는 RN 모듈을 import 못 하지만, map.tsx가 이 값들을 JSON으로 직렬화해
 * 주입하므로 여기만 고치면 지도 마커에도 자동 반영된다.)
 */
export const CATEGORY_EMOJI: Record<SpotCategory, string> = {
    nature: '🌿',
    history: '🏛',
    culture: '🎭',
    experience: '🎨',
    etc: '📍',
};

/** 지도 마커 배지 색(핀 채우기 색). 카드 배경색(CATEGORY_ICON_BG)보다 채도를 높여 지도 위에서 도드라지게 한다. */
export const CATEGORY_MARKER_COLOR: Record<SpotCategory, string> = {
    nature: '#4c8c5c',
    history: '#a8763e',
    culture: '#8b6bb1',
    experience: '#e08a3c',
    etc: '#8a8f86',
};

export const CATEGORY_LABEL: Record<SpotCategory, string> = {
    nature: '자연',
    history: '역사',
    culture: '문화',
    experience: '체험',
    etc: '기타',
};

export const CATEGORY_ICON_BG: Record<SpotCategory, string> = {
    nature: '#e3f0e6',
    history: '#f1e6da',
    culture: '#ece3f5',
    experience: '#fdeee0',
    etc: '#eceae3',
};

/** 백엔드 category(자연/역사/문화/체험/기타 — Pin.category, SpotDetail.category) → SpotCategory. */
export const BACKEND_CATEGORY_TO_SPOT_CATEGORY: Record<string, SpotCategory> = {
    자연: 'nature',
    역사: 'history',
    문화: 'culture',
    체험: 'experience',
};

export function toSpotCategory(backendCategory: string): SpotCategory {
    return BACKEND_CATEGORY_TO_SPOT_CATEGORY[backendCategory] ?? 'etc';
}

export function categoryEmojiFor(backendCategory: string): string {
    return CATEGORY_EMOJI[toSpotCategory(backendCategory)];
}
