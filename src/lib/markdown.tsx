// Renderizado seguro de un subconjunto de Markdown a elementos React.
// No se usa innerHTML: el texto nunca se interpreta como HTML.
import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";
import { safeHref } from "./utils";

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2]) out.push(<strong key={key}>{m[2]}</strong>);
    else if (m[3] && m[4]) {
      const href = safeHref(m[4]);
      out.push(
        href.startsWith("/") ? (
          <Link key={key} to={href}>
            {m[3]}
          </Link>
        ) : (
          <a key={key} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
            {m[3]}
          </a>
        ),
      );
    } else if (m[5]) out.push(<code key={key} className="rounded bg-white/10 px-1 font-mono text-[0.9em]">{m[5]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (/^#{2,3}\s/.test(lines[0] ?? "")) {
          const level = lines[0]!.startsWith("###") ? 3 : 2;
          const title = lines[0]!.replace(/^#{2,3}\s+/, "");
          const rest = lines.slice(1).join("\n");
          const H = level === 2 ? "h2" : "h3";
          return (
            <Fragment key={bi}>
              <H>{inline(title, `h${bi}`)}</H>
              {rest && <Markdown text={rest} />}
            </Fragment>
          );
        }
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l) || !l.trim())) {
          return (
            <ul key={bi}>
              {lines.filter((l) => l.trim()).map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `l${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l) || !l.trim())) {
          return (
            <ol key={bi} className="list-decimal pl-5">
              {lines.filter((l) => l.trim()).map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), `o${bi}-${li}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {inline(l, `p${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
