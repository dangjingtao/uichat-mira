import { describe, expect, it } from "vitest";
import { convertCapturedHtmlToMarkdown } from "./evolving-knowledge-html.service.js";

describe("convertCapturedHtmlToMarkdown", () => {
  it("extracts the article body and localizes uploaded images", () => {
    const result = convertCapturedHtmlToMarkdown({
      sourceUrl: "https://example.com/article",
      title: "Fallback title",
      html: `
        <html>
          <head><title>Article title</title></head>
          <body>
            <nav>Navigation that should not be captured</nav>
            <article>
              <h1>Article title</h1>
              <p>This is the article body with enough content to be selected.</p>
              <img src="/hero.png" alt="Hero image" />
            </article>
          </body>
        </html>
      `,
      images: [
        {
          sourceUrl: "https://example.com/hero.png",
          filePath: "/attachments/hero.png",
        },
      ],
    });

    expect(result.title).toBe("Article title");
    expect(result.markdown).toContain("# Article title");
    expect(result.markdown).toContain("This is the article body");
    expect(result.markdown).toContain("![Hero image](/attachments/hero.png)");
    expect(result.markdown).not.toContain("Navigation that should not be captured");
  });

  it("preserves captured images omitted by Readability", () => {
    const result = convertCapturedHtmlToMarkdown({
      html: `
        <html><head><title>Gallery</title></head><body>
          <article><p>本站内容仅供展示。</p></article>
        </body></html>
      `,
      sourceUrl: "https://example.com/gallery",
      title: "Gallery",
      fallbackMarkdown: "![Gallery 1](https://cdn.example.com/gallery-1.jpg)",
      images: [
        {
          filePath: "/attachments/gallery-1.jpg",
          sourceUrl: "https://cdn.example.com/gallery-1.jpg",
        },
      ],
    });

    expect(result.markdown).toContain("![Gallery 1](/attachments/gallery-1.jpg)");
  });

  it("drops HTML images that were not captured as local attachments", () => {
    const result = convertCapturedHtmlToMarkdown({
      sourceUrl: "https://example.com/article",
      title: "Article",
      html: `
        <html><body><article>
          <p>正文内容。</p>
          <img src="/saved.png" alt="已保存" />
          <img src="https://cdn.example.com/expired.png" alt="未保存" />
        </article></body></html>
      `,
      images: [
        {
          sourceUrl: "https://example.com/saved.png",
          filePath: "/attachments/saved.png",
        },
      ],
    });

    expect(result.markdown).toContain("![已保存](/attachments/saved.png)");
    expect(result.markdown).not.toContain("https://cdn.example.com/expired.png");
  });
});
