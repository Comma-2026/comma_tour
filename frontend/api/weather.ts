import type { Weather } from '@/types/weather';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

/** 서버가 응답 없이 멈춰있을 때 무한 로딩으로 보이지 않도록 하는 타임아웃(ms) */
const REQUEST_TIMEOUT = 10000;

export async function getWeather(
    latitude: number,
    longitude: number,
): Promise<Weather> {
    if (!API_BASE_URL) {
        throw new Error(
            'EXPO_PUBLIC_API_BASE_URL이 설정되지 않았습니다.',
        );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let response: Response;
    try {
        response = await fetch(
            `${API_BASE_URL}/api/weather` +
            `?lat=${latitude}` +
            `&lon=${longitude}`,
            { signal: controller.signal },
        );
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('날씨 서버 응답이 없어요. 잠시 후 다시 시도해주세요.');
        }
        throw new Error('날씨 정보를 가져오지 못했습니다.');
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        throw new Error(
            `날씨 정보를 가져오지 못했습니다. (${response.status})`,
        );
    }

    return response.json();
}