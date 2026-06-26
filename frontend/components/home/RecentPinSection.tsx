import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { recentPins } from '@/constants/HomeMockData';
import { RecentPinCard } from './RecentPinCard';

const HomeTheme = {
    greenSub: '#4a7c5f',
    text: '#1A1A1A',
};

export function RecentPinSection() {
    return (
        <View style={styles.section}>
            <View style={styles.header}>
                <Text style={styles.title}>최근 핀 기록</Text>

                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                        // TODO: 전체 기록 화면 연결 예정
                    }}
                >
                    <Text style={styles.moreText}>전체 보기</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.list}>
                {recentPins.map((item) => (
                    <RecentPinCard key={item.id} item={item} />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginTop: 18,
    },
    header: {
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontSize: 17,
        fontWeight: '800',
        color: HomeTheme.text,
    },
    moreText: {
        fontSize: 11,
        fontWeight: '700',
        color: HomeTheme.greenSub,
    },
    list: {
        gap: 10,
    },
});