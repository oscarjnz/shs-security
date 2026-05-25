/*
 * Tiny zero-dependency renderer for the subset of markdown we actually use:
 *   - **bold** inline
 *   - Paragraphs separated by blank lines
 *   - Bulleted lists where each line starts with "- " or "* "
 *
 * NOT a full markdown parser. NOT safe for arbitrary HTML (only emits text
 * + a few specific tags). Designed for Groq-generated content that follows
 * our prompts.
 */

import { Fragment, type ReactNode } from "react";

/** Render inline **bold** runs. */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

interface Block {
  kind: "paragraph" | "list";
  lines: string[];
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (current && current.lines.length > 0) blocks.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === "") {
      flush();
      continue;
    }
    const isList = /^\s*[-*]\s+/.test(line);
    if (isList) {
      if (!current || current.kind !== "list") {
        flush();
        current = { kind: "list", lines: [] };
      }
      current.lines.push(line.replace(/^\s*[-*]\s+/, ""));
    } else {
      if (!current || current.kind !== "paragraph") {
        flush();
        current = { kind: "paragraph", lines: [] };
      }
      current.lines.push(line);
    }
  }
  flush();
  return blocks;
}

export function SimpleMarkdown({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) return null;
  const blocks = parseBlocks(text);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.kind === "list") {
          return (
            <ul key={i} className="my-2 list-disc space-y-1 pl-5">
              {block.lines.map((line, j) => (
                <li key={j}>{renderInline(line)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="my-2 leading-relaxed first:mt-0 last:mb-0">
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
