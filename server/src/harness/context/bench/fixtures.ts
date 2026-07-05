import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import iconv from "iconv-lite";

export interface ContextReadBenchFixture {
  rootPath: string;
  paths: {
    chineseDir: string;
    chineseReadme: string;
    chineseFile: string;
    bomFile: string;
    gbkFile: string;
    binaryFile: string;
    largeFile: string;
    listReadmeDir: string;
    listReadme: string;
    inspectBudgetFile: string;
    inspectContextFile: string;
    inspectExtraFile: string;
  };
  expected: {
    chineseReadmeText: string;
    chineseFileText: string;
    bomText: string;
    gbkText: string;
    listReadmeText: string;
    inspectKeyword: string;
  };
  cleanup: () => void;
}

const writeUtf8File = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
};

export const createContextReadBenchFixture = (): ContextReadBenchFixture => {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "rag-demo-context-read-bench-"));

  const paths = {
    chineseDir: "中文目录",
    chineseReadme: path.posix.join("中文目录", "README.md"),
    chineseFile: path.posix.join("中文目录", "中文文件名-说明.txt"),
    bomFile: "带BOM的说明.txt",
    gbkFile: "GBK-示例.txt",
    binaryFile: "二进制样本.bin",
    largeFile: "超大日志.log",
    listReadmeDir: "产品说明",
    listReadme: path.posix.join("产品说明", "README.md"),
    inspectBudgetFile: path.posix.join("inspect-module", "budget.ts"),
    inspectContextFile: path.posix.join("inspect-module", "context.ts"),
    inspectExtraFile: path.posix.join("inspect-module", "notes.md"),
  };

  const expected = {
    chineseReadmeText: "这里是中文目录 README，用于 bench 验证 list -> open。",
    chineseFileText: "中文文件名内容，验证 UTF-8 中文读取稳定。",
    bomText: "UTF-8 BOM 文件内容，用于验证编码标记。",
    gbkText: "这是 GBK 编码内容，用于验证至少不崩。",
    listReadmeText: "产品说明 README，用于验证 list -> open README。",
    inspectKeyword: "预算约束",
  };

  writeUtf8File(path.join(rootPath, paths.chineseReadme), `${expected.chineseReadmeText}\n第二行`);
  writeUtf8File(path.join(rootPath, paths.chineseFile), `${expected.chineseFileText}\n附加行`);
  fs.writeFileSync(path.join(rootPath, paths.bomFile), `\uFEFF${expected.bomText}\n第二行`, "utf8");
  fs.writeFileSync(path.join(rootPath, paths.gbkFile), iconv.encode(expected.gbkText, "gbk"));
  fs.writeFileSync(path.join(rootPath, paths.binaryFile), Buffer.from([0, 255, 12, 0, 99, 10]));
  writeUtf8File(
    path.join(rootPath, paths.listReadme),
    `${expected.listReadmeText}\n请继续阅读具体章节。`,
  );
  writeUtf8File(
    path.join(rootPath, paths.inspectBudgetFile),
    [
      "export const budgetRule = {",
      "  label: '预算约束',",
      "  maxFiles: 2,",
      "  maxChars: 120,",
      "};",
      "export const explainBudget = () => '预算约束需要限制读取文件数和字符数';",
    ].join("\n"),
  );
  writeUtf8File(
    path.join(rootPath, paths.inspectContextFile),
    [
      "export const contextBuilder = () => {",
      "  return '上下文构建会把预算约束写入 diagnostics';",
      "};",
      "export const contextSummary = '上下文构建必须在 maxChars 预算内返回';",
    ].join("\n"),
  );
  writeUtf8File(
    path.join(rootPath, paths.inspectExtraFile),
    [
      "# Inspect Notes",
      "预算约束之外的附加说明。",
      "这份文件用于验证 maxFiles 生效时不会继续读第三个文件。",
    ].join("\n"),
  );

  const largeLines = Array.from({ length: 400 }, (_, index) => `line-${index + 1} context budget trace`);
  writeUtf8File(path.join(rootPath, paths.largeFile), largeLines.join("\n"));

  return {
    rootPath,
    paths,
    expected,
    cleanup: () => {
      fs.rmSync(rootPath, { recursive: true, force: true });
    },
  };
};
