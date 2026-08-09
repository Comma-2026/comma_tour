import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWeather } from '@/api/weather';
import { Brand, Fonts } from '@/constants/theme';
import { useCurrentLocation } from '@/hooks/use-current-location';
import type { Weather } from '@/types/weather';

type AccountMenu = {
    id: 'profile' | 'notifications' | 'logout';
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
};

// TODO: 프로필 API 연동 시 서버 응답으로 교체한다.
const PROFILE_MOCK = {
    name: '쉼표 여행자',
    introduction: '조용한 자연과 느긋한 여행을 좋아해요.',
};

const ACCOUNT_MENUS: AccountMenu[] = [
    { id: 'profile', label: '개인정보 및 프로필 수정', icon: 'person-outline' },
    { id: 'notifications', label: '알림 설정', icon: 'notifications-outline' },
    { id: 'logout', label: '로그아웃', icon: 'log-out-outline' },
];

const ScreenTheme = {
    background: '#f9f8f2',
    card: '#ffffff',
    text: '#1A1A1A',
    greenDeep: '#1a3a2a',
};

const CARD_SHADOW = {
    shadowColor: '#000',
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
};

function formatTemperature(value: number | null) {
    return value === null ? '-' : Math.round(value).toString();
}

function getWeatherIconName(weather: Weather | null): keyof typeof Ionicons.glyphMap {
    if (!weather) {
        return 'partly-sunny-outline';
    }

    if (weather.precipitationType === '비' || weather.precipitationType === '소나기') {
        return 'rainy-outline';
    }

    if (weather.precipitationType === '눈' || weather.precipitationType === '비/눈') {
        return 'snow-outline';
    }

    if (weather.sky === '맑음') {
        return 'sunny-outline';
    }

    if (weather.sky === '흐림') {
        return 'cloud-outline';
    }

    return 'partly-sunny-outline';
}

