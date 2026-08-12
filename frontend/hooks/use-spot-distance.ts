import { useEffect, useState } from 'react';

import { fetchDriveDistance } from '@/api/spots';
import { AppLocationError, type CurrentLocation } from '@/types/location';
import { estimateDrivingLabel } from '@/utils/distance';
import { getCurrentLocation } from '@/utils/location';

type LocationState =
    | { status: 'loading' }
    | { status: 'ok'; location: CurrentLocation }
    | { status: 'error'; message: string };

function toErrorMessage(err: unknown): string {
    if (err instanceof AppLocationError) {
        if (err.code === 'PERMISSION_DENIED' || err.code === 'PERMISSION_BLOCKED') {
            return '위치 권한이 없어 거리를 알 수 없어요';
        }
        if (err.code === 'LOCATION_SERVICE_DISABLED') {
            return '위치 서비스가 꺼져 있어 거리를 알 수 없어요';
        }
    }
    return '현재 위치를 확인하지 못했어요';
}

/**
 * 내 위치 기준 관광지까지의 거리 라벨(쉼표뽑기 카드·상세 공용).
 *
 * 대구 기준 거리로 폴백하지 않고, 상태를 그대로 문구로 보여준다:
 * - 위치 확인 중이면        → "내 위치 확인 중…"
 * - 위치 실패(권한 없음 등) → 원인 메시지 (예: "위치 권한이 없어 거리를 알 수 없어요")
 * - 위치 확보되면           → 직선거리 근사치를 즉시 표시하고,
 *                             카카오모빌리티 실제 도로 거리가 도착하면 조용히 교체
 */
export function useSpotDistance(
    spot: { id: string; lat: number; lng: number } | null | undefined,
): string {
    const [locationState, setLocationState] = useState<LocationState>({ status: 'loading' });
    const [driveLabel, setDriveLabel] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        getCurrentLocation()
            .then((location) => {
                if (active) setLocationState({ status: 'ok', location });
            })
            .catch((err) => {
                if (active) setLocationState({ status: 'error', message: toErrorMessage(err) });
            });
        return () => {
            active = false;
        };
    }, []);

    const spotId = spot?.id;
    const lat = spot?.lat;
    const lng = spot?.lng;

    useEffect(() => {
        setDriveLabel(null);
        if (spotId === undefined || lat === undefined || lng === undefined) return;
        if (locationState.status !== 'ok') return;

        let cancelled = false;
        fetchDriveDistance(locationState.location, lat, lng).then((result) => {
            if (!cancelled && result) setDriveLabel(result.label);
        });
        return () => {
            cancelled = true;
        };
    }, [spotId, lat, lng, locationState]);

    if (!spot) return '';
    if (locationState.status === 'loading') return '내 위치 확인 중…';
    if (locationState.status === 'error') return locationState.message;
    return (
        driveLabel ??
        estimateDrivingLabel(locationState.location, { lat: spot.lat, lng: spot.lng }).label
    );
}
