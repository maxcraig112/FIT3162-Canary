const authServiceURL = import.meta.env.VITE_AUTH_SERVICE_URL;

async function postToAuthService(endpoint: string, payload: object) {
  const response = await fetch(`${authServiceURL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Request failed");
  }
  // Try to parse JSON, but fallback to text if not JSON
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function handleLogin(
  email: string,
  password: string,
  setResult?: (msg: string) => void,
) {
  try {
    const data = await postToAuthService("/login", { email, password });
    if (data && data.token) {
      document.cookie = `token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}`;
      if (setResult) setResult("Login successful");
      console.log("Login success, token set in cookie");
    } else {
      if (setResult) setResult("Login failed: No token received");
      throw new Error("No token received");
    }
  } catch (err) {
    if (setResult)
      setResult(
        "Login failed: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    console.error("Login error:", err);
  }
}

export async function handleRegister(
  email: string,
  password: string,
  setResult?: (msg: string) => void,
) {
  try {
    const data = await postToAuthService("/register", { email, password });
    if (setResult)
      setResult(data?.message ? data.message : "Register successful");
    console.log("Register success:", data);
  } catch (err) {
    if (setResult)
      setResult(
        "Register failed: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    console.error("Register error:", err);
  }
}
