import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ANALYTICS_COOKIE_NAME = "__Host-viviane_analytics";
export const ANALYTICS_SESSION_SECONDS = 8 * 60 * 60;

function getRequiredEnvironmentValue(name: string, minimumLength: number): string {
  const value = Netlify.env.get(name);
  if (!value || value.length < minimumLength) {
    throw new Error(`Missing or invalid ${name}`);
  }
  return value;
}

export function getAnalyticsPassword(): string {
  return getRequiredEnvironmentValue("ANALYTICS_PASSWORD", 8);
}

function getSessionSecret(): string {
  return getRequiredEnvironmentValue("ANALYTICS_SESSION_SECRET", 32);
}

export function safeSecretEqual(candidate: string, expected: string): boolean {
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createAnalyticsSession(now = new Date()): string {
  const expiresAt = Math.floor(now.getTime() / 1000) + ANALYTICS_SESSION_SECONDS;
  const nonce = randomBytes(18).toString("base64url");
  const payload = `v1.${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    cookies.set(name, value);
  }
  return cookies;
}

export function isAnalyticsSessionValid(request: Request, now = new Date()): boolean {
  const token = parseCookies(request.headers.get("cookie")).get(ANALYTICS_COOKIE_NAME);
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;

  const expiresAt = Number(parts[1]);
  const currentTime = Math.floor(now.getTime() / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= currentTime) return false;
  if (expiresAt > currentTime + ANALYTICS_SESSION_SECONDS + 60) return false;

  const payload = parts.slice(0, 3).join(".");
  const expectedSignature = sign(payload);
  const suppliedSignature = parts[3];
  const expectedBuffer = Buffer.from(expectedSignature);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  if (expectedBuffer.length !== suppliedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function sessionCookie(token: string): string {
  return `${ANALYTICS_COOKIE_NAME}=${token}; Path=/; Max-Age=${ANALYTICS_SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function expiredSessionCookie(): string {
  return `${ANALYTICS_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict`;
}
