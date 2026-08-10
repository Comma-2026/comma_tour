import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { login } from '@/api/auth';
import { Brand } from '@/constants/theme';
import { setToken } from '@/utils/authStorage';

/**
 * 로그인 화면. 스플래시 이후 진입한다.
 * 이메일 / 비밀번호를 입력받아 제출한다.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res.success) {
        // 로그인 성공 → 토큰 저장(이후 일기 요청의 소유자 식별용) 후 메인 탭으로 이동
        if (res.token) await setToken(res.token);
        router.replace('/(tabs)/home');
      } else {
        Alert.alert('로그인 실패', res.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>로그인</Text>
        {/* 타이틀을 가운데 정렬하기 위한 빈 공간 */}
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Login</Text>

          {/* 이메일 */}
          <View style={styles.field}>
            <Text style={styles.label}>Email*</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={Brand.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          </View>

          {/* 비밀번호 */}
          <View style={styles.field}>
            <Text style={styles.label}>Password*</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={Brand.placeholder}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />
          </View>

          {/* 제출 */}
          <Pressable
            style={({ pressed }) => [
              styles.submit,
              pressed && styles.submitPressed,
              loading && styles.submitPressed,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitText}>{loading ? '로그인 중...' : 'Submit'}</Text>
          </Pressable>

          {/* 회원가입 */}
          <Pressable
            style={({ pressed }) => [
              styles.signup,
              pressed && styles.submitPressed,
            ]}
            onPress={() => router.push('/signup')}
            disabled={loading}
          >
            <Text style={styles.signupText}>회원가입</Text>
          </Pressable>

          {/* 안내문 */}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9f8f2',
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: Brand.green,
    marginBottom: 28,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  submit: {
    height: 46,
    borderRadius: 30,
    backgroundColor: Brand.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitPressed: {
    backgroundColor: Brand.greenMuted,
    opacity: 0.8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  signup: {
    height: 46,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Brand.green,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  signupText: {
    color: Brand.green,
    fontSize: 15,
    fontWeight: '600',
  },
  notice: {
    fontSize: 11,
    color: Brand.muted,
    textAlign: 'center',
    marginTop: 14,
  },
  link: {
    fontSize: 11,
    color: Brand.muted,
    textAlign: 'center',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
});
