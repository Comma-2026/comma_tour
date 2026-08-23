import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { API_BASE_URL } from '@/constants/api';
import { CATEGORY_EMOJI, CATEGORY_ICON_BG, CATEGORY_LABEL, toSpotCategory } from '@/constants/spotCategory';
import { Fonts } from '@/constants/theme';
import type { Pin } from '@/types/pin';
import type { SpotCategory, SpotMarker } from '@/types/spot';
import { deletePin, getPins } from '@/utils/pinStorage';

const ScreenTheme = {
    background: '#f7f4ef',
    card: '#ffffff',
    text: '#1A1A1A',
    muted: '#9AA0A6',
    deepGreen: '#2d5a3d',
};

const KAKAO_MAP_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY;

// 경상북도 중심 좌표
const GYEONGBUK_CENTER = { lat: 36.576, lng: 128.5056 };

type CategoryFilter = 'all' | SpotCategory;

// 야경은 뺐다 — 국문관광정보 분류 체계엔 "시간대(밤에 보기 좋음)" 속성이 없어서 실데이터로 못 채운다.
const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'nature', label: '자연' },
    { key: 'history', label: '역사' },
    { key: 'culture', label: '문화' },
    { key: 'experience', label: '체험' },
];

function toSpotMarker(pin: Pin): SpotMarker {
    return {
        id: pin.id,
        contentId: pin.contentId,
        place_name: pin.place_name,
        region: pin.region,
        category: toSpotCategory(pin.category),
        latitude: pin.latitude,
        longitude: pin.longitude,
        description: pin.phrase ?? pin.memo ?? '',
    };
}

function buildMapHtml(appkey: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="referrer" content="no-referrer" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
    #status {
      position: absolute; top: 0; left: 0; right: 0; z-index: 10;
      padding: 12px; font-family: sans-serif; font-size: 12px; line-height: 1.5;
      color: #900; background: #fff3f3; white-space: pre-wrap; display: none;
    }
  </style>
