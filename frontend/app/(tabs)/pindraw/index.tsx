import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    DEBUG_SOURCE_TYPES,
    FEEDBACK_TAGS,
    PREFERENCE_TAG_GROUPS,
    fetchAvailableRegions,
    fetchDriveDistance,
    fetchRecommendedSpots,
    type SpotCard,
} from '@/api/spots';
import { Brand, Fonts } from '@/constants/theme';
import type { CurrentLocation } from '@/types/location';
import { estimateDrivingLabel } from '@/utils/distance';
import { getCurrentLocation } from '@/utils/location';
import { confirmResetIfNeeded, registerPindrawSession } from '@/utils/pindrawSession';

const ScreenTheme = {
    background: '#f9f8f2',
    text: '#1A1A1A',
    greenDeep: '#1a3a2a',
    muted: '#9AA0A6',
};

export default function PinDrawScreen() {
    const router = useRouter();
    const { justPinned } = useLocalSearchParams<{ justPinned?: string }>();

    // 이번 세션 동안 유지되는 선호(첫 진입 설문). 매 추천 호출에 함께 반영된다.
    const [surveyDone, setSurveyDone] = useState(false);
    const [preference, setPreference] = useState<Set<string>>(new Set());
    const [regions, setRegions] = useState<string[]>([]);
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    // 디버그용 — 12/14/28/38 각 출처가 실제로 잘 불러와졌는지 확인할 때만 쓴다.
    const [debugSourceType, setDebugSourceType] = useState<number | null>(null);

    useEffect(() => {
        fetchAvailableRegions().then(setRegions);
    }, []);

    // 카드 거리 표시용 — 실패해도(권한 거부 등) 조용히 무시하고 서버가 준 대구 기준 거리로 폴백한다.
    const [userLocation, setUserLocation] = useState<CurrentLocation | null>(null);
    useEffect(() => {
        getCurrentLocation()
            .then(setUserLocation)
            .catch(() => setUserLocation(null));
    }, []);

    const [cards, setCards] = useState<SpotCard[]>([]);
    const [index, setIndex] = useState(0);
    const [feedback, setFeedback] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const draw = useCallback(
        async (excludeIds: string[] = [], roundFeedbackTags: string[] = []) => {
            setLoading(true);
            setError(false);
            const tags = [...preference, ...roundFeedbackTags];
            const spots = await fetchRecommendedSpots(excludeIds, tags, selectedRegion, debugSourceType);
            if (spots.length === 0) {
                setError(true);
            } else {
                setCards(spots);
                setIndex(0);
                setFeedback(new Set());
            }
            setLoading(false);
        },
        [preference, selectedRegion, debugSourceType],
    );

    // 설문을 마치면 그 선호를 반영해 첫 3장을 뽑는다.
    useEffect(() => {
        if (surveyDone) draw();
    }, [surveyDone, draw]);

    // 상세 화면에서 "이 여행지로 정하기"로 핀 완료 후 돌아오면, 새 3장으로 다시 시작한다.
    useEffect(() => {
        if (justPinned && surveyDone) {
            draw();
            router.setParams({ justPinned: undefined });
        }
    }, [justPinned, surveyDone, draw, router]);

    // 진행중인 뽑기 존재 확인용 함수
    const surveyDoneRef = useRef(surveyDone);
    useEffect(() => {
        surveyDoneRef.current = surveyDone;
    }, [surveyDone]);

    const resetToSurvey = useCallback(() => {
        setSurveyDone(false);
        setPreference(new Set());
        setSelectedRegion(null);
        setDebugSourceType(null);
        setCards([]);
        setIndex(0);
        setFeedback(new Set());
        setError(false);
    }, []);

    useEffect(() => {
        registerPindrawSession(() => surveyDoneRef.current, resetToSurvey);
    }, [resetToSurvey]);

    // 안드로이드 하드웨어 뒤로가기도 탭 전환과 똑같이 가로챈다 — 진행 중인 뽑기가 있으면
    // 초기화 확인창을 띄우고, 없으면(surveyDoneRef.current === false) 원래 뒤로가기 동작 그대로 둔다.
    useFocusEffect(
        useCallback(() => {
            const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
                if (!surveyDoneRef.current) return false;
                confirmResetIfNeeded(() => router.back());
                return true;
            });
            return () => subscription.remove();
        }, [router]),
    );

    const current = cards[index];

    // 즉시 뜨는 직선거리 근사치 → 카카오모빌리티 실제 도로 거리가 도착하면 조용히 교체.
    // 실패하면(네트워크 오류 등) 근사치에 그대로 머문다.
    const [driveLabel, setDriveLabel] = useState<string | null>(null);
    useEffect(() => {
        setDriveLabel(null);
        if (!current || !userLocation) return;
        let cancelled = false;
        fetchDriveDistance(userLocation, current.lat, current.lng).then((result) => {
            if (!cancelled && result) setDriveLabel(result.label);
        });
        return () => {
            cancelled = true;
        };
    }, [current?.id, userLocation]);

    const distanceLabel =
        driveLabel ??
        (current && userLocation
            ? estimateDrivingLabel(userLocation, { lat: current.lat, lng: current.lng }).label
            : current?.distanceFromDaegu);

    const togglePreference = (tagId: string) => {
        setPreference((prev) => {
            const next = new Set(prev);
            if (next.has(tagId)) {
                next.delete(tagId);
            } else {
                next.add(tagId);
            }
            return next;
        });
    };

    const toggleFeedback = (tagId: string) => {
        setFeedback((prev) => {
            const next = new Set(prev);
            if (next.has(tagId)) {
                next.delete(tagId);
            } else {
                next.add(tagId);
            }
            return next;
        });
    };

    const handlePass = () => {
        if (index < cards.length - 1) {
            setIndex(index + 1);
            return;
        }
        draw(cards.map((card) => card.id), Array.from(feedback));
    };

    const handleOpenDetail = () => {
        if (!current) return;
        router.push({ pathname: '/pindraw/detail', params: { id: current.id } });
    };

    if (!surveyDone) {
        return (
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={styles.surveyBox}>
                    <Text style={styles.surveyTitle}>떠나기 전에 알려주세요</Text>
                    <Text style={styles.surveyDesc}>
                        선호하시는 여행 스타일을 골라주시면, 추천에 반영할게요.{'\n'}
                        선택하지 않으셔도 바로 시작할 수 있어요.
                    </Text>

                    <ScrollView showsVerticalScrollIndicator={false} style={styles.surveyScroll}>
                        {PREFERENCE_TAG_GROUPS.map((group) => (
                            <View key={group.title}>
                                <View style={styles.surveyGroup}>
                                    <Text style={styles.surveyGroupTitle}>{group.title}</Text>
                                    <View style={styles.chipRow}>
                                        {group.tags.map((tag) => {
                                            const selected = preference.has(tag.id);
                                            return (
                                                <TouchableOpacity
                                                    key={tag.id}
                                                    style={[styles.chip, selected && styles.chipSelected]}
                                                    activeOpacity={0.8}
                                                    onPress={() => togglePreference(tag.id)}
                                                >
                                                    <Text
                                                        style={[styles.chipText, selected && styles.chipTextSelected]}
                                                    >
                                                        {tag.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {group.title === '테마별' && (
                                    <View style={styles.surveyGroup}>
                                        <Text style={styles.surveyGroupTitle}>지역</Text>
                                        <View style={styles.chipRow}>
                                            <TouchableOpacity
                                                style={[styles.chip, selectedRegion === null && styles.chipSelected]}
                                                activeOpacity={0.8}
                                                onPress={() => setSelectedRegion(null)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.chipText,
                                                        selectedRegion === null && styles.chipTextSelected,
                                                    ]}
                                                >
                                                    전체
                                                </Text>
                                            </TouchableOpacity>
                                            {regions.map((region) => {
                                                const selected = selectedRegion === region;
                                                return (
                                                    <TouchableOpacity
                                                        key={region}
                                                        style={[styles.chip, selected && styles.chipSelected]}
                                                        activeOpacity={0.8}
                                                        onPress={() => setSelectedRegion(region)}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.chipText,
                                                                selected && styles.chipTextSelected,
                                                            ]}
                                                        >
                                                            {region}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>
                                )}
                            </View>
                        ))}

                        <View style={styles.surveyGroup}>
                            <Text style={styles.surveyGroupTitle}>🔧 (테스트) 출처별로만 뽑기</Text>
                            <View style={styles.chipRow}>
                                <TouchableOpacity
                                    style={[styles.chip, debugSourceType === null && styles.chipSelected]}
                                    activeOpacity={0.8}
                                    onPress={() => setDebugSourceType(null)}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            debugSourceType === null && styles.chipTextSelected,
                                        ]}
                                    >
                                        전체
                                    </Text>
                                </TouchableOpacity>
                                {DEBUG_SOURCE_TYPES.map((type) => {
                                    const selected = debugSourceType === type.id;
                                    return (
                                        <TouchableOpacity
                                            key={type.id}
                                            style={[styles.chip, selected && styles.chipSelected]}
                                            activeOpacity={0.8}
                                            onPress={() => setDebugSourceType(type.id)}
                                        >
                                            <Text
                                                style={[styles.chipText, selected && styles.chipTextSelected]}
                                            >
                                                {type.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.surveyStartButton}
                        activeOpacity={0.85}
                        onPress={() => setSurveyDone(true)}
                    >
                        <Text style={styles.surveyStartButtonText}>쉼표 뽑으러 가기</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => confirmResetIfNeeded(() => router.back())}>
                    <Text style={styles.headerIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>쉼표 뽑기</Text>
                <Text style={styles.headerCounter}>
                    {cards.length > 0 ? `${index + 1}/${cards.length}` : ''}
                </Text>
            </View>

            {!loading && !error && cards.length > 0 && (
                <View style={styles.dotsRow}>
                    {cards.map((card, i) => (
                        <View
                            key={card.id}
                            style={[styles.dot, i === index && styles.dotActive]}
                        />
                    ))}
                </View>
            )}

            {loading && (
                <View style={styles.centerBox}>
                    <ActivityIndicator color={Brand.green} />
                </View>
            )}

            {!loading && error && (
                <View style={styles.centerBox}>
                    <Text style={styles.desc}>추천을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => draw()}>
                        <Text style={styles.retryButtonText}>다시 시도</Text>
                    </TouchableOpacity>
                </View>
            )}

            {!loading && !error && current && (
                <View style={styles.body}>
                    <TouchableOpacity
                        style={styles.banner}
                        activeOpacity={0.9}
                        onPress={handleOpenDetail}
                    >
                        {current.imageUrl ? (
                            <Image
                                source={{ uri: current.imageUrl }}
                                style={styles.bannerImage}
                                contentFit="cover"
                                transition={150}
                            />
                        ) : (
                            <Text style={styles.bannerIcon}>{current.icon}</Text>
                        )}

                        {current.imageUrl && <View style={styles.bannerScrim} />}
                        <View style={styles.bannerTagRow}>
                            {current.tags.map((tag) => (
                                <Text key={tag} style={styles.tagPill}>
                                    {tag}
                                </Text>
                            ))}
                        </View>
                    </TouchableOpacity>

                    <Text style={styles.title}>{current.name}</Text>
                    <Text style={styles.region}>📍 {current.region}</Text>
                    <Text style={styles.cardDesc}>{current.shortDesc}</Text>

                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>● {current.congestion}</Text>
                        <Text style={styles.metaText}>🚗 {distanceLabel}</Text>
                    </View>

                    <Text style={styles.feedbackLabel}>어떤 점이 아쉬웠나요?</Text>
                    <View style={styles.chipRow}>
                        {FEEDBACK_TAGS.map((tag) => {
                            const selected = feedback.has(tag.id);
                            return (
                                <TouchableOpacity
                                    key={tag.id}
                                    style={[styles.chip, selected && styles.chipSelected]}
                                    activeOpacity={0.8}
                                    onPress={() => toggleFeedback(tag.id)}
                                >
                                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                        {tag.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.passButton} activeOpacity={0.85} onPress={handlePass}>
                            <Text style={styles.passButtonText}>✕ 패스</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.pinButton} activeOpacity={0.85} onPress={handleOpenDetail}>
                            <Text style={styles.pinButtonText}>📍 핀하기</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: ScreenTheme.background,
    },
    surveyBox: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 72,
    },
    surveyTitle: {
        fontFamily: Fonts.serif,
        fontSize: 26,
        fontWeight: '800',
        color: Brand.green,
    },
    surveyDesc: {
        marginTop: 10,
        fontSize: 14,
        lineHeight: 22,
        color: ScreenTheme.text,
    },
    surveyScroll: {
        flex: 1,
        marginTop: 10,
    },
    surveyGroup: {
        marginBottom: 20,
    },
    surveyGroupTitle: {
        marginBottom: 8,
        fontSize: 12,
        fontWeight: '800',
        color: ScreenTheme.muted,
    },
    surveyStartButton: {
        marginBottom: 32,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: ScreenTheme.greenDeep,
    },
    surveyStartButtonText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ffffff',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerIcon: {
        width: 32,
        fontSize: 24,
        fontWeight: '600',
        color: ScreenTheme.text,
    },
    headerTitle: {
        fontFamily: Fonts.serif,
        fontSize: 17,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    headerCounter: {
        width: 32,
        textAlign: 'right',
        fontSize: 12,
        fontWeight: '700',
        color: ScreenTheme.muted,
    },
    dotsRow: {
        marginTop: 10,
        paddingHorizontal: 20,
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#e0ddd3',
    },
    dotActive: {
        width: 20,
        backgroundColor: Brand.green,
    },
    centerBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 14,
    },
    body: {
        flex: 1,
        marginTop: 16,
        paddingHorizontal: 20,
    },
    banner: {
        height: 170,
        borderRadius: 20,
        backgroundColor: ScreenTheme.greenDeep,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    bannerIcon: {
        fontSize: 64,
        color: '#ffffff',
    },
    bannerImage: {
        ...StyleSheet.absoluteFillObject,
    },
    bannerScrim: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 56,
        backgroundColor: 'rgba(0,0,0,0.32)',
    },
    bannerTagRow: {
        position: 'absolute',
        left: 14,
        bottom: 12,
        flexDirection: 'row',
        gap: 6,
    },
    tagPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
    title: {
        marginTop: 16,
        fontFamily: Fonts.serif,
        fontSize: 22,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    region: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '700',
        color: ScreenTheme.muted,
    },
    cardDesc: {
        marginTop: 8,
        fontSize: 13,
        lineHeight: 20,
        fontStyle: 'italic',
        color: '#4a4a45',
    },
    metaRow: {
        marginTop: 12,
        flexDirection: 'row',
        gap: 16,
    },
    metaText: {
        fontSize: 12,
        fontWeight: '700',
        color: ScreenTheme.greenDeep,
    },
    feedbackLabel: {
        marginTop: 20,
        fontSize: 13,
        fontWeight: '700',
        color: ScreenTheme.text,
    },
    chipRow: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#d8d4c8',
        backgroundColor: '#ffffff',
    },
    chipSelected: {
        backgroundColor: ScreenTheme.greenDeep,
        borderColor: ScreenTheme.greenDeep,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '600',
        color: ScreenTheme.text,
    },
    chipTextSelected: {
        color: '#ffffff',
    },
    actionRow: {
        marginTop: 'auto',
        marginBottom: 16,
        flexDirection: 'row',
        gap: 10,
    },
    passButton: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: '#eeece3',
    },
    passButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6f6a5c',
    },
    pinButton: {
        flex: 1.4,
        paddingVertical: 15,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: ScreenTheme.greenDeep,
    },
    pinButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    desc: {
        fontSize: 14,
        lineHeight: 22,
        color: ScreenTheme.text,
        textAlign: 'center',
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: Brand.green,
    },
    retryButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
});
