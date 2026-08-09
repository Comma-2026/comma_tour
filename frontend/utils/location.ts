import * as Location from 'expo-location';

import {
    AppLocationError,
    CurrentLocation,
} from '../types/location';

/**
 * 사용자에게 현재 위치 권한을 요청합니다.
 */
async function requestLocationPermission(): Promise<void> {
    const currentPermission =
        await Location.getForegroundPermissionsAsync();

    // 이미 권한이 허용되어 있으면 다시 요청하지 않습니다.
    if (currentPermission.granted) {
        return;
    }

    // 사용자가 권한을 완전히 차단한 경우
    if (!currentPermission.canAskAgain) {
        throw new AppLocationError(
            'PERMISSION_BLOCKED',
            '위치 권한이 차단되어 있습니다. 휴대폰 설정에서 위치 권한을 허용해 주세요.',
        );
    }

    const requestedPermission =
        await Location.requestForegroundPermissionsAsync();

    if (!requestedPermission.granted) {
        throw new AppLocationError(
            'PERMISSION_DENIED',
            '현재 위치를 사용하려면 위치 권한이 필요합니다.',
        );
    }
}

/**
 * 사용자의 현재 위도와 경도를 가져옵니다.
 */
export async function getCurrentLocation(): Promise<CurrentLocation> {
    try {
        const isLocationServiceEnabled =
            await Location.hasServicesEnabledAsync();

        if (!isLocationServiceEnabled) {
            throw new AppLocationError(
                'LOCATION_SERVICE_DISABLED',
                '휴대폰의 위치 서비스가 꺼져 있습니다.',
            );
        }

        await requestLocationPermission();

        const result = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        return {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
            accuracy: result.coords.accuracy,
            timestamp: result.timestamp,
        };
    } catch (error) {
        if (error instanceof AppLocationError) {
            throw error;
        }

        console.error('[Location] 현재 위치 조회 실패:', error);

        throw new AppLocationError(
            'LOCATION_UNAVAILABLE',
            '현재 위치를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
    }
}