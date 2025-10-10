import Cookies from 'js-cookie';

export function setCookie(name: string, value: string, options: Cookies.CookieAttributes = { path: '/' }) {
  Cookies.set(name, value, { path: '/', ...options });
}

export function getCookie(name: string): string | null {
  return Cookies.get(name) || null;
}

export function clearCookie(name: string, options: Cookies.CookieAttributes = { path: '/' }) {
  Cookies.remove(name, { path: '/', ...options });
}

export function getUserIDFromCookie(): string {
  return getCookie('user_id') || '';
}

export function getAuthTokenFromCookie(): string {
  return getCookie('auth_token') || '';
}
