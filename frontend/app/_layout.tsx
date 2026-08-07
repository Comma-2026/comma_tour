import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* 스플래시(로딩) */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/* 로그인 */}
        <Stack.Screen name="login" options={{ headerShown: false }} />
        {/* 회원가입 */}
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        {/* 로그인 이후 메인 탭 */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* 홈 "최근 핀 기록 · 전체 보기" */}
        <Stack.Screen name="pin-records" options={{ headerShown: false }} />
        {/* 다이어리 일기 상세(읽기) */}
        <Stack.Screen name="diary-detail" options={{ headerShown: false }} />
        {/* 다이어리 일기 작성/수정 */}
        <Stack.Screen name="diary-write" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
