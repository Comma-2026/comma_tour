import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { diaryPhotoUrl, fetchDiaries } from '@/api/diary';
import { Brand, Fonts } from '@/constants/theme';
import type { Diary } from '@/types/diary';
import type { Pin } from '@/types/pin';
import { getPins } from '@/utils/pinStorage';

const ScreenTheme = {
    background: '#f9f8f2',
    card: '#ffffff',
    text: '#1A1A1A',
    greenDeep: '#1a3a2a',
    muted: '#9AA0A6',
};

type TabKey = 'written' | 'toWrite';

export default function DiaryScreen() {
    const router = useRouter();

    const [pins, setPins] = useState<Pin[]>([]);
    const [diaries, setDiaries] = useState<Diary[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<TabKey>('written');

    // 탭에 들어올 때마다(작성 후 돌아올 때 포함) 로컬 핀 + 서버 일기를 다시 불러온다.
    useFocusEffect(
        useCallback(() => {
            let active = true;
            setLoading(true);
            Promise.all([getPins(), fetchDiaries()]).then(([localPins, serverDiaries]) => {
                if (!active) return;
                setPins(localPins);
                setDiaries(serverDiaries);
                setLoading(false);
            });
            return () => {
                active = false;
            };
        }, []),
    );

    // 아직 일기를 쓰지 않은 핀 = 로컬 핀 중 서버에 일기가 없는 것(pin_id 기준). 최신 방문 순.
    const toWritePins = useMemo(() => {
        const writtenPinIds = new Set(diaries.map((d) => d.pin_id));
        return pins
            .filter((pin) => !writtenPinIds.has(pin.id))
            .sort((a, b) => (a.visited_at < b.visited_at ? 1 : -1));
    }, [pins, diaries]);

    const goWrite = (pin: Pin) => {
        router.push({
            pathname: '/diary-write',
            params: {
                pinId: pin.id,
                contentId: pin.contentId,
                placeName: pin.place_name,
                region: pin.region,
                visitedAt: pin.visited_at,
            },
        });
    };

    const goEdit = (diary: Diary) => {
        router.push({
            pathname: '/diary-write',
            params: {
                pinId: diary.pin_id,
                contentId: diary.content_id ?? '',
                placeName: diary.place_name,
                region: diary.region,
                visitedAt: diary.visited_at ?? '',
            },
        });
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>다이어리</Text>
                <Text style={styles.subtitle}>핀을 찍은 곳의 하루를 기록해보세요.</Text>
            </View>

            {/* 작성된 일기 / 작성 예정 세그먼트 */}
            <View style={styles.segment}>
                <SegmentButton
                    label="작성된 일기"
                    count={diaries.length}
                    active={tab === 'written'}
                    onPress={() => setTab('written')}
                />
                <SegmentButton
                    label="작성 예정"
                    count={toWritePins.length}
                    active={tab === 'toWrite'}
                    onPress={() => setTab('toWrite')}
                />
            </View>

            {loading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator color={Brand.green} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {tab === 'written' &&
                        (diaries.length === 0 ? (
                            <EmptyBox text="아직 작성된 일기가 없어요. '작성 예정'에서 첫 일기를 남겨보세요." />
                        ) : (
                            diaries.map((diary) => (
                                <TouchableOpacity
                                    key={diary.id}
                                    style={styles.diaryCard}
                                    activeOpacity={0.82}
                                    onPress={() => goEdit(diary)}
                                >
                                    <View style={styles.diaryBody}>
                                        <View style={styles.cardHeaderRow}>
                                            <Text style={styles.placeName} numberOfLines={1}>
                                                📍 {diary.place_name}
                                            </Text>
                                            <Text style={styles.dateText}>
                                                {(diary.updated_at ?? '').slice(0, 10)}
                                            </Text>
                                        </View>
                                        {!!diary.region && <Text style={styles.regionText}>{diary.region}</Text>}
                                        {!!diary.title && (
                                            <Text style={styles.diaryTitle} numberOfLines={1}>
                                                {diary.title}
                                            </Text>
                                        )}
                                        <Text style={styles.diaryPreview} numberOfLines={2}>
                                            {diary.content}
                                        </Text>
                                    </View>
                                    {diary.has_photo && (
                                        <Image
                                            source={{ uri: diaryPhotoUrl(diary.pin_id) }}
                                            style={styles.thumbnail}
                                            contentFit="cover"
                                            transition={150}
                                        />
                                    )}
                                </TouchableOpacity>
                            ))
                        ))}

                    {tab === 'toWrite' &&
                        (toWritePins.length === 0 ? (
                            <EmptyBox text="일기를 기다리는 핀이 없어요. 지도에서 마음에 드는 곳을 핀으로 저장해보세요." />
                        ) : (
                            toWritePins.map((pin) => (
                                <View key={pin.id} style={styles.pinCard}>
                                    <View style={styles.pinInfo}>
                                        <Text style={styles.placeName} numberOfLines={1}>
                                            📍 {pin.place_name}
                                        </Text>
                                        <Text style={styles.regionText}>
                                            {pin.region}
                                            {pin.visited_at ? ` · ${pin.visited_at}` : ''}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.writeButton}
                                        activeOpacity={0.85}
                                        onPress={() => goWrite(pin)}
                                    >
                                        <Text style={styles.writeButtonText}>일기 작성</Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        ))}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

function SegmentButton({
    label,
    count,
    active,
    onPress,
}: {
    label: string;
    count: number;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.segmentButton, active && styles.segmentButtonActive]}
            activeOpacity={0.85}
            onPress={onPress}
        >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {label} {count}
            </Text>
        </TouchableOpacity>
    );
}

function EmptyBox({ text }: { text: string }) {
    return (
        <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: ScreenTheme.background,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    title: {
        fontFamily: Fonts.serif,
        fontSize: 28,
        fontWeight: '800',
        color: Brand.green,
    },
    subtitle: {
        marginTop: 6,
        fontSize: 13,
        fontWeight: '600',
        color: ScreenTheme.muted,
    },
    segment: {
        flexDirection: 'row',
        marginHorizontal: 24,
        marginTop: 18,
        padding: 4,
        borderRadius: 999,
        backgroundColor: '#ececE4',
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 999,
        alignItems: 'center',
    },
    segmentButtonActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '700',
        color: ScreenTheme.muted,
    },
    segmentTextActive: {
        color: ScreenTheme.greenDeep,
    },
    centerBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 18,
        paddingBottom: 40,
    },
    diaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: ScreenTheme.card,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 1,
    },
    diaryBody: {
        flex: 1,
    },
    thumbnail: {
        width: 56,
        height: 56,
        borderRadius: 10,
        marginLeft: 12,
        backgroundColor: '#eceae3',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    placeName: {
        flex: 1,
        fontSize: 15,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    dateText: {
        marginLeft: 8,
        fontSize: 11,
        fontWeight: '600',
        color: ScreenTheme.muted,
    },
    regionText: {
        marginTop: 3,
        fontSize: 11,
        fontWeight: '600',
        color: ScreenTheme.muted,
    },
    diaryTitle: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '700',
        color: ScreenTheme.text,
    },
    diaryPreview: {
        marginTop: 5,
        fontSize: 13,
        lineHeight: 20,
        color: '#6f766f',
    },
    pinCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: ScreenTheme.card,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 1,
    },
    pinInfo: {
        flex: 1,
        marginRight: 12,
    },
    writeButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: Brand.green,
    },
    writeButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
    emptyBox: {
        marginTop: 60,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    emptyText: {
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '600',
        textAlign: 'center',
        color: ScreenTheme.muted,
    },
});
