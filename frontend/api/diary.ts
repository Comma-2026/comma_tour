import { API_BASE_URL } from '@/constants/api';
import type { Diary } from '@/types/diary';
import { getToken } from '@/utils/authStorage';

/** 요청이 응답 없이 멈추는 것을 막기 위한 타임아웃(ms) */
const REQUEST_TIMEOUT = 10000;

export type DiaryPayload = {
  pin_id: string;
  content_id?: string | null;
  place_name: string;
  region?: string;
  title?: string;
  content: string;
  visited_at?: string | null;
  photo_base64?: string | null; // 새로 첨부한 사진(base64). 없으면 기존 사진 유지.
  photo_mime?: string | null;
};

/** 일기에 첨부된 사진 이미지 URL. has_photo가 true인 경우에만 사용. */
export function diaryPhotoUrl(pinId: string): string {
  return `${API_BASE_URL}/api/diary/pin/${encodeURIComponent(pinId)}/photo`;
}

/**
 * expo-image에 넘길 사진 소스(토큰 헤더 포함).
 * 사진 엔드포인트도 계정별로 잠겨 있어 Authorization 헤더가 필요하다.
 */
export function diaryPhotoSource(pinId: string, token: string | null) {
  return {
    uri: diaryPhotoUrl(pinId),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}

export type DiaryResult = { success: boolean; message?: string; diary?: Diary };

async function requestJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  // 모든 일기 요청에 로그인 토큰을 붙인다(서버가 토큰에서 소유자를 정함).
  const token = await getToken();
  const headers = {
    ...(init?.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, signal: controller.signal });
    return (await res.json().catch(() => null)) as T | null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 작성된 일기 전체 목록(최근순). */
export async function fetchDiaries(): Promise<Diary[]> {
  const data = await requestJson<{ diaries: Diary[] }>('/api/diary');
  return data?.diaries ?? [];
}

/** 특정 핀에 연결된 일기 조회. 없으면 null. */
export async function fetchDiaryByPin(pinId: string): Promise<Diary | null> {
  const data = await requestJson<{ success: boolean; diary?: Diary }>(
    `/api/diary/pin/${encodeURIComponent(pinId)}`,
  );
  return data?.success ? (data.diary ?? null) : null;
}

/** 일기 작성(핀과 연결). 같은 핀에 이미 일기가 있으면 백엔드가 수정으로 처리한다. */
export async function createDiary(payload: DiaryPayload): Promise<DiaryResult> {
  const data = await requestJson<DiaryResult>('/api/diary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data ?? { success: false, message: '서버에 연결할 수 없습니다.' };
}

/** 일기 수정. */
export async function updateDiary(pinId: string, payload: DiaryPayload): Promise<DiaryResult> {
  const data = await requestJson<DiaryResult>(`/api/diary/pin/${encodeURIComponent(pinId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data ?? { success: false, message: '서버에 연결할 수 없습니다.' };
}
