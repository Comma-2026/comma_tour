import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { categoryEmojiFor } from '@/constants/spotCategory';
import { Brand, Fonts } from '@/constants/theme';
import type { Pin } from '@/types/pin';
import { getPins } from '@/utils/pinStorage';

const ScreenTheme = {
    background: '#f9f8f2',
    text: '#1A1A1A',
    greenDeep: '#1a3a2a',
    muted: '#9AA0A6',
};

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function dateKey(year: number, month0: number, day: number): string {
    return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

/** month0은 0~11(JS Date 규칙). 앞뒤 빈 칸을 null로 채운 7일 단위 주 배열을 반환. */
function buildMonthWeeks(year: number, month0: number): (number | null)[][] {
    const firstWeekday = new Date(year, month0, 1).getDay();
    const daysInMonth = new Date(year, month0 + 1, 0).getDate();

    const cells: (number | null)[] = [
        ...Array(firstWeekday).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

export default function PinRecordsScreen() {
    const router = useRouter();
    const today = useMemo(() => new Date(), []);

    const [pins, setPins] = useState<Pin[]>([]);
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            getPins().then(setPins);
        }, []),
    );

    const pinsByDate = useMemo(() => {
        const map: Record<string, Pin[]> = {};
        for (const pin of pins) {
            (map[pin.visited_at] ??= []).push(pin);
        }
        return map;
    }, [pins]);

    const weeks = useMemo(() => buildMonthWeeks(viewYear, viewMonth), [viewYear, viewMonth]);

    const monthPrefix = `${viewYear}-${pad2(viewMonth + 1)}`;
    const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

    const visiblePins = useMemo(() => {
        if (selectedDate) {
            return pinsByDate[selectedDate] ?? [];
        }
        return pins
            .filter((pin) => pin.visited_at.startsWith(monthPrefix))
            .sort((a, b) => (a.visited_at < b.visited_at ? 1 : -1));
    }, [selectedDate, pinsByDate, pins, monthPrefix]);

    const groupedEntries = useMemo(() => {
        const map = new Map<string, Pin[]>();
        for (const pin of visiblePins) {
            if (!map.has(pin.visited_at)) map.set(pin.visited_at, []);
            map.get(pin.visited_at)!.push(pin);
        }
        return Array.from(map.entries());
    }, [visiblePins]);

    const goPrevMonth = () => {
        setSelectedDate(null);
        if (viewMonth === 0) {
            setViewYear((y) => y - 1);
            setViewMonth(11);
        } else {
            setViewMonth((m) => m - 1);
        }
    };

    const goNextMonth = () => {
        setSelectedDate(null);
        if (viewMonth === 11) {
            setViewYear((y) => y + 1);
            setViewMonth(0);
        } else {
            setViewMonth((m) => m + 1);
        }
    };

    const handleDayPress = (day: number) => {
        const key = dateKey(viewYear, viewMonth, day);
        if (!pinsByDate[key]) return;
        setSelectedDate((prev) => (prev === key ? null : key));
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.headerIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>핀 기록</Text>
                <View style={styles.headerIcon} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <View style={styles.calendarCard}>
                    <View style={styles.monthNav}>
                        <TouchableOpacity style={styles.monthNavButton} onPress={goPrevMonth}>
                            <Text style={styles.monthNavIcon}>‹</Text>
                        </TouchableOpacity>
                        <Text style={styles.monthLabel}>
                            {viewYear}년 {viewMonth + 1}월
                        </Text>
                        <TouchableOpacity style={styles.monthNavButton} onPress={goNextMonth}>
                            <Text style={styles.monthNavIcon}>›</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.weekdayRow}>
                        {WEEKDAY_LABELS.map((label) => (
                            <Text key={label} style={styles.weekdayLabel}>
                                {label}
                            </Text>
                        ))}
                    </View>

                    {weeks.map((week, weekIndex) => (
                        <View key={weekIndex} style={styles.weekRow}>
                            {week.map((day, dayIndex) => {
                                if (day === null) {
                                    return <View key={dayIndex} style={styles.dayCell} />;
                                }
                                const key = dateKey(viewYear, viewMonth, day);
                                const hasPins = Boolean(pinsByDate[key]);
                                const selected = selectedDate === key;
                                const isToday = key === todayKey;
                                return (
                                    <TouchableOpacity
                                        key={dayIndex}
                                        style={styles.dayCell}
                                        activeOpacity={hasPins ? 0.7 : 1}
                                        onPress={() => handleDayPress(day)}
                                    >
                                        <View
                                            style={[
                                                styles.dayCircle,
                                                selected && styles.dayCircleSelected,
                                                isToday && !selected && styles.dayCircleToday,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.dayText,
                                                    !hasPins && styles.dayTextMuted,
                                                    selected && styles.dayTextSelected,
                                                ]}
                                            >
                                                {day}
                                            </Text>
                                        </View>
                                        {hasPins && <View style={[styles.dayDot, selected && styles.dayDotSelected]} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                </View>

                {selectedDate && (
                    <TouchableOpacity style={styles.clearFilterRow} onPress={() => setSelectedDate(null)}>
                        <Text style={styles.clearFilterText}>{selectedDate} 선택 해제 ✕</Text>
                    </TouchableOpacity>
                )}

                {groupedEntries.length === 0 && (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>
                            {selectedDate
                                ? '이 날짜엔 핀 기록이 없어요.'
                                : `${viewYear}년 ${viewMonth + 1}월엔 핀 기록이 없어요.`}
                        </Text>
                    </View>
                )}

                {groupedEntries.map(([date, pinsForDate]) => (
                    <View key={date} style={styles.dateGroup}>
                        <Text style={styles.dateGroupLabel}>{date}</Text>
                        {pinsForDate.map((pin) => (
                            <TouchableOpacity
                                key={pin.id}
                                style={styles.pinCard}
                                activeOpacity={0.82}
                                onPress={() =>
                                    router.push({
                                        pathname: '/pindraw/detail',
                                        params: { id: pin.contentId, from: 'records' },
                                    })
                                }
                            >
                                <View style={styles.pinIconBox}>
                                    <Text style={styles.pinIcon}>{categoryEmojiFor(pin.category)}</Text>
                                </View>
                                <View style={styles.pinContent}>
                                    <Text style={styles.pinTitle} numberOfLines={1}>
                                        {pin.place_name}
                                    </Text>
                                    <Text style={styles.pinRegion}>{pin.region}</Text>
                                    {(pin.phrase || pin.memo) && (
                                        <Text style={styles.pinMemo} numberOfLines={2}>
                                            {pin.phrase ?? pin.memo}
                                        </Text>
                                    )}
                                </View>
                                <Text style={styles.pinArrow}>›</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: ScreenTheme.background,
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
    content: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 48,
    },
    calendarCard: {
        borderRadius: 20,
        backgroundColor: '#ffffff',
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.045,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 2,
    },
    monthNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    monthNavButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthNavIcon: {
        fontSize: 20,
        fontWeight: '700',
        color: ScreenTheme.greenDeep,
    },
    monthLabel: {
        fontFamily: Fonts.serif,
        fontSize: 16,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    weekdayRow: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    weekdayLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: '700',
        color: ScreenTheme.muted,
    },
    weekRow: {
        flexDirection: 'row',
    },
    dayCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 4,
    },
    dayCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayCircleSelected: {
        backgroundColor: ScreenTheme.greenDeep,
    },
    dayCircleToday: {
        borderWidth: 1,
        borderColor: ScreenTheme.greenDeep,
    },
    dayText: {
        fontSize: 13,
        fontWeight: '700',
        color: ScreenTheme.text,
    },
    dayTextMuted: {
        color: '#c9c5b8',
        fontWeight: '500',
    },
    dayTextSelected: {
        color: '#ffffff',
    },
    dayDot: {
        marginTop: 2,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Brand.green,
    },
    dayDotSelected: {
        backgroundColor: ScreenTheme.greenDeep,
    },
    clearFilterRow: {
        marginTop: 14,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#eef5ee',
    },
    clearFilterText: {
        fontSize: 12,
        fontWeight: '700',
        color: ScreenTheme.greenDeep,
    },
    emptyBox: {
        marginTop: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        fontWeight: '600',
        color: ScreenTheme.muted,
    },
    dateGroup: {
        marginTop: 22,
    },
    dateGroupLabel: {
        marginBottom: 8,
        fontSize: 12,
        fontWeight: '800',
        color: ScreenTheme.muted,
    },
    pinCard: {
        minHeight: 74,
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 10,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 1,
    },
    pinIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: ScreenTheme.greenDeep,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinIcon: {
        fontSize: 16,
    },
    pinContent: {
        flex: 1,
        marginLeft: 12,
    },
    pinTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    pinRegion: {
        marginTop: 2,
        fontSize: 10,
        fontWeight: '600',
        color: ScreenTheme.muted,
    },
    pinMemo: {
        marginTop: 4,
        fontSize: 12,
        fontWeight: '500',
        color: '#6f766f',
    },
    pinArrow: {
        marginLeft: 8,
        fontSize: 22,
        color: '#c8c8c8',
    },
});
