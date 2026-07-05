// ──────────────────────────────────────────────
// DocsViewerModal: Browse the guides shipped in docs/
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, FileText } from "lucide-react";
import { Modal } from "../ui/Modal";
import { cn } from "../../lib/utils";
import { renderMarkdownBlocks, applyInlineMarkdown } from "../../lib/markdown";
import { useDocContent, useDocsIndex, type DocSummary } from "../../hooks/use-docs";

const DIR_LABELS: Record<string, string> = {
  "": "Guides",
  installation: "Installation",
  integrations: "Integrations",
};

function dirLabel(dir: string) {
  return DIR_LABELS[dir] ?? dir.charAt(0).toUpperCase() + dir.slice(1);
}

/** Resolve a link target relative to the doc it appears in (e.g. "../FAQ.md" from "installation/windows.md"). */
function resolveDocPath(currentPath: string, target: string): string {
  const clean = target.replace(/\\/g, "/").replace(/^\.\//, "");
  const segments = currentPath.split("/").slice(0, -1);
  for (const part of clean.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      segments.pop();
      continue;
    }
    segments.push(part);
  }
  return segments.join("/");
}

/**
 * The shipped docs use a little structural HTML (FAQ.md's <details> blocks,
 * anchor targets) and relative cross-doc links, neither of which the chat
 * markdown renderer understands. Rewrite both into forms it can render:
 * summaries become headings, structural tags are dropped, and relative .md
 * links point at the content endpoint so the click handler below can follow
 * them inside the modal.
 */
function prepareDocMarkdown(raw: string, docPath: string): string {
  const out: string[] = [];
  for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (/^<\/?details>$/i.test(trimmed) || /^<br\s*\/?>$/i.test(trimmed) || /^<\/?p(\s[^>]*)?>$/i.test(trimmed)) {
      continue;
    }
    if (/^(<a id="[^"]*"><\/a>\s*)+$/i.test(trimmed)) continue;
    const summary = trimmed.match(/^<summary>(?:<strong>)?(.+?)(?:<\/strong>)?<\/summary>$/i);
    if (summary) {
      out.push(`## ${summary[1]}`);
      continue;
    }
    const img = trimmed.match(/^<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"[^>]*>$/i);
    if (img) {
      out.push(`![](${img[1]})`);
      continue;
    }
    if (/^<img\b[^>]*>$/i.test(trimmed)) continue;
    out.push(line);
  }
  return out
    .join("\n")
    .replace(/\[([^\]]+)\]\(#[^)]*\)/g, "$1")
    .replace(
      /\[([^\]]+)\]\((?!(?:https?|card):\/\/|\/api\/|#|mailto:)([^()\s#]+\.md)(?:#[^)]*)?\)/gi,
      (_match, text: string, target: string) =>
        `[${text}](/api/docs/content?path=${encodeURIComponent(resolveDocPath(docPath, target))})`,
    );
}

export function DocsViewerModal({
  open,
  onClose,
  initialDoc = null,
}: {
  open: boolean;
  onClose: () => void;
  initialDoc?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(initialDoc);
  const { data: index, isLoading: indexLoading, isError: indexError } = useDocsIndex(open);
  const { data: doc, isLoading: docLoading, isError: docError } = useDocContent(selected);

  const groups: { dir: string; docs: DocSummary[] }[] = [];
  for (const entry of index?.docs ?? []) {
    const group = groups.find((g) => g.dir === entry.dir);
    if (group) group.docs.push(entry);
    else groups.push({ dir: entry.dir, docs: [entry] });
  }

  const rendered = useMemo(
    () =>
      doc ? renderMarkdownBlocks(prepareDocMarkdown(doc.content, doc.path), applyInlineMarkdown, "docs-viewer") : null,
    [doc],
  );

  /** Follow rewritten cross-doc links inside the modal instead of opening a new tab. */
  const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest?.("a");
    if (!anchor) return;
    let url: URL;
    try {
      url = new URL(anchor.href, window.location.origin);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin || !url.pathname.endsWith("/api/docs/content")) return;
    const target = url.searchParams.get("path");
    if (!target) return;
    event.preventDefault();
    setSelected(target);
  };

  return (
    <Modal open={open} onClose={onClose} title="Documentation" width="max-w-4xl">
      <div className="flex h-[min(65dvh,42rem)] min-h-0 gap-3">
        {/* Guide list */}
        <aside
          className={cn(
            "flex w-full min-w-0 flex-col sm:w-60 sm:shrink-0",
            selected !== null && "hidden sm:flex",
          )}
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {indexLoading ? (
              <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">Loading guides…</p>
            ) : indexError || !index ? (
              <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">
                Could not load the documentation list. The docs folder may be missing from this install.
              </p>
            ) : groups.length === 0 ? (
              <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">No guides found in the docs folder.</p>
            ) : (
              groups.map((group) => (
                <div key={group.dir || "root"}>
                  <p className="px-1 pb-1 text-[0.625rem] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]/70">
                    {dirLabel(group.dir)}
                  </p>
                  <div className="space-y-1">
                    {group.docs.map((entry) => (
                      <button
                        key={entry.path}
                        type="button"
                        onClick={() => setSelected(entry.path)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                          selected === entry.path
                            ? "border-[var(--primary)]/40 bg-[var(--accent)] text-[var(--foreground)]"
                            : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--accent)]/60 hover:text-[var(--foreground)]",
                        )}
                      >
                        <FileText size="0.875rem" className="mt-0.5 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-xs font-medium leading-snug">{entry.title}</span>
                          <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]/70">
                            {entry.path}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          {index ? (
            <div className="mt-2 shrink-0 border-t border-[var(--border)]/60 pt-2">
              <p className="text-[0.625rem] text-[var(--muted-foreground)]/70">Also on disk at:</p>
              <code className="block break-all text-[0.625rem] text-[var(--muted-foreground)]" title={index.root}>
                {index.root}
              </code>
            </div>
          ) : null}
        </aside>

        {/* Reader */}
        <div
          className={cn(
            "min-w-0 flex-1 flex-col sm:flex sm:border-l sm:border-[var(--border)]/60 sm:pl-3",
            selected === null ? "hidden sm:flex" : "flex",
          )}
        >
          {selected === null ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
              <BookOpen size="1.5rem" className="opacity-60" />
              <p className="text-xs">Pick a guide from the list to start reading.</p>
            </div>
          ) : (
            <>
              <div className="mb-2 flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] sm:hidden"
                  aria-label="Back to guide list"
                >
                  <ArrowLeft size="0.875rem" />
                </button>
                <p className="min-w-0 truncate text-[0.625rem] text-[var(--muted-foreground)]/70">docs/{selected}</p>
              </div>
              <div key={selected} className="min-h-0 flex-1 overflow-y-auto pr-1">
                {docLoading ? (
                  <p className="py-2 text-xs text-[var(--muted-foreground)]">Loading…</p>
                ) : docError || !doc ? (
                  <p className="py-2 text-xs text-[var(--muted-foreground)]">Could not load this guide.</p>
                ) : (
                  <div
                    className="mari-message-content whitespace-pre-wrap break-words text-sm text-[var(--foreground)]"
                    onClick={handleContentClick}
                  >
                    {rendered}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
