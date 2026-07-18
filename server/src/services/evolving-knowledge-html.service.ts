import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

type LocalImage = {
  filePath: string;
  sourceUrl?: string;
};

const toAbsoluteUrl = (value: string, baseUrl: string) => {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value;
  }
};

export const convertCapturedHtmlToMarkdown = (input: {
  html: string;
  sourceUrl: string;
  title: string;
  fallbackMarkdown?: string;
  images?: LocalImage[];
}) => {
  const dom = new JSDOM(input.html, { url: input.sourceUrl });
  const localImages = new Map(
    (input.images ?? [])
      .filter((image) => image.sourceUrl)
      .map((image) => [toAbsoluteUrl(image.sourceUrl!, input.sourceUrl), image.filePath]),
  );

  const imageElements = Array.from(
    dom.window.document.querySelectorAll("img"),
  ) as Array<{
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
  }>;

  for (const image of imageElements) {
    const source = image.getAttribute("src");
    if (!source) continue;
    const localPath = localImages.get(toAbsoluteUrl(source, input.sourceUrl));
    if (localPath) {
      image.setAttribute("src", localPath);
    }
  }

  const article = new Readability(dom.window.document).parse();
  const html = article?.content || dom.window.document.body?.innerHTML || "";
  const markdown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  })
    .turndown(html)
    .trim();

  if (!markdown) {
    throw new Error("无法从页面 HTML 提取有效正文");
  }

  const localizedMarkdown = (input.images ?? []).reduce(
    (value, image) => {
      if (!image.filePath.startsWith("/")) return value;
      return value.replaceAll(
        new URL(image.filePath, input.sourceUrl).href,
        image.filePath,
      );
    },
    markdown,
  );
  const title = article?.title?.trim() || input.title;
  let titledMarkdown = localizedMarkdown.startsWith(`# ${title}`)
    ? localizedMarkdown
    : `# ${title}\n\n${localizedMarkdown}`;

  const fallbackImages = Array.from(
    input.fallbackMarkdown?.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g) ?? [],
  ).map((match) => {
    const alt = match[1];
    const source = match[2];
    const localPath = localImages.get(toAbsoluteUrl(source, input.sourceUrl));
    return `![${alt}](${localPath ?? source})`;
  });
  const missingImages = fallbackImages.filter((image) => !titledMarkdown.includes(image));
  if (missingImages.length > 0) {
    titledMarkdown = `${titledMarkdown}\n\n${missingImages.join("\n\n")}`;
  }

  return {
    title,
    markdown: titledMarkdown,
  };
};
