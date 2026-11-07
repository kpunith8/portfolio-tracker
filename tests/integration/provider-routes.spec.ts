import { expect, test } from "@playwright/test";

test("FYERS routes reject missing configuration and invalid callback state", async ({
  request,
}) => {
  const stream = await request.get("/api/fyers/stream");

  expect(stream.status()).toBe(401);

  const connect = await request.get("/api/fyers/connect");

  expect(connect.status()).toBe(503);

  const callback = await request.get(
    "/api/fyers/callback?state=invalid&auth_code=test",
  );

  expect(callback.status()).toBe(400);
  expect(callback.headers()["cache-control"]).toBe("no-store");
});
