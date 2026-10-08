import { Fragment, type ReactNode } from "react";

// Small, safe markdown renderer for AI replies: paragraphs, headings, lists, bold, italics, inline code, links.
// No HTML is ever injected.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-mint px-1 font-mono text-[0.9em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const label = t.slice(1, t.indexOf("]"));
      out.push(
        <a key={k} href={m[2]} target="_blank" rel="noreferrer" className="text-scrub underline">
          {label}
        </a>,
      );
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(" "), `p${blocks.length}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    const k = `l${blocks.length}`;
    blocks.push(
      <Tag key={k}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, `${k}-${i}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const head = line.match(/^#{1,4}\s+(.*)$/);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (head) {
      flushPara();
      flushList();
      blocks.push(<h4 key={`h${blocks.length}`}>{inline(head[1], `h${blocks.length}`)}</h4>);
    } else if (bullet || num) {
      flushPara();
      const ordered = Boolean(num);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className="prose-rx">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
