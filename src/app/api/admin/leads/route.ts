import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

type Lead = { email: string; website: string; score: number | null; country: string; created_at: string; signed_up: number };

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  // Neutralise spreadsheet formulas and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV export of free-checkup leads, with whether each email went on to create an account. */
export async function GET() {
  const user = await currentUser();
  if (!user || !isAdmin(user)) return new Response("Not allowed.", { status: 403 });
  const rows = db()
    .prepare(
      `SELECT l.email, l.website, l.score, l.country, l.created_at,
              EXISTS(SELECT 1 FROM users u WHERE u.email = l.email) AS signed_up
       FROM leads l ORDER BY l.created_at DESC`,
    )
    .all() as Lead[];
  const lines = [
    ["email", "website", "checkup_score", "country", "captured_at", "signed_up"].join(","),
    ...rows.map((r) => [r.email, r.website, r.score ?? "", r.country, r.created_at, r.signed_up ? "yes" : "no"].map(csvCell).join(",")),
  ];
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="marketingrx-leads.csv"` },
  });
}
