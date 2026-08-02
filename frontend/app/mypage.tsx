import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Fonts } from '@/constants/theme';

type TravelRecord = {
    id: string;
    placeName: string;
    region: string;
    date: string;
    mood: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
};

type AccountMenu = {
    id: 'profile' | 'notifications' | 'logout';
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
};

// TODO: 실제 API 연동 시 아래 목업 데이터를 서버 응답으로 교체한다.
const PROFILE_MOCK = {
    name: '쉼표 여행자',
    introduction: '조용한 자연과 느긋한 여행을 좋아해요.',
};

const WEATHER_MOCK = {
    location: '경상북도 안동시',
    temperature: 28,
    condition: '맑음',
    precipitationProbability: 20,
};

const TRAVEL_RECORDS_MOCK: TravelRecord[] = [
    {
        id: 'record-1',
        placeName: '안동 하회마을',
        region: '안동시',
        date: '2026.07.20',
        mood: '평온했어요',
        description: '천천히 골목을 걸으며 오래 머물고 싶었던 하루',
        icon: 'leaf-outline',
    },
    {
        id: 'record-2',
        placeName: '주왕산 국립공원',
        region: '청송군',
        date: '2026.06.28',
        mood: '상쾌했어요',
        description: '초록빛 산책길에서 충분히 쉬어간 여행',
        icon: 'trail-sign-outline',
    },
];

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
    greenSoft: '#eef5ee',
};

export default function MyPageScreen() {
    const router = useRouter();

    const handleBackToHome = () => {
        router.replace('/(tabs)/home');
    };

    const handleMenuPress = (label: string) => {
        Alert.alert('준비 중', `${label} 기능은 추후 연결될 예정이에요.`);
    };

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
                <View style={styles.weatherCard}>
                    <View style={styles.weatherIconBox}>
                        <Ionicons name="sunny-outline" size={28} color={ScreenTheme.card} />
                    </View>
                    <View style={styles.weatherContent}>
                        <Text style={styles.weatherLocation} numberOfLines={1}>
                            오늘의 날씨 · {WEATHER_MOCK.location}
                        </Text>
                        <View style={styles.weatherRow}>
                            <Text style={styles.weatherTemperature}>{WEATHER_MOCK.temperature}°</Text>
                            <Text style={styles.weatherCondition}>{WEATHER_MOCK.condition}</Text>
                        </View>
                        <Text style={styles.weatherDetail}>
                            강수확률 {WEATHER_MOCK.precipitationProbability}%
                        </Text>
                    </View>
                </View>

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

                <SectionHeader title="나의 여행 기록" />
                <View style={styles.listGap}>
                    {TRAVEL_RECORDS_MOCK.map((record) => (
                        <TouchableOpacity
                            key={record.id}
                            style={styles.recordCard}
                            activeOpacity={0.82}
                            onPress={() => handleMenuPress('여행 기록 상세')}
                        >
                            <View style={styles.recordImagePlaceholder}>
                                <Ionicons name={record.icon} size={26} color={ScreenTheme.card} />
                            </View>
                            <View style={styles.recordContent}>
                                <View style={styles.titleRow}>
                                    <Text style={styles.cardTitle} numberOfLines={1}>
                                        {record.placeName}
                                    </Text>
                                    <Text style={styles.dateText}>{record.date}</Text>
                                </View>
                                <Text style={styles.regionText}>{record.region}</Text>
                                <Text style={styles.cardDescription} numberOfLines={2}>
                                    {record.description}
                                </Text>
                                <View style={styles.moodChip}>
                                    <Text style={styles.moodText}>#{record.mood}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
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
                            onPress={() => handleMenuPress(menu.label)}
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

const CARD_SHADOW = {
    shadowColor: '#000',
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
};

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
    weatherCard: {
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
    profileCard: {
        marginTop: 14,
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
    sectionTitle: {
        marginTop: 24,
        marginBottom: 10,
        fontSize: 17,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    listGap: {
        gap: 10,
    },
    recordCard: {
        minHeight: 112,
        padding: 12,
        borderRadius: 16,
        backgroundColor: ScreenTheme.card,
        flexDirection: 'row',
        ...CARD_SHADOW,
    },
    recordImagePlaceholder: {
        width: 76,
        minHeight: 88,
        borderRadius: 12,
        backgroundColor: ScreenTheme.greenDeep,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordContent: {
        flex: 1,
        marginLeft: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    dateText: {
        marginLeft: 8,
        fontSize: 10,
        color: Brand.muted,
    },
    regionText: {
        marginTop: 3,
        fontSize: 10,
        fontWeight: '600',
        color: Brand.muted,
    },
    cardDescription: {
        marginTop: 5,
        fontSize: 11,
        lineHeight: 16,
        color: ScreenTheme.text,
    },
    moodChip: {
        alignSelf: 'flex-start',
        marginTop: 7,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: ScreenTheme.greenSoft,
    },
    moodText: {
        fontSize: 10,
        fontWeight: '700',
        color: Brand.green,
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
