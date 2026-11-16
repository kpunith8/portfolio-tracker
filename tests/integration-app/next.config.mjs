import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));

const config = {
  agentRules: false,
  serverExternalPackages: ["fyers-api-v3", "pdfjs-dist"],
  webpack(config) {
    config.resolve.alias["../../app/dashboard/dividend-actions$"] = path.join(
      directory,
      "dividend-actions.js",
    );
    config.resolve.alias["../../app/dashboard/market-actions$"] = path.join(
      directory,
      "market-actions.js",
    );
    config.resolve.alias["../../app/dashboard/purchase-actions$"] = path.join(
      directory,
      "purchase-actions.js",
    );
    config.resolve.alias["../../app/dashboard/trade-actions$"] = path.join(
      directory,
      "trade-actions.js",
    );

    for (const [source, target] of Object.entries({
      "@kinde-oss/kinde-auth-nextjs/server$": "auth.js",
      "@kinde-oss/kinde-auth-nextjs/components$": "auth-components.js",
      "../../server/portfolio/ledger$": "ledger.js",
      "../../server/portfolio/tax-report$": "tax-report.js",
      "../../server/portfolio/dividends$": "dividends.js",
      "../../server/db/portfolio$": "portfolio.js",
      "../../server/fyers/session$": "fyers-session.js",
      "../../../../server/fyers/session$": "fyers-session.js",
    }))
      config.resolve.alias[source] = path.join(directory, target);

    return config;
  },
};

export default config;
