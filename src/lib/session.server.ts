import { SignJWT, jwtVerify } from "jose";
import { getCookie, setCookie, deleteCookie } from "@tanstack/start-server-core";

const COOKIE_NAME = "primus_session";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está configurado en .env");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: number;
  email: string;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { userId: payload.userId as number, email: payload.email as string };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = getCookie(COOKIE_NAME);
  if (!token) return null;
  return verifySessionToken(token);
}

export function setSessionCookie(token: string): void {
  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function clearSessionCookie(): void {
  deleteCookie(COOKIE_NAME, { path: "/" });
}
