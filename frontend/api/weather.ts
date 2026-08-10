import type { Weather } from '@/types/weather';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export async function getWeather(
    latitude: number,
    longitude: number,
): Promise<Weather> {
    if (!API_BASE_URL) {
        throw new Error(
            'EXPO_PUBLIC_API_BASE_URL이 설정되지 않았습니다.',
        );
    }

    const response = await fetch(
        `${API_BASE_URL}/api/weather` +
        `?lat=${latitude}` +
        `&lon=${longitude}`,
    );

    if (!response.ok) {
        throw new Error(
            `날씨 정보를 가져오지 못했습니다. (${response.status})`,
        );
    }

    return response.json();
}