"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileUp, Plug, Stethoscope, Trash2 } from "lucide-react";
import { describeReport, type ReportInput } from "@/lib/agents/ads-data";
import { Badge, Button, Card, Field, Label, Select, Textarea, cx } from "../ui";
import { FormError, useRunAgent } from "../run-agent";
import type { FormProps } from "./types";
import { marketFor } from "@/lib/markets";

type Source = "upload" | "windsor";
type PlatformChoice = ReportInput["platform"];
type Report = ReportInput & { id: number };

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REPORTS = 6;

/** Reads a file as text. Google Ads sometimes exports UTF-16 tab-separated files, so check the byte order mark. */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Couldn't read ${file.name}.`));
    reader.onload = () => {
      const buf = reader.result as ArrayBuffer;
      const b = new Uint8Array(buf.slice(0, 2));
      const enc = b[0] === 0xff && b[1] === 0xfe ? "utf-16le" : b[0] === 0xfe && b[1] === 0xff ? "utf-16be" : "utf-8";
      resolve(new TextDecoder(enc).decode(buf));
    };
    reader.readAsArrayBuffer(file);
  });
}

export function AdsForm({ profile, windsorConnected, lastInput }: FormProps) {
  const messaging = marketFor(profile.country).messaging;
  const [source, setSource] = useState<Source>(lastInput?.source === "windsor" && windsorConnected ? "windsor" : "upload");
  const [days, setDays] = useState<number>(Number(lastInput?.days) || 30);
  const [notes, setNotes] = useState<string>((lastInput?.notes as string) || "");
  const [reports, setReports] = useState<Report[]>([]);
  const [platform, setPlatform] = useState<PlatformChoice>("auto");
  const [paste, setPaste] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const nextId = useRef(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const { start, pending, error } = useRunAgent("ads");

  const detected = useMemo(() => new Map(reports.map((r) => [r.id, describeReport(r)])), [reports]);

  function add(items: ReportInput[]) {
    const room = MAX_REPORTS - reports.length;
    if (items.length > room) setFileError(`You can add up to ${MAX_REPORTS} reports per checkup.`);
    const take = items.slice(0, Math.max(0, room)).map((r) => ({ ...r, id: nextId.current++ }));
    setReports((prev) => [...prev, ...take].slice(0, MAX_REPORTS));
  }

  async function onFiles(files: FileList | null) {
    setFileError(null);
    if (!files?.length) return;
    const out: ReportInput[] = [];
    for (const f of Array.from(files)) {
      if (/\.(xlsx?|xls)$/i.test(f.name)) {
        setFileError(`${f.name} is an Excel file. Download the report as .csv instead.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        setFileError(`${f.name} is over 2 MB. Export a shorter date range or fewer columns.`);
        continue;
      }
      try {
        out.push({ platform, filename: f.name, csv: await readFileText(f) });
      } catch (e) {
        setFileError((e as Error).message);
      }
    }
    if (out.length) add(out);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addPaste() {
    setFileError(null);
    if (!paste.trim()) return;
    if (paste.length > MAX_BYTES) {
      setFileError("That's over 2 MB of text. Export a shorter date range or fewer columns.");
      return;
    }
    add([{ platform, filename: `Pasted report ${reports.length + 1}`, csv: paste }]);
    setPaste("");
  }

  const readyReports = reports.filter((r) => detected.get(r.id)?.ok);
  const canRun = source === "windsor" ? windsorConnected : readyReports.length > 0;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (source === "windsor") void start({ source, days, notes });
        else void start({ source, notes, reports: readyReports.map(({ platform, filename, csv }) => ({ platform, filename, csv })) });
      }}
    >
      <div>
        <Label className="mb-2">Where your ad data comes from</Label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {(
            [
              ["upload", "Upload exports", FileUp],
              ["windsor", "Windsor.ai", Plug],
            ] as const
          ).map(([value, text, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={source === value}
              onClick={() => setSource(value)}
              className={cx(
                "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition",
                source === value ? "border-scrub bg-mint text-scrub-dark" : "border-line bg-card text-ink-2 hover:border-ink-3",
              )}
            >
              <Icon size={15} /> {text}
            </button>
          ))}
        </div>
      </div>

      {source === "upload" ? (
        <div className="space-y-4">
          {reports.length > 0 && (
            <Card className="divide-y divide-line">
              {reports.map((r) => {
                const d = detected.get(r.id);
                return (
                  <div key={r.id} className="flex items-start gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.filename}</p>
                      <p className={cx("break-words text-xs", d?.ok ? "text-ink-3" : "text-pulse")}>{d?.text}</p>
                    </div>
                    <Badge tone={d?.ok ? "green" : "red"}>{d?.ok ? "Ready" : "Check"}</Badge>
                    <button
                      type="button"
                      onClick={() => setReports((prev) => prev.filter((x) => x.id !== r.id))}
                      className="rounded p-1 text-ink-3 hover:bg-pulse/10 hover:text-pulse"
                      aria-label={`Remove ${r.filename}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <Field label="Platform">
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as PlatformChoice)}>
                <option value="auto">Auto-detect</option>
                <option value="google">Google Ads</option>
                <option value="meta">Meta Ads</option>
              </Select>
            </Field>
            <Field label="Upload CSV exports" hint="Up to 6 files, 2 MB each. A campaigns report plus a search terms report works best for Google.">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                multiple
                onChange={(e) => void onFiles(e.target.files)}
                className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border file:border-line file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink hover:file:border-ink-3"
              />
            </Field>
          </div>

          <Field label="Or paste a report" hint="Copy the table from the CSV, including the header row.">
            <Textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"Campaign,Impr.,Clicks,Cost,Conversions\nSearch - Brand,2140,498,189.24,41"}
              className="min-h-28 font-mono text-xs"
            />
          </Field>
          {paste.trim() && (
            <Button type="button" variant="secondary" onClick={addPaste}>
              Add pasted report
            </Button>
          )}

          <details className="rounded-md border border-line bg-card px-3 py-2 text-sm text-ink-2">
            <summary className="cursor-pointer font-semibold text-ink">How to export your reports</summary>
            <div className="mt-2 space-y-2">
              <p>
                <span className="font-semibold text-ink">Google Ads:</span> Campaigns, pick the date range, then the download icon above the table and choose .csv. For wasted spend, also download
                Campaigns &gt; Insights and reports &gt; Search terms. Add the Conversions column first if it isn&apos;t showing.
              </p>
              <p>
                <span className="font-semibold text-ink">Meta Ads Manager:</span> open the Ad sets tab, pick the date range, then Reports &gt; Export table data &gt; .csv. Keep the Results,
                Reach and Frequency columns.
              </p>
            </div>
          </details>
        </div>
      ) : windsorConnected ? (
        <Field label="Period" hint="We read Google Ads and Meta Ads through your Windsor.ai connection.">
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 14, 30, 90].map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Card className="p-4 text-sm text-ink-2">
          Windsor.ai isn&apos;t connected yet. Add your Windsor API key in{" "}
          <Link href="/app/settings" className="font-semibold text-scrub underline underline-offset-2">
            Settings
          </Link>{" "}
          to pull Google Ads and Meta Ads data automatically, or upload CSV exports instead.
        </Card>
      )}

      <Field label="Anything we should know? (optional)" hint="Goals, what counts as a lead, recent changes.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={`e.g. We only count ${messaging === "SMS" ? "phone and form" : messaging} enquiries. The laser campaign started mid-month.`} className="min-h-16" />
      </Field>

      <FormError error={fileError ?? error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !canRun}>
          <Stethoscope size={16} /> {pending ? "Starting..." : "Run ads checkup"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => void start({ source: "sample", notes })}>
          Try with sample data
        </Button>
      </div>
    </form>
  );
}
