import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { getToken } from '@/utils/authStorage';

/** 스플래시가 떠 있는 시간(ms) */
const SPLASH_DURATION = 1800;

/**
 * 앱 진입 화면. 잠깐 스플래시(쉼표 카드)를 보여준 뒤,
 * 저장된 로그인 토큰이 있으면 홈으로(자동 로그인), 없으면 로그인 화면으로 전환한다.
 * 토큰은 로그아웃(마이페이지) 때만 삭제되므로, 로그아웃 전까지는 재로그인이 필요 없다.
 */
export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(async () => {
      const token = await getToken();
      router.replace(token ? '/(tabs)/home' : '/login');
    }, SPLASH_DURATION);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>쉼표’</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f8f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 150,
    height: 150,
    borderRadius: 16,
    backgroundColor: Brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontFamily: 'NotoSerifKR_500Medium',
    color: '#FFFFFF',
    fontSize: 40,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
