import type { Market } from "@/lib/markets";

// Small helpers that turn a Market into the words and links the public site needs.
// Client-safe: no server imports.

/** Short picker label: "SG · S$", "AE · AED". */
export function marketChip(m: Market): string {
  return `${m.code} · ${m.symbol.trim()}`;
}

const TLD: Partial<Record<Market["code"], string>> = {
  SG: ".sg",
  MY: ".com.my",
  ID: ".co.id",
  PH: ".ph",
  HK: ".com.hk",
  AU: ".com.au",
  NZ: ".co.nz",
  GB: ".co.uk",
  AE: ".ae",
};

/** Example website address for placeholders, e.g. "yourbusiness.com.au". */
export function exampleSite(m: Market): string {
  return `yourbusiness${TLD[m.code] ?? ".com"}`;
}

/** "/signup?country=AU&plan=growth" */
export function signupHref(m: Market, extra: Record<string, string | undefined> = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(extra)) if (v) qs.set(k, v);
  qs.set("country", m.code);
  return `/signup?${qs}`;
}
