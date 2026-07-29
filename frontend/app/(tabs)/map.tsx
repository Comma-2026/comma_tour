import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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

import { API_BASE_URL } from '@/constants/api';
import { spotMarkers } from '@/constants/SpotMockData';
import { Fonts } from '@/constants/theme';
import type { SpotCategory, SpotMarker } from '@/types/spot';
import { getPins } from '@/utils/pinStorage';

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

const CATEGORY_EMOJI: Record<SpotCategory, string> = {
    nature: '🏔',
    culture: '🏛',
    night: '🌃',
    etc: '📍',
};

const CATEGORY_LABEL: Record<SpotCategory, string> = {
    nature: '자연',
    culture: '문화',
    night: '야경',
    etc: '기타',
};

const CATEGORY_ICON_BG: Record<SpotCategory, string> = {
    nature: '#e3f0e6',
    culture: '#f1e6da',
    night: '#1f2a44',
    etc: '#eceae3',
};

type CategoryFilter = 'all' | SpotCategory;

const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'nature', label: '자연' },
    { key: 'culture', label: '문화' },
    { key: 'night', label: '야경' },
];

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
    const CATEGORY_EMOJI = { nature: '🏔', culture: '🏛', night: '🌃', etc: '📍' };

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
        el.style.transform = 'translate(-50%, -100%)';

        const overlay = new kakao.maps.CustomOverlay({
          position: position,
          content: el,
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

function SpotCard({ spot, onPress }: { spot: SpotMarker; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
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
                <Text style={styles.cardDesc} numberOfLines={2}>
                    {spot.description}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

export default function MapScreen() {
    const { height: windowHeight } = useWindowDimensions();
    const mapHeight = windowHeight * 0.37;

    const webViewRef = useRef<WebView>(null);
    const flatListRef = useRef<FlatList<SpotMarker>>(null);

    const [loadFailed, setLoadFailed] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [category, setCategory] = useState<CategoryFilter>('all');

    const html = useMemo(
        () => (KAKAO_MAP_KEY ? buildMapHtml(KAKAO_MAP_KEY) : ''),
        [],
    );

    useFocusEffect(
        useCallback(() => {
            // TODO: "내가 방문한 곳" 강조 표시 확장용 — 지금은 조회만 해두고 렌더링엔 미사용
            getPins();
        }, []),
    );

    const filteredSpots = useMemo(() => {
        const query = searchText.trim();
        return spotMarkers.filter((spot) => {
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
    }, [searchText, category]);

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
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerLabel}>지도</Text>
                <Text style={styles.headerTitle}>지도 페이지</Text>
                <Text style={styles.headerCount}>경상북도 {filteredSpots.length}곳</Text>
            </View>

            <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                    style={styles.searchInput}
                    placeholder="관광지 이름, 지역, 태그로 검색"
                    placeholderTextColor={ScreenTheme.muted}
                    value={searchText}
                    onChangeText={setSearchText}
                />
            </View>

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

            <Text style={styles.resultCount}>{filteredSpots.length}개의 장소</Text>

            <FlatList
                ref={flatListRef}
                style={styles.list}
                data={filteredSpots}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <SpotCard spot={item} onPress={() => handleCardPress(item)} />
                )}
                contentContainerStyle={styles.listContent}
                onScrollToIndexFailed={(info) => {
                    flatListRef.current?.scrollToOffset({
                        offset: info.averageItemLength * info.index,
                        animated: true,
                    });
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 72,
        backgroundColor: ScreenTheme.background,
    },
    safe: {
        flex: 1,
        backgroundColor: ScreenTheme.background,
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
    headerTitle: {
        fontFamily: Fonts.serif,
        fontSize: 18,
        fontWeight: '800',
        color: ScreenTheme.text,
    },
    headerCount: {
        fontSize: 11,
        fontWeight: '700',
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
    resultCount: {
        marginTop: 12,
        marginBottom: 8,
        paddingHorizontal: 20,
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
        padding: 12,
        borderRadius: 16,
        backgroundColor: ScreenTheme.card,
        shadowColor: '#000',
        shadowOpacity: 0.045,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 2,
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
