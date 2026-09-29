/**
 * AIFormattedText — single authoritative AI text renderer for LifeOS.
 *
 * Uses the mathPipeline.js normalizer then react-markdown + remark-math + rehype-katex.
 * One malformed equation never crashes the rest of the response.
 * Code blocks are never interpreted as math.
 */
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Video } from "lucide-react";
import { cn } from "@/libs/utils";
import { normalizeLatex } from "@/libs/mathPipeline";

function getYouTubeId(url) {
  if (!url) return null;
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = String(url).match(regExp);
  return match ? match[1] : null;
}

// Rehype-katex options: never throw, show subtle error color, increase
// minRuleThickness to avoid sub-pixel fraction-line disappearance in Electron/Chromium.
const KATEX_OPTIONS = {
  strict: false,
  throwOnError: false,
  errorColor: "hsl(var(--muted-foreground, 215 16% 47%))",
  trust: false,
  minRuleThickness: 0.06, // avoids invisible fraction lines at non-100% zoom
  output: "html",         // pure HTML output; avoids mathml size overhead
};

// Stable markdown component map — defined outside the component so React never
// recreates these on re-render (important for memoization performance).
const MD_COMPONENTS = {
  p: ({ children }) => <p className="mb-4 last:mb-0 leading-7">{children}</p>,
  h1: ({ children }) => <h1 className="mb-4 mt-6 text-2xl font-bold tracking-tight first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 mt-6 text-xl font-bold tracking-tight first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-5 text-lg font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-2 mt-4 text-base font-semibold">{children}</h4>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
  ul: ({ children }) => <ul className="mb-4 ml-5 list-disc space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 ml-5 list-decimal space-y-1.5">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-primary/40 pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => {
    const videoId = getYouTubeId(href);
    if (videoId) {
      return (
        <span className="my-3 block">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mb-2 inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-4 hover:opacity-80"
          >
            <Video className="h-4 w-4 text-rose-500 shrink-0" />
            {children}
          </a>
          <span className="relative block aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border border-primary/20 bg-black shadow-lg">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title="YouTube video player"
              className="absolute left-0 top-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </span>
        </span>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary underline underline-offset-4 hover:opacity-80"
      >
        {children}
      </a>
    );
  },
  code: ({ inline, children }) =>
    inline ? (
      <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-primary">
        {children}
      </code>
    ) : (
      <code className="block overflow-x-auto rounded-xl bg-muted p-4 font-mono text-[13px] leading-6">
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-xl border bg-muted/50">{children}</pre>
  ),
  hr: () => <hr className="my-6 border-border" />,
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-border bg-card/50">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border bg-muted/40">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border last:border-b-0">{children}</tr>,
  th: ({ children }) => (
    <th className="border-b border-border bg-muted/30 px-4 py-3 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-4 py-3 align-top">{children}</td>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt || ""} className="my-4 max-w-full rounded-xl border shadow-sm" />
  ),
};

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [[rehypeKatex, KATEX_OPTIONS]];

/**
 * Auto-converts standalone YouTube URLs into markdown link syntax [Watch Video](url)
 * so that remark / react-markdown passes them to the custom <a> component which embeds the iframe.
 */
function autoEmbedYouTubeLinks(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // Avoid replacing URLs that are already markdown links: [text](url)
  return raw.replace(/(?<!\]\()https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]{11}(?:[^\s<>"'\)]*)/gi, (match) => {
    return `[Watch Video](${match})`;
  });
}

/**
 * AIFormattedText
 *
 * Props:
 *   children  — raw AI text string (may be streaming / incomplete)
 *   streaming — true while streaming (enables stream-safe rendering)
 *   className — extra CSS classes
 */
const AIFormattedText = memo(function AIFormattedText({
  children,
  streaming = false,
  className = "",
}) {
  const normalized = useMemo(() => {
    if (children == null) return "";
    const text = String(children);
    // The normalizer is always called on the final text.
    // During streaming it receives potentially truncated safe text (handled by caller).
    const latexFixed = normalizeLatex(text);
    return autoEmbedYouTubeLinks(latexFixed);
  }, [children]);

  return (
    <div className={cn("ai-formatted-text break-words", className)}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={MD_COMPONENTS}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
});

export default AIFormattedText;
