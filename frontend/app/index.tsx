import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';

/** 스플래시가 떠 있는 시간(ms) */
const SPLASH_DURATION = 1800;

/**
 * 앱 진입 화면. 잠깐 스플래시(쉼표 카드)를 보여준 뒤
 * 로그인 화면으로 자동 전환한다.
 */
export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/login');
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
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
