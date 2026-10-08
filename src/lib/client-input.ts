/**
 * Strips bulky fields from a run's stored input before it is sent to the browser
 * (form prefill, report follow-up buttons). The server fills them back in from the
 * parent run on follow-ups, and re-runs use the stored input directly.
 */
export function clientInput(agent: string, input: Record<string, unknown>): Record<string, unknown> {
  const out = { ...input };
  if (agent === "keywords") delete out.data;
  // The ads form never prefills old CSVs, and re-runs use the stored input.
  if (agent === "ads") delete out.reports;
  return out;
}
