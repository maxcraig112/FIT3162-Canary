import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthTokenFromCookie, getUserIDFromCookie } from "./cookieUtils";
import { CallAPI } from "./apis";

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

async function verifyJWT(_token: string, userID: string): Promise<boolean> {
  const baseUrl = import.meta.env.VITE_AUTH_SERVICE_URL;
  const url = `${baseUrl}/auth/${userID}`;
  const requestBody = {
    userID: userID,
  };
  try {
    await CallAPI(url, { method: "POST", json: requestBody });
    return true;
  } catch (e) {
    console.error(`Failed to verify JWT: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
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
