import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { RecentPin } from '@/constants/HomeMockData';

const HomeTheme = {
    greenDeep: '#1a3a2a',
    card: '#ffffff',
    text: '#1A1A1A',
    muted: '#9AA0A6',
};

type RecentPinCardProps = {
    item: RecentPin;
};

export function RecentPinCard({ item }: RecentPinCardProps) {
    return (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.82}
            onPress={() => {
                // TODO: 상세 페이지 연결 예정
            }}
        >
            <View style={styles.iconBox}>
                <Text style={styles.icon}>{item.icon}</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                </Text>
                <Text style={styles.region}>{item.region}</Text>
                <Text style={styles.memo} numberOfLines={1}>
                    {item.memo}
                </Text>
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