</head>
<body>
  <div id="status"></div>
  <div id="map"></div>
  <script>
    function showStatus(msg) {
      const el = document.getElementById('status');
      el.style.display = 'block';
      el.textContent = el.textContent ? el.textContent + '\\n---\\n' + msg : msg;
    }
    window.onerror = function (msg, src, line, col) {
      showStatus('JS 오류: ' + msg + '\\n(' + src + ':' + line + ')');
    };
  </script>
  <script
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false"
    onerror="showStatus('카카오맵 SDK 스크립트 로드 실패 (네트워크 연결 또는 앱키 확인)')"
  ></script>
  <script>
    const CATEGORY_EMOJI = { nature: '🏔', history: '⛩', culture: '🏙', experience: '🎨', night: '🌃', etc: '📍' };

    const MAX_WAIT_MS = 8000;
    const POLL_INTERVAL_MS = 200;
    let waited = 0;

    let map = null;
    let currentOverlays = [];
    let openInfowindow = null;

    function closeOpenInfowindow() {
      if (openInfowindow) {
        openInfowindow.close();
        openInfowindow = null;
      }
    }

    function openInfowindowFor(infowindow) {
      closeOpenInfowindow();
      infowindow.open(map);
      openInfowindow = infowindow;
    }

    function clearOverlays() {
      closeOpenInfowindow();
      currentOverlays.forEach(function (item) {
        item.overlay.setMap(null);
      });
      currentOverlays = [];
    }

    function renderMarkers(spots) {
      if (!map) {
        return;
      }
      clearOverlays();

      if (!spots || spots.length === 0) {
        map.setCenter(new kakao.maps.LatLng(${GYEONGBUK_CENTER.lat}, ${GYEONGBUK_CENTER.lng}));
        return;
      }

      const bounds = new kakao.maps.LatLngBounds();

      spots.forEach(function (spot) {
        const position = new kakao.maps.LatLng(spot.latitude, spot.longitude);
        bounds.extend(position);

        const el = document.createElement('div');
        el.textContent = CATEGORY_EMOJI[spot.category] || '📍';
        el.style.fontSize = '26px';
        el.style.lineHeight = '1';
        el.style.cursor = 'pointer';

        // 이모지 글꼴은 글리프 아래쪽(베이스라인 아래)에 자체 여백이 있어, 박스 맨아래(=좌표)보다
        // 그림이 살짝 떠 보인다. 보이는 그림의 아래끝이 좌표에 닿도록 아래로 미세 보정한다.
        // (% 기준 = 아이콘 높이 26px. 어긋나 보이면 카테고리별로 이 값만 조정하면 된다)
        const EMOJI_NUDGE_Y = { nature: '12%', culture: '12%', night: '12%', etc: '10%' };
        el.style.transform = 'translateY(' + (EMOJI_NUDGE_Y[spot.category] || '10%') + ')';

        // 위치 지정은 CustomOverlay의 anchor로 한다(xAnchor 0.5 = 가로 중앙, yAnchor 1 = 세로 맨아래).
        // 위 translateY는 글꼴 여백 보정용 소량 이동일 뿐, 앵커를 대신하면 안 된다.
        const overlay = new kakao.maps.CustomOverlay({
          position: position,
          content: el,
          xAnchor: 0.5,
          yAnchor: 1,
        });
        overlay.setMap(map);

        const infowindow = new kakao.maps.InfoWindow({
          position: position,
          content:
            '<div style="padding:8px 10px;font-size:12px;line-height:1.5;min-width:120px;">' +
            '<strong>' + spot.place_name + '</strong><br/>' +
            '<span style="color:#888;">' + spot.region + '</span>' +
            '</div>',
        });

        el.addEventListener('click', function () {
          openInfowindowFor(infowindow);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({ type: 'MARKER_CLICK', contentId: spot.contentId })
            );
          }
        });

        currentOverlays.push({ overlay: overlay, infowindow: infowindow, position: position, contentId: spot.contentId });
      });

      if (spots.length === 1) {
        map.setCenter(new kakao.maps.LatLng(spots[0].latitude, spots[0].longitude));
        map.setLevel(6);
      } else {
        map.setBounds(bounds);
      }
    }

    function focusMarker(contentId) {
      if (!map) {
        return;
      }
      const found = currentOverlays.find(function (item) {
        return item.contentId === contentId;
      });
      if (!found) {
        return;
      }
      map.setCenter(found.position);
      map.setLevel(6);
      openInfowindowFor(found.infowindow);
    }

    function handleMessage(event) {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'SET_MARKERS') {
          renderMarkers(msg.markers);
        } else if (msg.type === 'FOCUS_MARKER') {
          focusMarker(msg.contentId);
        }
      } catch (err) {
        showStatus('메시지 처리 오류: ' + err.message);
      }
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    function waitForKakaoThenInit() {
      if (typeof kakao !== 'undefined') {
        initMap();
        return;
      }
      waited += POLL_INTERVAL_MS;
      if (waited >= MAX_WAIT_MS) {
        showStatus('카카오맵 SDK가 ' + (MAX_WAIT_MS / 1000) + '초 안에 로드되지 않았어요 (kakao 객체 없음). 네트워크 연결 또는 앱키를 확인해주세요.');
        return;
      }
      setTimeout(waitForKakaoThenInit, POLL_INTERVAL_MS);
    }

    function initMap() {
      try {
        kakao.maps.load(function () {
          try {
            map = new kakao.maps.Map(document.getElementById('map'), {
              center: new kakao.maps.LatLng(${GYEONGBUK_CENTER.lat}, ${GYEONGBUK_CENTER.lng}),
              level: 8,
            });

            kakao.maps.event.addListener(map, 'click', function () {
              closeOpenInfowindow();
            });

            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage('MAP_READY');
            }
          } catch (err) {
            showStatus('지도 초기화 오류: ' + err.message);
          }
        });
      } catch (err) {
        showStatus('카카오맵 SDK 오류: ' + err.message);
      }
    }

    waitForKakaoThenInit();
  </script>
