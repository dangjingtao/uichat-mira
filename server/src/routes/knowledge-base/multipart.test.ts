import assert from "node:assert/strict";
import { test } from "vitest";
import iconv from "iconv-lite";
import { parseOptionalTextEncoding } from "./multipart.js";

test("parseOptionalTextEncoding normalizes supported aliases", () => {
  assert.equal(parseOptionalTextEncoding("utf-8"), "utf8");
  assert.equal(parseOptionalTextEncoding("gbk"), "gb18030");
  assert.equal(parseOptionalTextEncoding("gb2312"), "gb18030");
  assert.equal(parseOptionalTextEncoding("gb18030"), "gb18030");
  assert.equal(parseOptionalTextEncoding("shift-jis"), undefined);
});

test("iconv-lite decodes gb18030 chinese text correctly", () => {
  const source = "操曰：吾手下有数十员大将。";
  const buffer = iconv.encode(source, "gb18030");
  const decoded = iconv.decode(buffer, "gb18030");

  assert.equal(decoded, source);
});
