/** 거리 조회 api 한도 도달시 이걸로 처리 */

function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

/** 두 좌표 사이의 직선거리(km). Haversine 공식. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * 내 위치 기준 자동차 이동시간 추정치. 직선거리 * 1.3(백엔드 `_estimate_distance_from_daegu`와
 * 같은 근사 계수)을 분으로 취급한다 — 실제 도로 경로가 아닌 대략치.
 */
export function estimateDrivingLabel(
    from: { latitude: number; longitude: number },
    to: { lat: number; lng: number },
): { label: string; minutes: number } {
    const straightKm = haversineKm(from.latitude, from.longitude, to.lat, to.lng);
    const minutes = Math.max(20, Math.round(straightKm * 1.3));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const label = hours > 0 ? `현재 위치로부터 ${hours}시간 ${mins}분` : `현재 위치로부터 ${mins}분`;
    return { label, minutes };
}
