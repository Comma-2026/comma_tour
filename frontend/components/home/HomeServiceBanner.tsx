import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Brand } from '@/constants/theme';

const HomeTheme = {
    greenDeep: '#1a3a2a',
    greenSub: '#4a7c5f',
};

export function HomeServiceBanner() {
    return (
        <TouchableOpacity
            style={styles.banner}
            activeOpacity={0.82}
            onPress={() => {
                // TODO: 협력 서비스 안내 화면 연결 예정
            }}
        >
            <View style={styles.badge}>
                <Text style={styles.badgeText}>안전</Text>
            </View>

            <View style={styles.textArea}>
                <Text style={styles.title}>경상북도 공식 협력 서비스</Text>
                <Text style={styles.desc}>청송 · 영양 · 울진 · 안동 외 전 지역</Text>
            </View>

            <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    banner: {
        marginTop: 16,
        minHeight: 48,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: '#eef5ee',
        borderWidth: 1,
        borderColor: '#dfeade',
        flexDirection: 'row',
        alignItems: 'center',
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: HomeTheme.greenSub,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#ffffff',
    },
    textArea: {
        flex: 1,
        marginLeft: 10,
    },
    title: {
        fontSize: 12,
        fontWeight: '800',
        color: HomeTheme.greenDeep,
    },
    desc: {
        marginTop: 2,
        fontSize: 10,
        fontWeight: '500',
        color: Brand.muted,
    },
    arrow: {
        fontSize: 16,
        fontWeight: '700',
        color: HomeTheme.greenSub,
    },
});