import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Pin } from '@/types/pin';

const PINS_STORAGE_KEY = 'comma_tour:pins';

export async function getPins(): Promise<Pin[]> {
    const raw = await AsyncStorage.getItem(PINS_STORAGE_KEY);
    if (!raw) {
        return [];
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as Pin[]) : [];
    } catch {
        return [];
    }
}

export async function savePin(pin: Pin): Promise<void> {
    const pins = await getPins();
    pins.push(pin);
    await AsyncStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins));
}

export async function clearPins(): Promise<void> {
    await AsyncStorage.removeItem(PINS_STORAGE_KEY);
}
