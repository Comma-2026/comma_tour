/**
 * 앱에서 공통으로 사용하는 현재 위치 데이터입니다.
 */
export type CurrentLocation = {
    /** 위도 */
    latitude: number;

    /** 경도 */
    longitude: number;

    /** 위치 정확도. 단위는 미터이며 기기에서 제공하지 않으면 null */
    accuracy: number | null;

    /** 위치가 측정된 시각 */
    timestamp: number;
};

export type LocationErrorCode =
    | 'LOCATION_SERVICE_DISABLED'
    | 'PERMISSION_DENIED'
    | 'PERMISSION_BLOCKED'
    | 'LOCATION_UNAVAILABLE';

/**
 * 위치 기능에서 발생하는 오류입니다.
 */
export class AppLocationError extends Error {
    constructor(
        public readonly code: LocationErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'AppLocationError';
    }
}