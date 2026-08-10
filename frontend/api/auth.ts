import { API_BASE_URL } from '@/constants/api';

export type AuthResponse = {
  success: boolean;
  message: string;
  user?: { email: string };
  token?: string; // 로그인 성공 시 발급되는 서명 토큰
};

/** 요청이 응답 없이 멈추는 것을 막기 위한 타임아웃(ms) */
const REQUEST_TIMEOUT = 10000;

async function postJson(path: string, body: object): Promise<AuthResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    // 타임아웃(abort) 또는 네트워크 오류(서버 미실행 등)
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      success: false,
      message: aborted
        ? '서버 응답이 없습니다. 백엔드/LDAP 서버가 실행 중인지 확인해주세요.'
        : '서버에 연결할 수 없습니다. 네트워크를 확인해주세요.',
    };
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json().catch(() => null)) as AuthResponse | null;
  if (!data) {
    return { success: false, message: '서버 응답을 처리할 수 없습니다.' };
  }
  return data;
}

/** 회원가입: 이메일/비밀번호로 LDAP 계정 생성 */
export function signup(email: string, password: string): Promise<AuthResponse> {
  return postJson('/api/signup', { email, password });
}

/** 로그인: LDAP bind 인증 */
export function login(email: string, password: string): Promise<AuthResponse> {
  return postJson('/api/login', { email, password });
}