export default function MyPageScreen() {
    const router = useRouter();
    const { refreshLocation } = useCurrentLocation();

    const [weather, setWeather] = useState<Weather | null>(null);
    const [weatherLoading, setWeatherLoading] = useState(true);
    const [weatherError, setWeatherError] = useState<string | null>(null);
    const [locationName, setLocationName] = useState('현재 위치');

    const handleBackToHome = () => {
        router.replace('/(tabs)/home');
    };

    const handleMenuPress = (menu: AccountMenu) => {
        if (menu.id === 'logout') {
            Alert.alert(
                '로그아웃',
                '로그아웃하시겠습니까?',
                [
                    {
                        text: '취소',
                        style: 'cancel',
                    },
                    {
                        text: '로그아웃',
                        style: 'destructive',
                        onPress: () => {
                            router.replace('/login');
                        },
                    },
                ],
            );
            return;
        }

        Alert.alert('준비 중', `${menu.label} 기능은 추후 연결될 예정이에요.`);
    };

    const loadWeather = useCallback(async () => {
        try {
            setWeatherLoading(true);
            setWeatherError(null);

            const currentLocation = await refreshLocation();

            if (!currentLocation) {
                setWeather(null);
                setWeatherError('현재 위치를 가져오지 못했습니다.');
                return;
            }

            const [weatherData, addresses] = await Promise.all([
                getWeather(
                    currentLocation.latitude,
                    currentLocation.longitude,
                ),
                Location.reverseGeocodeAsync({
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                }),
            ]);

            setWeather(weatherData);

            const address = addresses[0];

            if (address) {
                const locationParts = [
                    address.region,
                    address.city,
                    address.district,
                ]
                    .filter((value): value is string => Boolean(value))
                    .filter((value, index, array) => array.indexOf(value) === index);

                if (locationParts.length > 0) {
                    setLocationName(locationParts.join(' '));
                }
            }
        } catch (error) {
            console.error('[MyPage] 날씨 조회 실패:', error);
            setWeather(null);
            setWeatherError('날씨 정보를 가져오지 못했습니다.');
        } finally {
            setWeatherLoading(false);
        }
    }, [refreshLocation]);

    useEffect(() => {
        loadWeather();
    }, [loadWeather]);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.headerSide}
                    activeOpacity={0.7}
                    onPress={handleBackToHome}
                    accessibilityRole="button"
                    accessibilityLabel="홈으로 돌아가기"
                >
                    <Ionicons name="chevron-back" size={24} color={ScreenTheme.text} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>마이페이지</Text>

                <View style={styles.headerSide} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.profileCard}>
                    <View style={styles.profileIconBox}>
                        <Ionicons name="person" size={32} color={ScreenTheme.card} />
                    </View>

                    <View style={styles.profileContent}>
                        <Text style={styles.profileName} numberOfLines={1}>
                            {PROFILE_MOCK.name}
                        </Text>
                        <Text style={styles.profileIntro} numberOfLines={2}>
                            {PROFILE_MOCK.introduction}
                        </Text>
                    </View>
                </View>

                <View style={styles.weatherCard}>
                    <View style={styles.weatherIconBox}>
                        {weatherLoading ? (
                            <ActivityIndicator color={ScreenTheme.card} />
                        ) : (
                            <Ionicons
                                name={getWeatherIconName(weather)}
                                size={28}
                                color={ScreenTheme.card}
                            />
                        )}
                    </View>

                    <View style={styles.weatherContent}>
                        <Text style={styles.weatherLocation} numberOfLines={1}>
                            오늘의 날씨 · {locationName}
                        </Text>

                        {weatherLoading ? (
                            <Text style={styles.weatherLoadingText}>날씨를 불러오는 중...</Text>
                        ) : weatherError ? (
                            <>
                                <Text style={styles.weatherErrorText}>{weatherError}</Text>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={loadWeather}
                                    accessibilityRole="button"
                                >
                                    <Text style={styles.weatherRetryText}>다시 시도</Text>
                                </TouchableOpacity>
                            </>
                        ) : weather ? (
                            <>
                                <View style={styles.weatherRow}>
                                    <Text style={styles.weatherTemperature}>
                                        {formatTemperature(weather.temperature)}°
                                    </Text>
                                    <Text style={styles.weatherCondition}>
                                        {weather.precipitationType &&
                                            weather.precipitationType !== '없음'
                                            ? weather.precipitationType
                                            : weather.sky ?? '날씨 정보 없음'}
                                    </Text>
                                </View>

                                <Text style={styles.weatherDetail}>
                                    최저 {formatTemperature(weather.minTemperature)}° · 최고{' '}
                                    {formatTemperature(weather.maxTemperature)}° · 강수확률{' '}
                                    {weather.precipitationProbability ?? '-'}%
                                </Text>
                            </>
                        ) : null}
                    </View>
                </View>

                <SectionHeader title="설정 및 계정" />

                <View style={styles.menuCard}>
                    {ACCOUNT_MENUS.map((menu, index) => (
                        <TouchableOpacity
                            key={menu.id}
                            style={[
                                styles.menuRow,
                                index < ACCOUNT_MENUS.length - 1 && styles.menuDivider,
                            ]}
                            activeOpacity={0.7}
                            onPress={() => handleMenuPress(menu)}
                        >
                            <Ionicons name={menu.icon} size={19} color={ScreenTheme.greenDeep} />
                            <Text style={styles.menuLabel}>{menu.label}</Text>
                            <Ionicons name="chevron-forward" size={17} color={Brand.muted} />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function SectionHeader({ title }: { title: string }) {
    return <Text style={styles.sectionTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: ScreenTheme.background,
    },
    header: {
        height: 52,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerSide: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontFamily: Fonts.serif,
        fontSize: 17,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 48,
    },
    profileCard: {
        padding: 18,
        borderRadius: 20,
        backgroundColor: ScreenTheme.card,
        flexDirection: 'row',
        alignItems: 'center',
        ...CARD_SHADOW,
    },
    profileIconBox: {
        width: 58,
        height: 58,
        borderRadius: 16,
        backgroundColor: ScreenTheme.greenDeep,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileContent: {
        flex: 1,
        marginLeft: 14,
    },
    profileName: {
        fontFamily: Fonts.serif,
        fontSize: 19,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    profileIntro: {
        marginTop: 6,
        fontSize: 12,
        lineHeight: 18,
        color: Brand.muted,
    },
    weatherCard: {
        minHeight: 94,
        marginTop: 14,
        padding: 18,
        borderRadius: 20,
        backgroundColor: ScreenTheme.card,
        flexDirection: 'row',
        alignItems: 'center',
        ...CARD_SHADOW,
    },
    weatherIconBox: {
        width: 58,
        height: 58,
        borderRadius: 16,
        backgroundColor: Brand.green,
        alignItems: 'center',
        justifyContent: 'center',
    },
    weatherContent: {
        flex: 1,
        marginLeft: 14,
    },
    weatherLocation: {
        fontSize: 11,
        fontWeight: '700',
        color: Brand.muted,
    },
    weatherRow: {
        marginTop: 3,
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    weatherTemperature: {
        fontFamily: Fonts.serif,
        fontSize: 25,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    weatherCondition: {
        marginLeft: 8,
        fontSize: 13,
        fontWeight: '700',
        color: ScreenTheme.greenDeep,
    },
    weatherDetail: {
        marginTop: 2,
        fontSize: 10,
        color: Brand.muted,
    },
    weatherLoadingText: {
        marginTop: 8,
        fontSize: 12,
        color: Brand.muted,
    },
    weatherErrorText: {
        marginTop: 7,
        fontSize: 12,
        color: ScreenTheme.text,
    },
    weatherRetryText: {
        marginTop: 5,
        fontSize: 11,
        fontWeight: '700',
        color: Brand.green,
    },
    sectionTitle: {
        marginTop: 24,
        marginBottom: 10,
        fontSize: 17,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    menuCard: {
        borderRadius: 16,
        backgroundColor: ScreenTheme.card,
        paddingHorizontal: 14,
        ...CARD_SHADOW,
    },
    menuRow: {
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Brand.border,
    },
    menuLabel: {
        flex: 1,
        marginLeft: 12,
        fontSize: 13,
        fontWeight: '600',
        color: ScreenTheme.text,
    },
});