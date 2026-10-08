// STUB: replaced by the full implementation.
export function VisibilityReport({ result }: { result: Record<string, unknown> }) {
  return <pre className="overflow-x-auto rounded bg-card p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>;
}
