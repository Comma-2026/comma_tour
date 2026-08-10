import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_STORAGE_KEY = 'comma_tour:token';

/** 로그인 토큰을 기기에 저장한다(로그인 성공 시). */
export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
}

/** 저장된 로그인 토큰을 읽는다. 없으면 null. */
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_STORAGE_KEY);
}

/** 로그인 토큰을 삭제한다(로그아웃). */
export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
}
