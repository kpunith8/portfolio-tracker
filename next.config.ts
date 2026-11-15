import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  serverExternalPackages: ["fyers-api-v3", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/dashboard": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/fyers/stream": ["./node_modules/fyers-api-v3/**/*"],
  },
};

export default config;