</body>
</html>`;
}

function SpotCard({
    spot,
    onPress,
    onDetailPress,
    onDelete,
}: {
    spot: SpotMarker;
    onPress: () => void;
    onDetailPress: () => void;
    onDelete: () => void;
}) {
    // 핀 기록 화면(pin-records)의 카드와 동일한 스와이프 삭제 — 왼쪽으로 밀면 빨간 휴지통.
    const renderRightActions = () => (
        <TouchableOpacity
            style={styles.deleteAction}
            activeOpacity={0.85}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`${spot.place_name} 핀 삭제`}
        >
            <Svg width={24} height={24} viewBox="0 0 16 16" fill="white">
                <Path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" fill="white" />
                <Path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" fill="white" />
            </Svg>
        </TouchableOpacity>
    );

    return (
        <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
            <View style={styles.card}>
            <TouchableOpacity style={styles.cardMain} activeOpacity={0.85} onPress={onPress}>
                <View style={[styles.cardIcon, { backgroundColor: CATEGORY_ICON_BG[spot.category] }]}>
                    <Text style={styles.cardIconText}>{CATEGORY_EMOJI[spot.category]}</Text>
                </View>
                <View style={styles.cardBody}>
                    <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                            {spot.place_name}
                        </Text>
                        <View style={styles.cardTagPill}>
                            <Text style={styles.cardTagText}>{CATEGORY_LABEL[spot.category]}</Text>
                        </View>
                    </View>
                    <Text style={styles.cardRegion}>📍 {spot.region}</Text>
                    {!!spot.description && (
                        <Text style={styles.cardDesc} numberOfLines={2}>
                            {spot.description}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.detailButton}
                activeOpacity={0.7}
                onPress={onDetailPress}
                accessibilityRole="button"
                accessibilityLabel={`${spot.place_name} 상세보기`}
            >
                <Ionicons name="chevron-forward" size={22} color={ScreenTheme.deepGreen} />
            </TouchableOpacity>
            </View>
        </Swipeable>
    );
}

export default function MapScreen() {
    const router = useRouter();
    const { height: windowHeight } = useWindowDimensions();
    const mapHeight = windowHeight * 0.37;

    const webViewRef = useRef<WebView>(null);
    const flatListRef = useRef<FlatList<SpotMarker>>(null);

    const [loadFailed, setLoadFailed] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [category, setCategory] = useState<CategoryFilter>('all');
    const [spots, setSpots] = useState<SpotMarker[]>([]);
    const [pinsLoading, setPinsLoading] = useState(true);

    const html = useMemo(
        () => (KAKAO_MAP_KEY ? buildMapHtml(KAKAO_MAP_KEY) : ''),
        [],
    );

    // 탭에 다시 들어올 때마다 새로고침 — 쉼표뽑기에서 방금 찍은 핀도 바로 보이도록.
    useFocusEffect(
        useCallback(() => {
            getPins().then((pins) => {
                setSpots(pins.map(toSpotMarker));
                setPinsLoading(false);
            });
        }, []),
    );

    const filteredSpots = useMemo(() => {
        const query = searchText.trim();
        return spots.filter((spot) => {
            if (category !== 'all' && spot.category !== category) {
                return false;
            }
            if (!query) {
                return true;
            }
            return (
                spot.place_name.includes(query) ||
                spot.region.includes(query) ||
                CATEGORY_LABEL[spot.category].includes(query)
            );
        });
    }, [spots, searchText, category]);

    useEffect(() => {
        if (mapReady) {
            webViewRef.current?.postMessage(
                JSON.stringify({ type: 'SET_MARKERS', markers: filteredSpots }),
            );
        }
    }, [mapReady, filteredSpots]);

    const handleMessage = (event: WebViewMessageEvent) => {
        const data = event.nativeEvent.data;
        if (data === 'MAP_READY') {
            setMapReady(true);
            return;
        }

        try {
            const msg = JSON.parse(data) as { type?: string; contentId?: string };
            if (msg.type === 'MARKER_CLICK' && msg.contentId) {
                const index = filteredSpots.findIndex((spot) => spot.contentId === msg.contentId);
                if (index >= 0) {
                    flatListRef.current?.scrollToIndex({ index, animated: true });
                }
            }
        } catch {
            // MAP_READY 외의 알 수 없는 메시지는 무시
        }
    };

    const handleCardPress = (spot: SpotMarker) => {
        webViewRef.current?.postMessage(
            JSON.stringify({ type: 'FOCUS_MARKER', contentId: spot.contentId }),
        );
    };

    const handleDetailPress = (spot: SpotMarker) => {
        // 핀 기록 화면의 카드 화살표(>)와 동일한 읽기 전용 상세로 연다
        // (from: 'records' → "이 여행지로 정하기" 버튼 없이 길찾기만).
        router.push({ pathname: '/spot-detail', params: { id: spot.contentId, from: 'records' } });
    };

    // 핀 기록 화면과 동일한 삭제 흐름 — 확인창 후 로컬 저장소에서 지우고 목록/지도 마커 갱신.
    const handleDeletePin = (spot: SpotMarker) => {
        Alert.alert('핀 삭제', '이 저장된 핀을 삭제할까요?', [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                    await deletePin(spot.id);
                    setSpots((prev) => prev.filter((s) => s.id !== spot.id));
                },
            },
        ]);
    };

    if (!KAKAO_MAP_KEY) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>지도</Text>
                <Text style={styles.desc}>
                    카카오맵 앱키가 설정되지 않았어요.{'\n'}
                    frontend/.env.local 에 EXPO_PUBLIC_KAKAO_MAP_KEY 값을 넣어주세요.
                </Text>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerLabel}>지도</Text>
                <Text style={styles.headerCount}>내 핀 {spots.length}곳</Text>
            </View>

            <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                    style={styles.searchInput}
                    placeholder="찍은 핀 이름, 지역으로 검색"
                    placeholderTextColor={ScreenTheme.muted}
                    value={searchText}
                    onChangeText={setSearchText}
                />
            </View>

            {pinsLoading ? (
                <View style={styles.catalogLoadingBox}>
                    <ActivityIndicator color={ScreenTheme.deepGreen} />
                    <Text style={styles.desc}>핀 기록을 불러오는 중이에요…</Text>
                </View>
            ) : spots.length === 0 ? (
                <View style={styles.catalogLoadingBox}>
                    <Text style={styles.emptyIcon}>📍</Text>
                    <Text style={styles.desc}>
                        아직 찍은 핀이 없어요.{'\n'}쉼표뽑기에서 마음에 드는 곳을 핀으로 남겨보세요.
                    </Text>
                </View>
            ) : (
                <>
                    <View style={[styles.mapWrap, { height: mapHeight }]}>
                        <WebView
                            ref={webViewRef}
                            originWhitelist={['*']}
                            source={{ html, baseUrl: API_BASE_URL }}
                            javaScriptEnabled
                            domStorageEnabled
                            onMessage={handleMessage}
                            onError={() => setLoadFailed(true)}
                            style={styles.webview}
                        />
                        {loadFailed && (
                            <View style={styles.errorOverlay}>
                                <Text style={styles.desc}>지도를 불러오지 못했어요. 네트워크 상태를 확인해주세요.</Text>
                            </View>
                        )}
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoryScroll}
                        contentContainerStyle={styles.categoryRow}
                    >
                        {CATEGORY_TABS.map((tab) => {
                            const selected = category === tab.key;
                            return (
                                <TouchableOpacity
                                    key={tab.key}
                                    style={[styles.categoryPill, selected && styles.categoryPillSelected]}
                                    activeOpacity={0.85}
                                    onPress={() => setCategory(tab.key)}
                                >
                                    <Text
                                        style={[
                                            styles.categoryPillText,
                                            selected && styles.categoryPillTextSelected,
                                        ]}
                                    >
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.resultHeader}>
                        <Text style={styles.resultCount}>{filteredSpots.length}개의 장소</Text>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => router.push('/pin-records')}
                            accessibilityRole="button"
                            accessibilityLabel="핀 기록 전체보기"
                        >
                            <Text style={styles.recordsButtonText}>전체보기 ›</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        ref={flatListRef}
                        style={styles.list}
                        data={filteredSpots}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <SpotCard
                                spot={item}
                                onPress={() => handleCardPress(item)}
                                onDetailPress={() => handleDetailPress(item)}
                                onDelete={() => handleDeletePin(item)}
                            />
                        )}
                        contentContainerStyle={styles.listContent}
                        onScrollToIndexFailed={(info) => {
                            flatListRef.current?.scrollToOffset({
                                offset: info.averageItemLength * info.index,
                                animated: true,
                            });
                        }}
                    />
                </>
            )}
        </SafeAreaView>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 72,
        backgroundColor: ScreenTheme.background,
    },
    gestureRoot: {
        flex: 1,
        backgroundColor: ScreenTheme.background,
    },
    safe: {
        flex: 1,
        backgroundColor: ScreenTheme.background,
    },
    deleteAction: {
        width: 74,
        marginLeft: 10,
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: '#d94b4b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 8,
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
    },
    headerLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: ScreenTheme.muted,
    },
    headerCount: {
        fontSize: 11,
        fontWeight: '700',
        color: ScreenTheme.deepGreen,
    },
    recordsButtonText: {
        fontSize: 13,
        fontWeight: '800',
        color: ScreenTheme.deepGreen,
    },
    searchBar: {
        marginTop: 12,
        marginHorizontal: 20,
        paddingHorizontal: 14,
        height: 44,
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
        fontSize: 13,
        color: ScreenTheme.text,
        padding: 0,
    },
    mapWrap: {
        marginTop: 12,
        overflow: 'hidden',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    errorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        backgroundColor: ScreenTheme.background,
    },
    catalogLoadingBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 24,
    },
    emptyIcon: {
        fontSize: 32,
    },
    categoryScroll: {
        marginTop: 12,
        flexGrow: 0,
    },
    categoryRow: {
        paddingHorizontal: 20,
        gap: 8,
    },
    categoryPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: ScreenTheme.deepGreen,
        backgroundColor: '#ffffff',
    },
    categoryPillSelected: {
        backgroundColor: ScreenTheme.deepGreen,
    },
    categoryPillText: {
        fontSize: 13,
        fontWeight: '700',
        color: ScreenTheme.deepGreen,
    },
    categoryPillTextSelected: {
        color: '#ffffff',
    },
    resultHeader: {
        marginTop: 12,
        marginBottom: 8,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    resultCount: {
        fontSize: 12,
        fontWeight: '700',
        color: ScreenTheme.muted,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    card: {
        flexDirection: 'row',
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: ScreenTheme.card,
        shadowColor: '#000',
        shadowOpacity: 0.045,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 2,
    },
    cardMain: {
        flex: 1,
        flexDirection: 'row',
        padding: 12,
    },
    detailButton: {
        width: 52,
        alignItems: 'center',
        justifyContent: 'center',
        borderLeftWidth: 1,
        borderLeftColor: '#eef0eb',
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        backgroundColor: '#ffffff',
    },
    cardIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardIconText: {
        fontSize: 20,
    },
    cardBody: {
        flex: 1,
        marginLeft: 12,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    cardTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    cardTagPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: '#eef5ee',
    },
    cardTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: ScreenTheme.deepGreen,
    },
    cardRegion: {
        marginTop: 4,
        fontSize: 11,
        fontWeight: '600',
        color: ScreenTheme.muted,
    },
    cardDesc: {
        marginTop: 4,
        fontSize: 12,
        lineHeight: 18,
        color: '#6f766f',
    },
    title: {
        fontFamily: Fonts.serif,
        fontSize: 28,
        fontWeight: '800',
        color: ScreenTheme.deepGreen,
    },
    desc: {
        marginTop: 12,
        fontSize: 14,
        lineHeight: 22,
        color: ScreenTheme.text,
        textAlign: 'center',
    },
});
