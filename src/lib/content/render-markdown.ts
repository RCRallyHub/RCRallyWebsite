// Renders a markdown body (as stored in Turso `pages.body` / `events.body` /
// `policies.body`) to HTML using Astro's own markdown pipeline
// (@astrojs/markdown-remark) — the exact same remark/rehype config Astro
// used for `.render()` on a content-collection entry (gfm + smartypants
// enabled by default, matching this project's astro.config.mjs, which sets
// no custom `markdown` options). This keeps prose output byte-identical to
// what `<Content />` used to produce, so pages can swap
// `const { Content } = await entry.render()` for
// `const html = await renderMarkdown(entry.body)` and render with
// `<div set:html={html} />` instead of `<Content />` with no visual change.
import { createMarkdownProcessor, type MarkdownProcessor } from '@astrojs/markdown-remark';

let processorPromise: Promise<MarkdownProcessor> | undefined;

function getProcessor(): Promise<MarkdownProcessor> {
  if (!processorPromise) {
    processorPromise = createMarkdownProcessor();
  }
  return processorPromise;
}

export async function renderMarkdown(body: string | null | undefined): Promise<string> {
  if (!body) return '';
  const processor = await getProcessor();
  const result = await processor.render(body);
  return result.code;
}
