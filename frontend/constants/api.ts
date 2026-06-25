import { Platform } from 'react-native';

/**
 * 백엔드(Flask) 기본 URL.
 *
 * - 웹 / iOS 시뮬레이터: localhost
 * - 안드로이드 에뮬레이터: 10.0.2.2 (호스트 PC를 가리키는 특수 주소)
 * - 실제 단말기: 같은 와이파이의 PC LAN IP로 바꿔야 함 (예: http://192.168.0.10:5000)
 */
export const API_BASE_URL =
  Platform.OS === 'android'
    ? 'http://192.168.219.100:5000'
    : 'http://localhost:5000';
