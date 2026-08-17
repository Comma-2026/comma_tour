import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import type { Pin } from '@/types/pin';
import { getPins } from '@/utils/pinStorage';
import { RecentPinCard } from './RecentPinCard';

const HomeTheme = {
    greenSub: '#4a7c5f',
    text: '#1A1A1A',
    muted: '#9AA0A6',
};

/** 홈에 보여줄 최근 핀 개수 */
const RECENT_COUNT = 3;

export function RecentPinSection() {
    const router = useRouter();
    const [pins, setPins] = useState<Pin[]>([]);

    // 홈에 돌아올 때마다(핀을 새로 찍고 온 경우 포함) 로컬 핀을 다시 불러온다.
    useFocusEffect(
        useCallback(() => {
            let active = true;
            getPins().then((stored) => {
                if (active) setPins(stored);
            });
            return () => {
                active = false;
            };
        }, []),
    );

    // 핀 id가 생성 시각(Date.now)이라, 숫자 내림차순 = 최근에 찍은 순.
    const recentPins = [...pins]
        .sort((a, b) => Number(b.id) - Number(a.id))
        .slice(0, RECENT_COUNT);

    return (
        <View style={styles.section}>
            <View style={styles.header}>
                <Text style={styles.title}>최근 핀 기록</Text>

                <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/pin-records')}>
                    <Text style={styles.moreText}>전체 보기</Text>
                </TouchableOpacity>
            </View>

            {recentPins.length === 0 ? (
                <Text style={styles.emptyText}>
                    아직 핀 기록이 없어요. 쉼표 뽑기로 첫 여행지를 정해보세요.
                </Text>
            ) : (
                <View style={styles.list}>
                    {recentPins.map((pin) => (
                        <RecentPinCard key={pin.id} pin={pin} />
                    ))}
                </View>
            )}
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
    emptyText: {
        paddingVertical: 18,
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        color: HomeTheme.muted,
    },
});
