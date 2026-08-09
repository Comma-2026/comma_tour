import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { useCurrentLocation } from '../hooks/use-current-location';

export default function LocationTestCard() {
    const {
        location,
        isLoading,
        error,
        refreshLocation,
    } = useCurrentLocation();

    const handlePress = async () => {
        const result = await refreshLocation();

        if (!result) {
            return;
        }

        console.log('[LocationTest] 위도:', result.latitude);
        console.log('[LocationTest] 경도:', result.longitude);
        console.log('[LocationTest] 정확도:', result.accuracy);
    };

    return (
        <View style={styles.card}>
            <Text style={styles.title}>현재 위치 테스트</Text>

            {location && (
                <View style={styles.result}>
                    <Text style={styles.text}>
                        위도: {location.latitude.toFixed(6)}
                    </Text>

                    <Text style={styles.text}>
                        경도: {location.longitude.toFixed(6)}
                    </Text>

                    <Text style={styles.subText}>
                        정확도: 약 {location.accuracy ?? '-'}m
                    </Text>
                </View>
            )}

            {isLoading && (
                <ActivityIndicator style={styles.loading} />
            )}

            {error && (
                <Text style={styles.errorText}>
                    {error.message}
                </Text>
            )}

            <Pressable
                style={[
                    styles.button,
                    isLoading && styles.disabledButton,
                ]}
                onPress={handlePress}
                disabled={isLoading}
            >
                <Text style={styles.buttonText}>
                    {isLoading
                        ? '위치 확인 중...'
                        : '현재 위치 확인'}
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: 20,
        borderRadius: 20,
        backgroundColor: '#ffffff',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a3a2a',
    },
    result: {
        marginTop: 14,
        gap: 4,
    },
    text: {
        fontSize: 14,
        color: '#333333',
    },
    subText: {
        fontSize: 12,
        color: '#777777',
    },
    loading: {
        marginTop: 14,
    },
    errorText: {
        marginTop: 14,
        fontSize: 13,
        color: '#b3261e',
    },
    button: {
        marginTop: 16,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#1a3a2a',
    },
    disabledButton: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#ffffff',
        fontWeight: '600',
    },
});