import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { unreadForOwner } from "@/lib/support";

/** Team replies the owner hasn't read, for the badge on Help in the sidebar. Doesn't mark anything read. */
export async function GET() {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  return NextResponse.json({ unread: unreadForOwner(auth.ws.id) }, { headers: { "cache-control": "no-store" } });
}
