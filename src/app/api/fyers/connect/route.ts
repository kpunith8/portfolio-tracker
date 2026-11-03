import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { owner, seal, setCookie } from "../../../../server/fyers/session";

export async function GET() {
  const userId = await owner();
  if (!userId) return new NextResponse("Not authorized", { status: 403 });
  const { FYERS_APP_ID, FYERS_REDIRECT_URI, FYERS_SESSION_SECRET } =
    process.env;
  if (
    !FYERS_APP_ID ||
    !FYERS_REDIRECT_URI ||
    !FYERS_SESSION_SECRET ||
    FYERS_SESSION_SECRET.length < 32
  )
    return new NextResponse("FYERS configuration is incomplete", {
      status: 503,
    });
  const state = randomBytes(32).toString("base64url");
  await setCookie("fyers_state", seal({ state, userId }), 600);
  const url = new URL("https://api-t1.fyers.in/api/v3/generate-authcode");
  url.search = new URLSearchParams({
    client_id: FYERS_APP_ID,
    redirect_uri: FYERS_REDIRECT_URI,
    response_type: "code",
    state,
  }).toString();
  return NextResponse.redirect(url);
}
