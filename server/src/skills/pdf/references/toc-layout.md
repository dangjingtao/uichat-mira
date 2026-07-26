# PDF TOC layout acceptance guide

Use this reference when a generated PDF contains a table of contents or when the user asks for a navigable report.

## Canonical strategy

Use the runtime-native TOC:

```json
{
  "toc": {
    "title": "报告目录"
  }
}
```

The runtime collects `heading1`, `heading2`, and `heading3` blocks, generates bookmarks, resolves final page numbers during the document build, and renders one continuous TOC.

Do not create page-number entries manually.

## Required visual structure

```text
报告目录

服务团队先看结论 .............................. 7
十维量化画像 .................................. 9
女性生育力综合画像 ........................... 12
男性生育力综合画像 ........................... 21
资料缺口与不确定性 ........................... 31
写在最后 ..................................... 31
```

Requirements:

- one column across the usable page width;
- title text remains horizontal;
- page number uses a narrow right-aligned area;
- leader occupies only the flexible space between title and page number;
- level 2 and level 3 entries use moderate left indentation;
- long entries wrap as a phrase, preferably no more than two lines;
- additional entries flow onto a new TOC page instead of being compressed into columns.

## Prohibited structures

Reject these patterns:

```text
标题 | 点线页码 | 标题 | 点线页码
```

```text
服
务
团
队
先
看
结
论
```

```text
服务团队先看结论........7
```

The first is a manual four-column table. The second is character-by-character vertical wrapping caused by a collapsed title column. The third hard-codes leaders and page numbers before pagination is final.

## Why the failed layout happens

A normal `table` block lets the table layout engine infer column widths from all cells. In a four-column TOC, the leader/page-number cells can claim most of the available width. Chinese text can break between any two characters, so the title column may collapse to roughly one glyph and appear vertical.

This is not an acceptable fallback. Use `spec.toc`.

## Heading preparation

Before generation:

- keep heading text concise and descriptive;
- do not include manual `\n` line breaks;
- do not include page numbers or dot leaders in headings;
- do not duplicate the same heading text at the same level;
- put explanatory subtitles in paragraphs rather than in the TOC heading itself.

Suggested heading length:

- level 1: usually 4–18 Chinese characters;
- level 2: usually 4–24 Chinese characters;
- level 3: use only when it materially helps navigation.

These are readability guides, not truncation rules. Preserve meaning first.

## Acceptance checklist

A TOC passes only when all applicable checks are true:

- every visible entry corresponds to a real heading;
- page numbers match the rendered document;
- bookmarks navigate to the same sections;
- no entry is vertical or character-per-line;
- no title overlaps the leader or page number;
- no page number is clipped;
- indentation clearly distinguishes heading levels;
- the page remains readable at normal zoom;
- long TOCs continue to another page cleanly;
- no ordinary content table is being used as a TOC.

If any check fails, regenerate after correcting the spec or headings. Do not report the PDF as complete.