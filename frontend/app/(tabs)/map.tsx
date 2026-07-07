import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { API_BASE_URL } from '@/constants/api';
import { recentPins } from '@/constants/HomeMockData';
import { Brand, Fonts } from '@/constants/theme';

const ScreenTheme = {
    background: '#f9f8f2',
    text: '#1A1A1A',
};

const KAKAO_MAP_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY;

function buildMapHtml(appkey: string): string {
    const markers = recentPins.map((pin) => ({
        id: pin.id,
        title: pin.title,
        region: pin.region,
        memo: pin.memo,
        lat: pin.lat,
        lng: pin.lng,
    }));

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
    const pins = ${JSON.stringify(markers)};

    const MAX_WAIT_MS = 8000;
    const POLL_INTERVAL_MS = 200;
    let waited = 0;

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
            const map = new kakao.maps.Map(document.getElementById('map'), {
              center: new kakao.maps.LatLng(${markers[0]?.lat ?? 36.8}, ${markers[0]?.lng ?? 128.9}),
              level: 9,
            });

            const bounds = new kakao.maps.LatLngBounds();

            pins.forEach(function (pin) {
              const position = new kakao.maps.LatLng(pin.lat, pin.lng);
              bounds.extend(position);

              const marker = new kakao.maps.Marker({ position, map });

              const infowindow = new kakao.maps.InfoWindow({
                content:
                  '<div style="padding:8px 10px;font-size:12px;line-height:1.5;min-width:120px;">' +
                  '<strong>' + pin.title + '</strong><br/>' +
                  '<span style="color:#888;">' + pin.region + '</span><br/>' +
                  pin.memo +
                  '</div>',
              });

              kakao.maps.event.addListener(marker, 'click', function () {
                infowindow.open(map, marker);
              });
            });

            if (pins.length > 0) {
              map.setBounds(bounds);
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
    const [loadFailed, setLoadFailed] = useState(false);
    const html = useMemo(
        () => (KAKAO_MAP_KEY ? buildMapHtml(KAKAO_MAP_KEY) : ''),
        [],
    );

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
        <View style={styles.mapContainer}>
            <WebView
                originWhitelist={['*']}
                source={{ html, baseUrl: API_BASE_URL }}
                javaScriptEnabled
                domStorageEnabled
                onError={() => setLoadFailed(true)}
                style={styles.webview}
            />
            {loadFailed && (
                <View style={styles.errorOverlay}>
                    <Text style={styles.desc}>지도를 불러오지 못했어요. 네트워크 상태를 확인해주세요.</Text>
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