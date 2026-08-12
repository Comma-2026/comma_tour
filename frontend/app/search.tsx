import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchSpotCatalog, type SpotCatalogItem } from '@/api/spots';
import {
    CATEGORY_EMOJI,
    CATEGORY_ICON_BG,
    CATEGORY_LABEL,
    toSpotCategory,
} from '@/constants/spotCategory';
import { Brand, Fonts } from '@/constants/theme';

const ScreenTheme = {
    background: '#f9f8f2',
    card: '#ffffff',
    text: '#1A1A1A',
    greenDeep: '#1a3a2a',
    muted: '#9AA0A6',
};

/**
 * 장소 검색 화면(홈 '장소 검색' 카드에서 진입).
 * 카탈로그(경북 관광지 전체)를 한 번 받아두고 글자 입력마다 프론트에서 즉시 필터링한다.
 * — 787곳 수준이라 서버 검색 API 없이도 타이핑과 동시에 결과가 나온다.
 * 결과를 탭하면 쉼표뽑기와 동일한 상세 페이지(핀 추가 버튼 포함)로 이동한다.
 */
export default function SearchScreen() {
    const router = useRouter();

    const [catalog, setCatalog] = useState<SpotCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState('');

    const loadCatalog = () => {
        setLoading(true);
        setFailed(false);
        fetchSpotCatalog().then((spots) => {
            setCatalog(spots);
            setFailed(spots.length === 0);
            setLoading(false);
        });
    };

    useEffect(loadCatalog, []);

    const results = useMemo(() => {
        const q = query.trim();
        if (!q) return [];
        return catalog.filter(
            (spot) =>
                spot.name.includes(q) ||
                spot.region.includes(q) ||
                spot.shortDesc.includes(q),
        );
    }, [catalog, query]);

    const goDetail = (spot: SpotCatalogItem) => {
        // from 파라미터 없이 열면 "이 여행지로 정하기"(핀 추가) 버튼이 있는 기본 모드.
        router.push({ pathname: '/pindraw/detail', params: { id: spot.id } });
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Text style={styles.headerIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>장소 검색</Text>
                <View style={styles.headerIcon} />
            </View>

            <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                    style={styles.searchInput}
                    placeholder="관광지 이름, 지역, 주소로 검색"
                    placeholderTextColor={Brand.placeholder}
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                    returnKeyType="search"
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                        <Text style={styles.clearIcon}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator color={Brand.green} />
                </View>
            ) : failed ? (
                <View style={styles.centerBox}>
                    <Text style={styles.emptyText}>
                        장소 목록을 불러오지 못했어요.{'\n'}네트워크를 확인해주세요.
                    </Text>
                    <TouchableOpacity style={styles.retryButton} onPress={loadCatalog}>
                        <Text style={styles.retryText}>다시 시도</Text>
                    </TouchableOpacity>
                </View>
            ) : query.trim() === '' ? (
                <View style={styles.centerBox}>
                    <Text style={styles.emptyText}>
                        가고 싶은 곳을 검색해보세요.{'\n'}경북 관광지 {catalog.length}곳에서 찾아드려요.
                    </Text>
                </View>
            ) : results.length === 0 ? (
                <View style={styles.centerBox}>
                    <Text style={styles.emptyText}>
                        &lsquo;{query.trim()}&rsquo; 검색 결과가 없어요.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    ListHeaderComponent={
                        <Text style={styles.resultCount}>{results.length}개의 장소</Text>
                    }
                    renderItem={({ item }) => {
                        const category = toSpotCategory(item.category);
                        return (
                            <TouchableOpacity
                                style={styles.resultCard}
                                activeOpacity={0.82}
                                onPress={() => goDetail(item)}
                            >
                                <View
                                    style={[
                                        styles.resultIcon,
                                        { backgroundColor: CATEGORY_ICON_BG[category] },
                                    ]}
                                >
                                    <Text style={styles.resultIconText}>
                                        {CATEGORY_EMOJI[category]}
                                    </Text>
                                </View>
                                <View style={styles.resultBody}>
                                    <View style={styles.resultTitleRow}>
                                        <Text style={styles.resultName} numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <View style={styles.resultTagPill}>
                                            <Text style={styles.resultTagText}>
                                                {CATEGORY_LABEL[category]}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.resultRegion} numberOfLines={1}>
                                        📍 {item.region}
                                        {item.shortDesc ? ` · ${item.shortDesc}` : ''}
                                    </Text>
                                </View>
                                <Text style={styles.resultArrow}>›</Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
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
    searchBar: {
        marginTop: 12,
        marginHorizontal: 20,
        paddingHorizontal: 14,
        height: 46,
        borderRadius: 12,
        backgroundColor: ScreenTheme.card,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    searchIcon: {
        marginRight: 8,
        fontSize: 15,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: ScreenTheme.text,
        padding: 0,
    },
    clearIcon: {
        marginLeft: 8,
        fontSize: 14,
        color: ScreenTheme.muted,
    },
    centerBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 60,
    },
    emptyText: {
        fontSize: 13,
        lineHeight: 21,
        fontWeight: '600',
        textAlign: 'center',
        color: ScreenTheme.muted,
    },
    retryButton: {
        marginTop: 14,
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: '#eef5ee',
    },
    retryText: {
        fontSize: 12,
        fontWeight: '700',
        color: ScreenTheme.greenDeep,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 32,
    },
    resultCount: {
        marginBottom: 10,
        fontSize: 12,
        fontWeight: '700',
        color: ScreenTheme.muted,
    },
    resultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        padding: 12,
        borderRadius: 16,
        backgroundColor: ScreenTheme.card,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 1,
    },
    resultIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resultIconText: {
        fontSize: 19,
    },
    resultBody: {
        flex: 1,
        marginLeft: 12,
    },
    resultTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    resultName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    resultTagPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: '#eef5ee',
    },
    resultTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: ScreenTheme.greenDeep,
    },
    resultRegion: {
        marginTop: 4,
        fontSize: 11,
        fontWeight: '600',
        color: ScreenTheme.muted,
    },
    resultArrow: {
        marginLeft: 8,
        fontSize: 22,
        color: '#c8c8c8',
    },
});
