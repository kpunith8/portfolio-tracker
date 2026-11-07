import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { cookies } from "next/headers";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function owner() {
  const { isAuthenticated, getUser } = getKindeServerSession();

  if (!(await isAuthenticated())) return null;

  const user = await getUser();

  return user?.id && user.id === process.env.FYERS_OWNER_KINDE_ID
    ? user.id
    : null;
}

function key() {
  const secret = process.env.FYERS_SESSION_SECRET;

  if (!secret || secret.length < 32)
    throw new Error("FYERS_SESSION_SECRET must be at least 32 characters");

  return createHash("sha256").update(secret).digest();
}

export function seal(value: object) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString(
    "base64url",
  );
}

export function unseal(value: string): Record<string, string> | null {
  try {
    const data = Buffer.from(value, "base64url");
    const cipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));

    cipher.setAuthTag(data.subarray(12, 28));

    return JSON.parse(
      Buffer.concat([
        cipher.update(data.subarray(28)),
        cipher.final(),
      ]).toString(),
    );
  } catch {
    return null;
  }
}

export async function setCookie(name: string, value: string, maxAge: number) {
  (await cookies()).set(name, value, { ...cookieOptions, maxAge });
}

export async function getToken(userId: string) {
  const raw = (await cookies()).get("fyers_session")?.value;
  const session = raw && unseal(raw);

  return session && session.userId === userId ? session.token : null;
}
