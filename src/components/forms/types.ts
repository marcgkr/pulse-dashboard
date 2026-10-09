/** Plain data every agent form receives from the server. */
export type FormProps = {
  profile: {
    name: string;
    website: string;
    industry: string;
    location: string;
    audience: string;
    offers: string;
    competitors: string;
    goals: string;
    regulated: boolean;
    /** Market code from the workspace (e.g. "SG", "GB"). Sets placeholders and examples. */
    country: string;
  };
  /** Connected Google / Meta accounts the specialists can read (Settings > Connected accounts). */
  connected: ConnectedSources;
  /** Last input used for this agent, to prefill the form. */
  lastInput: Record<string, unknown> | null;
};

/** Which connected accounts a form can use. Plain data, never tokens. */
export type ConnectedSources = {
  /** At least one Google Ads or Meta ad account is selected for live sync. */
  ads: boolean;
  /** Names of the selected ad accounts, e.g. "Meta: Glow Clinic". */
  adsAccounts: string[];
  /** The selected Search Console property, if any. */
  searchConsole: string | null;
  /** The plan includes live ad sync. */
  livePlan: boolean;
};
