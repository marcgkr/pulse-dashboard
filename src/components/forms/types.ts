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
  };
  windsorConnected: boolean;
  /** Last input used for this agent, to prefill the form. */
  lastInput: Record<string, unknown> | null;
};
