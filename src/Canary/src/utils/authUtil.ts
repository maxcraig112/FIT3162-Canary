import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthTokenFromCookie, getUserIDFromCookie } from "./cookieUtils";

export function useAuthGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    async function checkAuth() {
      const userID = getUserIDFromCookie();
      const token = getAuthTokenFromCookie();
      const valid = await verifyJWT(token, userID);
      if (!valid) {
        navigate("/login", { replace: true });
      }
    }
    checkAuth();
  }, [navigate]);
}

async function verifyJWT(token: string, userID: string): Promise<boolean> {
  const baseUrl = import.meta.env.VITE_AUTH_SERVICE_URL;
  const url = `${baseUrl}/auth/${userID}`;
  const requestBody = {
    userID: userID,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });
  if (!res.ok) {
    console.error(`Failed to verify JWT: ${res.status} ${res.statusText}`);
    return false;
  }
  return true;
}

export function useSkipLogin() {
    const navigate = useNavigate();
        useEffect(() => {
    async function skip() {
        const userID = getUserIDFromCookie();
        const token = getAuthTokenFromCookie();
        let result = false;
        if (userID && token) {
            result = await verifyJWT(token, userID);
        }
        if (result) {
            navigate("/home", { replace: true });
        }
    }
    skip();
  }, [navigate]);
}
    