import type { SpotCategory } from '@/types/spot';

/**
 * 카테고리별 이모지/라벨/배경색 공용 정의.
 * 지도 탭과 핀 기록 화면이 각자 따로 들고 있으면 하나만 고치고 잊어버리기 쉬워서 여기로 뺐다.
 * (카카오맵 WebView 안에 주입되는 JS는 RN 모듈을 import 못 해서 별도 리터럴로 남아있음 — map.tsx 참고,
 * 카테고리 추가/변경 시 거기도 같이 맞춰야 한다.)
 */
export const CATEGORY_EMOJI: Record<SpotCategory, string> = {
    nature: '🏔',
    history: '⛩',
    culture: '🏙',
    experience: '🎨',
    night: '🌃',
    etc: '📍',
};

export const CATEGORY_LABEL: Record<SpotCategory, string> = {
    nature: '자연',
    history: '역사',
    culture: '문화',
    experience: '체험',
    night: '야경',
    etc: '기타',
};

export const CATEGORY_ICON_BG: Record<SpotCategory, string> = {
    nature: '#e3f0e6',
    history: '#f1e6da',
    culture: '#ece3f5',
    experience: '#fdeee0',
    night: '#1f2a44',
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
