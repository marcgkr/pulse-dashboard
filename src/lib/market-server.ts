import { cookies, headers } from "next/headers";
import { DEFAULT_MARKET, MARKET_COOKIE, marketFor, marketFromAcceptLanguage, type Market } from "./markets";

/** Market for a visitor: their saved choice, else their browser language region, else Singapore. */
export async function visitorMarket(): Promise<Market> {
  const saved = (await cookies()).get(MARKET_COOKIE)?.value;
  if (saved) return marketFor(saved);
  const h = await headers();
  const geo = h.get("cf-ipcountry") || h.get("x-vercel-ip-country");
  return marketFor(geo || marketFromAcceptLanguage(h.get("accept-language")) || DEFAULT_MARKET);
}
