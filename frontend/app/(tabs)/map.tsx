import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';

import { API_BASE_URL } from '@/constants/api';
import { Brand, Fonts } from '@/constants/theme';
import type { Pin } from '@/types/pin';
import { getPins } from '@/utils/pinStorage';

const ScreenTheme = {
    background: '#f9f8f2',
    text: '#1A1A1A',
};

const KAKAO_MAP_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY;

// 경상북도 중심 좌표 (핀이 없을 때 기본 중심)
const GYEONGBUK_CENTER = { lat: 36.5760, lng: 128.5056 };

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
    const MAX_WAIT_MS = 8000;
    const POLL_INTERVAL_MS = 200;
    let waited = 0;

    let map = null;
    let currentMarkers = [];

    function clearMarkers() {
      currentMarkers.forEach(function (marker) {
        marker.setMap(null);
      });
      currentMarkers = [];
    }

    function renderPins(pins) {
      if (!map) {
        return;
      }
      clearMarkers();

      if (!pins || pins.length === 0) {
        map.setCenter(new kakao.maps.LatLng(${GYEONGBUK_CENTER.lat}, ${GYEONGBUK_CENTER.lng}));
        return;
      }

      const bounds = new kakao.maps.LatLngBounds();

      pins.forEach(function (pin) {
        const position = new kakao.maps.LatLng(pin.latitude, pin.longitude);
        bounds.extend(position);

        const marker = new kakao.maps.Marker({ position, map });
        currentMarkers.push(marker);

        const infowindow = new kakao.maps.InfoWindow({
          content:
            '<div style="padding:8px 10px;font-size:12px;line-height:1.5;min-width:120px;">' +
            '<strong>' + pin.place_name + '</strong><br/>' +
            '<span style="color:#888;">' + pin.region + '</span>' +
            '</div>',
        });

        kakao.maps.event.addListener(marker, 'click', function () {
          infowindow.open(map, marker);
        });
      });

      map.setBounds(bounds);
    }

    function handleMessage(event) {
      try {
        const pins = JSON.parse(event.data);
        renderPins(pins);
      } catch (err) {
        showStatus('핀 데이터 처리 오류: ' + err.message);
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
              level: 12,
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

export default function MapScreen() {
    const router = useRouter();
    const webViewRef = useRef<WebView>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [pins, setPins] = useState<Pin[] | null>(null);

    const html = useMemo(
        () => (KAKAO_MAP_KEY ? buildMapHtml(KAKAO_MAP_KEY) : ''),
        [],
    );

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;

            getPins().then((loadedPins) => {
                if (!cancelled) {
                    setPins(loadedPins);
                }
            });

            return () => {
                cancelled = true;
            };
        }, []),
    );

    useEffect(() => {
        if (mapReady && pins !== null) {
            webViewRef.current?.postMessage(JSON.stringify(pins));
        }
    }, [mapReady, pins]);

    const handleMessage = (event: WebViewMessageEvent) => {
        if (event.nativeEvent.data === 'MAP_READY') {
            setMapReady(true);
        }
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

    const showEmptyState = pins !== null && pins.length === 0;

    return (
        <View style={styles.mapContainer}>
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
            {!loadFailed && showEmptyState && (
                <View style={styles.emptyOverlay} pointerEvents="box-none">
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyText}>쉼표를 뽑으면 여기에 핀이 찍혀요 🌿</Text>
                        <TouchableOpacity
                            style={styles.drawButton}
                            activeOpacity={0.85}
                            onPress={() => router.push('/(tabs)/pindraw')}
                        >
                            <Text style={styles.drawButtonText}>쉼표 뽑기</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 72,
        backgroundColor: ScreenTheme.background,
    },
    mapContainer: {
        flex: 1,
        backgroundColor: ScreenTheme.background,
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
    emptyOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 32,
        alignItems: 'center',
    },
    emptyCard: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
        color: ScreenTheme.text,
    },
    drawButton: {
        marginTop: 12,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: Brand.green,
    },
    drawButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    title: {
        fontFamily: Fonts.serif,
        fontSize: 28,
        fontWeight: '800',
        color: Brand.green,
    },
    desc: {
        marginTop: 12,
        fontSize: 14,
        lineHeight: 22,
        color: ScreenTheme.text,
        textAlign: 'center',
    },
});
