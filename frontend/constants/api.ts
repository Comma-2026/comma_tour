import { Platform } from 'react-native';

/**
 * 백엔드(Flask) 기본 URL.
 *
 * - 웹 / iOS 시뮬레이터: localhost
 * - 안드로이드 에뮬레이터: 10.0.2.2 (호스트 PC를 가리키는 특수 주소)
 * - 실제 단말기(Expo Go): localhost/10.0.2.2로 접속 불가 — 같은 와이파이의 PC LAN IP가 필요.
 *   frontend/.env.local 에 EXPO_PUBLIC_API_BASE_URL=http://<PC LAN IP>:5000 를 설정하면 우선 적용된다.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000');
