// Legacy ad sync (internal fallback only). Server only: never imported by client code.
// Workspaces connected before native Google/Meta connections stored a Windsor.ai key. It is only used
// when the platform still sets WINDSOR_API_KEY and the workspace has no native ad connection
// (see legacyAdsSyncKey in ./index.ts). The supplier is never named in labels or errors: customers see
// "live sync". Field names follow Windsor's documented connector fields. Never log or echo the API key.

import { parseNum, type AdRow, type Platform, type SourceInfo } from "../agents/ads-data";

const label = (p: Platform) => (p === "google" ? "Google Ads" : "Meta Ads");

const WINDSOR_FIELDS: Record<"google_ads" | "facebook", string> = {
  google_ads: "account_name,campaign,clicks,impressions,spend,conversions",
  facebook: "account_name,campaign,adset_name,ad_name,clicks,impressions,spend,reach,frequency,actions_lead,actions_purchase",
};

export async function fetchWindsor(apiKey: string, days: number): Promise<{ rows: AdRow[]; sources: SourceInfo[] }> {
  const rows: AdRow[] = [];
  const sources: SourceInfo[] = [];

  for (const connector of ["google_ads", "facebook"] as const) {
    const platform: Platform = connector === "google_ads" ? "google" : "meta";
    const info: SourceInfo = { source: "live", label: `${label(platform)} (live sync)`, platform, level: connector === "google_ads" ? "campaign" : "ad", rows: 0, ok: false };
    try {
      const url = new URL(`https://connectors.windsor.ai/${connector}`);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("date_preset", `last_${days}d`);
      url.searchParams.set("fields", WINDSOR_FIELDS[connector]);
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { accept: "application/json" } });
      // Supplier responses can name the supplier, so owners only ever see a generic message.
      if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "This live sync connection was refused. Connect the account again in Settings > Connected accounts." : "Live sync couldn't read this account right now.");
      const json = (await res.json()) as { data?: Record<string, unknown>[]; error?: unknown };
      if (!Array.isArray(json.data)) throw new Error("Live sync couldn't read this account right now.");
      for (const d of json.data) {
        const s = (k: string) => (d[k] == null ? "" : String(d[k]).trim());
        const n = (k: string) => parseNum(d[k] as string | number | null) ?? 0;
        if (connector === "google_ads") {
          const name = s("campaign");
          if (!name) continue;
          rows.push({ platform, level: "campaign", name, parent: "", campaign: name, spend: n("spend"), impressions: n("impressions"), clicks: n("clicks"), conversions: n("conversions"), conv_value: 0, reach: null, frequency: null, conv_known: true });
        } else {
          const name = s("ad_name") || s("adset_name") || s("campaign");
          if (!name) continue;
          rows.push({
            platform,
            level: s("ad_name") ? "ad" : s("adset_name") ? "adset" : "campaign",
            name,
            parent: s("ad_name") ? s("adset_name") : s("adset_name") ? s("campaign") : "",
            campaign: s("campaign"),
            spend: n("spend"),
            impressions: n("impressions"),
            clicks: n("clicks"),
            conversions: n("actions_lead") + n("actions_purchase"),
            conv_value: 0,
            reach: parseNum(d.reach as string | number | null),
            frequency: parseNum(d.frequency as string | number | null),
            conv_known: true,
          });
        }
        info.rows++;
      }
      info.ok = true;
      if (info.rows === 0) info.error = "Connected but returned no rows for this period.";
    } catch (e) {
      const err = e as Error;
      info.error = err.name === "TimeoutError" || err.name === "AbortError" ? "Timed out after 30 seconds." : /^(This live sync|Live sync)/.test(err.message) ? err.message : "Live sync couldn't read this account right now.";
    }
    sources.push(info);
  }
  return { rows, sources };
}
