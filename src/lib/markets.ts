// Countries MarketingRx sells in. Drives currency and prices on the website, and tells every
// specialist which market, search location, messaging habits and advertising rules apply.
//
// Singapore prices are set by hand. Every other market's prices are the Singapore price converted at
// the rate below, rounded up to the next whole amount ending in 9 (US$76.20 becomes US$79). To follow
// the exchange rate later, change SGD_RATES; existing subscribers keep the price they signed up at.
// Regulator lists name the main bodies only; agents are told to point owners to the official source
// rather than quote rules from memory.

export type MarketCode = "SG" | "MY" | "ID" | "PH" | "HK" | "AU" | "NZ" | "GB" | "US" | "AE" | "INTL";

export type Market = {
  code: MarketCode;
  name: string;
  /** "business owners in {inPhrase}" */
  inPhrase: string;
  currency: string;
  /** Prefix shown before prices, e.g. "S$" */
  symbol: string;
  locale: string;
  /** IANA time zone for showing dates and times (main business hub for multi-zone countries). */
  timeZone: string;
  /**
   * Monthly list prices for starter / growth / pro in this currency, each extra outlet on Pro, and the
   * "Website changes by PULSE" add-on on Growth and Pro (webcare).
   */
  prices: { starter: number; growth: number; pro: number; outlet: number; webcare: number };
  /** ISO country used to localise web searches. Null = no location. */
  searchCountry: string | null;
  /** The app most customers use to message a local business. */
  messaging: "WhatsApp" | "Messenger" | "SMS" | "LINE";
  /** Main bodies and rules for healthcare / regulated advertising. */
  healthAdRules: string;
  /** General advertising standards body. */
  adStandards: string;
  /** Example local places used in sample copy and placeholders. */
  exampleArea: string;
};

type Prices = Market["prices"];

/** Singapore list prices, in SGD. */
export const SGD_PRICES: Prices = { starter: 99, growth: 249, pro: 499, outlet: 10, webcare: 299 };

/**
 * Units of each currency per S$1, mid-market around 9 October 2026 (Bloomberg, Yahoo Finance, OFX).
 * HKD and AED follow the USD rate through their pegs (7.78 and 3.6725).
 */
export const SGD_RATES: Record<string, number> = {
  USD: 0.7811,
  MYR: 3.1916,
  HKD: 6.077,
  AUD: 1.1197,
  NZD: 1.3955,
  GBP: 0.5909,
  AED: 2.8686,
};

/** The smallest whole amount ending in 9 that is at least `x`. */
export function upToNine(x: number): number {
  let n = Math.ceil(x - 1e-9);
  while (n % 10 !== 9) n++;
  return n;
}

/** A market's prices from the Singapore ones. */
export function convertedPrices(currency: string): Prices {
  const rate = SGD_RATES[currency];
  if (!rate) throw new Error(`No SGD rate for ${currency}`);
  const out = {} as Prices;
  for (const k of Object.keys(SGD_PRICES) as (keyof Prices)[]) out[k] = upToNine(SGD_PRICES[k] * rate);
  return out;
}

