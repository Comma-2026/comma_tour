import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { CATEGORY_EMOJI, toSpotCategory } from '@/constants/spotCategory';
import type { Pin } from '@/types/pin';

const HomeTheme = {
    greenDeep: '#1a3a2a',
    card: '#ffffff',
    text: '#1A1A1A',
    muted: '#9AA0A6',
};

type RecentPinCardProps = {
    pin: Pin;
};

export function RecentPinCard({ pin }: RecentPinCardProps) {
    const router = useRouter();

    return (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.82}
            onPress={() =>
                // 핀 기록 화면의 카드와 동일한 읽기 전용 상세(길찾기만)로 연다.
                router.push({
                    pathname: '/pindraw/detail',
                    params: { id: pin.contentId, from: 'records' },
                })
            }
        >
            <View style={styles.iconBox}>
                <Text style={styles.icon}>{CATEGORY_EMOJI[toSpotCategory(pin.category)]}</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.title} numberOfLines={1}>
                    {pin.place_name}
                </Text>
                <Text style={styles.region}>{pin.region}</Text>
                {(pin.phrase || pin.memo) && (
                    <Text style={styles.memo} numberOfLines={1}>
                        {pin.phrase ?? pin.memo}
                    </Text>
                )}
            </View>

            <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        minHeight: 74,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: HomeTheme.card,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.045,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 2,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: HomeTheme.greenDeep,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 16,
        color: '#ffffff',
    },
    content: {
        flex: 1,
        marginLeft: 12,
    },
    title: {
        fontSize: 14,
        fontWeight: '800',
        color: HomeTheme.text,
    },
    region: {
        marginTop: 2,
        fontSize: 10,
        fontWeight: '600',
        color: HomeTheme.muted,
    },
    memo: {
        marginTop: 4,
        fontSize: 12,
        fontWeight: '500',
        color: '#6f766f',
    },
    arrow: {
        marginLeft: 8,
        fontSize: 22,
        color: '#c8c8c8',
    },
});
