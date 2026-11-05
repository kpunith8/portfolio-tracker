import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["fyers-api-v3"],
  outputFileTracingIncludes: {
    "/api/fyers/stream": ["./node_modules/fyers-api-v3/**/*"],
  },
};
export default config;
