import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  owner,
  seal,
  setCookie,
  unseal,
} from "../../../../server/fyers/session";

export async function GET(request: Request) {
  const userId = await owner();
  const jar = await cookies();
  const raw = jar.get("fyers_state")?.value;

  jar.delete("fyers_state");

  const saved = raw ? unseal(raw) : null;
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("auth_code");
  const expected = saved?.state || "";

  if (
    !userId ||
    saved?.userId !== userId ||
    !code ||
    !expected ||
    Buffer.byteLength(state) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(expected))
  )
    return new NextResponse(
      "FYERS login could not be verified. Please reconnect.",
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );

  const appId = process.env.FYERS_APP_ID;
  const secret = process.env.FYERS_SECRET_ID;

  if (!appId || !secret)
    return new NextResponse("FYERS configuration is incomplete", {
      status: 503,
    });
  try {
    const response = await fetch(
      "https://api-t1.fyers.in/api/v3/validate-authcode",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          appIdHash: createHash("sha256")
            .update(`${appId}:${secret}`)
            .digest("hex"),
          code,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    const result = await response.json();

    if (
      !response.ok ||
      result.s !== "ok" ||
      typeof result.access_token !== "string"
    )
      throw new Error("Token exchange failed");
    await setCookie(
      "fyers_session",
      seal({ token: result.access_token, userId }),
      86400,
    );

    return NextResponse.redirect(new URL("/dashboard", request.url), {
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new NextResponse("FYERS login failed. Please reconnect.", {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
}
