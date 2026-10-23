import MarkdownIt from "markdown-it";
import createDOMPurify from "dompurify";
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
export function renderMarkdown(source: string, win: Window & typeof globalThis): string {
  return createDOMPurify(win).sanitize(markdown.render(source), {
    ALLOWED_TAGS: ["p","h1","h2","h3","h4","h5","h6","ul","ol","li","blockquote","pre","code","strong","em","s","hr","br","table","thead","tbody","tr","th","td","a","img"],
    ALLOWED_ATTR: ["href","src","alt","title","start"],
  });
}
