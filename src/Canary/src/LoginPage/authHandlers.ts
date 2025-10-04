import { setCookie } from '../utils/cookieUtils';
import { authServiceUrl, CallAPI } from '../utils/apis';

type AuthResponse = { token?: string; userID?: string; message?: string };

async function postToAuthService(endpoint: string, payload: object) {
  return CallAPI<AuthResponse>(`${authServiceUrl()}${endpoint}`, {
    method: 'POST',
    json: payload,
  });
}

export async function handleLogin(email: string, password: string, setResult?: (msg: string) => void) {
  try {
    const data = await postToAuthService('/login', { email, password });
    if (data && data.token) {
      setCookie('auth_token', data.token);
      if (data.userID) setCookie('user_id', data.userID);
      if (setResult) setResult('Login successful');
      // console.log('Login success, token set in cookie');
    } else {
      if (setResult) setResult('Login failed: No token received');
      throw new Error('No token received');
    }
  } catch (err) {
    if (setResult) setResult('Login failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    console.error('Login error:', err);
  }
}

export async function handleRegister(email: string, password: string, setResult?: (msg: string) => void) {
  try {
    const data = await postToAuthService('/register', { email, password });
    if (setResult) setResult(data?.message ? data.message : 'Register successful');
    // console.log('Register success:', data);
  } catch (err) {
    if (setResult) setResult('Register failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    console.error('Register error:', err);
  }
}