export const MARKETS: Market[] = [
  {
    code: "SG",
    name: "Singapore",
    inPhrase: "Singapore",
    currency: "SGD",
    symbol: "S$",
    locale: "en-SG",
    timeZone: "Asia/Singapore",
    prices: SGD_PRICES,
    searchCountry: "SG",
    messaging: "WhatsApp",
    healthAdRules: "MOH advertising rules under the Healthcare Services Act, the SMC Ethical Code and Ethical Guidelines",
    adStandards: "Singapore Code of Advertising Practice (ASAS)",
    exampleArea: "Tampines",
  },
  {
    code: "MY",
    name: "Malaysia",
    inPhrase: "Malaysia",
    currency: "MYR",
    symbol: "RM",
    locale: "en-MY",
    timeZone: "Asia/Kuala_Lumpur",
    prices: convertedPrices("MYR"),
    searchCountry: "MY",
    messaging: "WhatsApp",
    healthAdRules: "the Medicines (Advertisement and Sale) Act and Medicine Advertisements Board approval, Malaysian Medical Council guidelines",
    adStandards: "Malaysian Code of Advertising Practice (ASA Malaysia)",
    exampleArea: "Petaling Jaya",
  },
  {
    code: "ID",
    name: "Indonesia",
    inPhrase: "Indonesia",
    currency: "USD",
    symbol: "US$",
    locale: "en-ID",
    timeZone: "Asia/Jakarta",
    prices: convertedPrices("USD"),
    searchCountry: "ID",
    messaging: "WhatsApp",
    healthAdRules: "Ministry of Health rules on advertising health services, the Indonesian medical code of ethics",
    adStandards: "Indonesian advertising code of ethics (Etika Pariwara Indonesia)",
    exampleArea: "South Jakarta",
  },
  {
    code: "PH",
    name: "Philippines",
    inPhrase: "the Philippines",
    currency: "USD",
    symbol: "US$",
    locale: "en-PH",
    timeZone: "Asia/Manila",
    prices: convertedPrices("USD"),
    searchCountry: "PH",
    messaging: "Messenger",
    healthAdRules: "Department of Health and FDA Philippines rules for health products and services",
    adStandards: "Ad Standards Council (ASC) code",
    exampleArea: "Makati",
  },
  {
    code: "HK",
    name: "Hong Kong",
    inPhrase: "Hong Kong",
    currency: "HKD",
    symbol: "HK$",
    locale: "en-HK",
    timeZone: "Asia/Hong_Kong",
    prices: convertedPrices("HKD"),
    searchCountry: "HK",
    messaging: "WhatsApp",
    healthAdRules: "the Undesirable Medical Advertisements Ordinance (Cap. 231), the Medical Council of Hong Kong Code of Professional Conduct",
    adStandards: "Communications Authority and trade descriptions rules",
    exampleArea: "Causeway Bay",
  },
  {
    code: "AU",
    name: "Australia",
    inPhrase: "Australia",
    currency: "AUD",
    symbol: "A$",
    locale: "en-AU",
    timeZone: "Australia/Sydney",
    prices: convertedPrices("AUD"),
    searchCountry: "AU",
    messaging: "SMS",
    healthAdRules: "Ahpra advertising guidelines under the National Law (including the ban on testimonials), the TGA Therapeutic Goods Advertising Code",
    adStandards: "AANA Code of Ethics (Ad Standards)",
    exampleArea: "Surry Hills",
  },
  {
    code: "NZ",
    name: "New Zealand",
    inPhrase: "New Zealand",
    currency: "NZD",
    symbol: "NZ$",
    locale: "en-NZ",
    timeZone: "Pacific/Auckland",
    prices: convertedPrices("NZD"),
    searchCountry: "NZ",
    messaging: "SMS",
    healthAdRules: "Medicines Act advertising rules, Medical Council of New Zealand statements",
    adStandards: "ASA Therapeutic and Health Advertising Code",
    exampleArea: "Ponsonby",
  },
  {
    code: "GB",
    name: "United Kingdom",
    inPhrase: "the UK",
    currency: "GBP",
    symbol: "£",
    locale: "en-GB",
    timeZone: "Europe/London",
    prices: convertedPrices("GBP"),
    searchCountry: "GB",
    messaging: "WhatsApp",
    healthAdRules: "MHRA rules (no advertising prescription-only medicines such as botulinum toxin to the public), GMC guidance",
    adStandards: "UK Code of Non-broadcast Advertising (CAP Code, enforced by the ASA)",
    exampleArea: "Shoreditch",
  },
  {
    code: "US",
    name: "United States",
    inPhrase: "the US",
    currency: "USD",
    symbol: "$",
    locale: "en-US",
    timeZone: "America/New_York",
    prices: convertedPrices("USD"),
    searchCountry: "US",
    messaging: "SMS",
    healthAdRules: "FTC truth-in-advertising rules and Endorsement Guides, FDA rules for drugs and devices, your state medical board's advertising rules",
    adStandards: "FTC Act and BBB National Programs",
    exampleArea: "Austin",
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    inPhrase: "the UAE",
    currency: "AED",
    symbol: "AED ",
    locale: "en-AE",
    timeZone: "Asia/Dubai",
    prices: convertedPrices("AED"),
    searchCountry: "AE",
    messaging: "WhatsApp",
    healthAdRules: "medical advertising permits from DHA, DoH Abu Dhabi or MOHAP depending on the emirate",
    adStandards: "UAE Media Council advertising standards",
    exampleArea: "Jumeirah",
  },
  {
    code: "INTL",
    name: "Anywhere else",
    inPhrase: "your market",
    currency: "USD",
    symbol: "US$",
    locale: "en-US",
    timeZone: "UTC",
    prices: convertedPrices("USD"),
    searchCountry: null,
    messaging: "WhatsApp",
    healthAdRules: "your local health regulator's advertising rules",
    adStandards: "your local advertising standards body",
    exampleArea: "your area",
  },
];

export const DEFAULT_MARKET: MarketCode = "SG";

export function marketFor(code: string | null | undefined): Market {
  const c = String(code ?? "").toUpperCase();
  return MARKETS.find((m) => m.code === c) ?? MARKETS.find((m) => m.code === DEFAULT_MARKET)!;
}

/** Best guess from an Accept-Language header like "en-AU,en;q=0.9". */
export function marketFromAcceptLanguage(header: string | null | undefined): MarketCode | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const region = part.split(";")[0].trim().split("-")[1]?.toUpperCase();
    if (!region) continue;
    const alias: Record<string, MarketCode> = { UK: "GB" };
    const code = (alias[region] ?? region) as MarketCode;
    if (MARKETS.some((m) => m.code === code && m.code !== "INTL")) return code;
  }
  return null;
}

/** "S$249" / "£149" / "AED 729" */
export function formatPrice(m: Market, amount: number): string {
  return `${m.symbol}${amount.toLocaleString(m.locale)}`;
}

export const MARKET_COOKIE = "mrx_market";
