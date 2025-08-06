import Cookies from "js-cookie";

export function setCookie(name: string, value: string) {
  Cookies.set(name, value, { path: "/" });
}

export function getCookie(name: string): string | null {
  return Cookies.get(name) || null;
}

export function clearCookie(name: string) {
  Cookies.remove(name, { path: "/" });
}

export function getUserIDFromCookie(): string {
  return getCookie("user_id") || "";
}

export function getAuthTokenFromCookie(): string {
  return getCookie("auth_token") || "";
}