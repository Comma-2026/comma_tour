import { useCallback, useState } from 'react';

import {
  AppLocationError,
  CurrentLocation,
} from '../types/location';
import { getCurrentLocation } from '../utils/location';

type UseCurrentLocationResult = {
  location: CurrentLocation | null;
  isLoading: boolean;
  error: AppLocationError | null;
  refreshLocation: () => Promise<CurrentLocation | null>;
};

export function useCurrentLocation(): UseCurrentLocationResult {
  const [location, setLocation] =
    useState<CurrentLocation | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] =
    useState<AppLocationError | null>(null);

  const refreshLocation =
    useCallback(async (): Promise<CurrentLocation | null> => {
      try {
        setIsLoading(true);
        setError(null);

        const currentLocation = await getCurrentLocation();

        setLocation(currentLocation);

        return currentLocation;
      } catch (caughtError) {
        const locationError =
          caughtError instanceof AppLocationError
            ? caughtError
            : new AppLocationError(
              'LOCATION_UNAVAILABLE',
              '위치 정보를 처리하는 중 오류가 발생했습니다.',
            );

        setError(locationError);

        return null;
      } finally {
        setIsLoading(false);
      }
    }, []);

  return {
    location,
    isLoading,
    error,
    refreshLocation,
  };
}