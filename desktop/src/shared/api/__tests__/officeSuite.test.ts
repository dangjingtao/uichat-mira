// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const clientPost = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/request", () => ({
  client: { post: clientPost },
  post: vi.fn(),
}));

import { post } from "@/shared/lib/request";
import {
  createExcelVerificationCopy,
  createOfficeSample,
  createWordReviewCopy,
  createWordVerificationCopy,
  inspectOfficeFile,
} from "../officeSuite";

describe("office suite api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a file for inspection without a request timeout", async () => {
    const file = new File(["doc"], "brief.docx");
    const inspection = { kind: "word", fileName: file.name };
    vi.mocked(post).mockResolvedValue(inspection);

    await expect(inspectOfficeFile(file)).resolves.toBe(inspection);

    expect(post).toHaveBeenCalledWith(
      "/microapps/office-suite/inspect",
      expect.any(FormData),
      { timeout: 0 },
    );
    expect(vi.mocked(post).mock.calls[0]?.[1]).toHaveProperty(
      "get",
      expect.any(Function),
    );
  });

  it("creates samples and honors the response attachment filename", async () => {
    const blob = new Blob(["xlsx"]);
    clientPost.mockResolvedValue({
      data: blob,
      headers: { "content-disposition": 'attachment; filename="report.xlsx"' },
    });

    await expect(createOfficeSample("excel")).resolves.toEqual({
      kind: "excel",
      fileName: "report.xlsx",
      blob,
    });
    expect(clientPost).toHaveBeenCalledWith(
      "/microapps/office-suite/create",
      { kind: "excel" },
      { responseType: "blob", timeout: 0 },
    );
  });

  it("uses deterministic fallback filenames for verification copies", async () => {
    const blob = new Blob(["copy"]);
    clientPost.mockResolvedValue({ data: blob, headers: {} });
    const word = new File(["doc"], "brief.DOCX");
    const excel = new File(["sheet"], "budget.xlsx");

    await expect(createWordVerificationCopy(word)).resolves.toMatchObject({
      kind: "word",
      fileName: "brief-wenshu.docx",
    });
    await expect(createExcelVerificationCopy(excel)).resolves.toMatchObject({
      kind: "excel",
      fileName: "budget-wenshu.xlsx",
    });
    expect(clientPost.mock.calls[0]?.[0]).toBe(
      "/microapps/office-suite/document/verification-copy",
    );
    expect(clientPost.mock.calls[1]?.[0]).toBe(
      "/microapps/office-suite/spreadsheet/verification-copy",
    );
  });

  it("encodes every requested Word review operation in the route", async () => {
    clientPost.mockResolvedValue({ data: new Blob(["review"]), headers: {} });
    const file = new File(["doc"], "contract.docx");

    await createWordReviewCopy(file, {
      author: "  Mira Reviewer  ",
      comment: { targetText: "Clause A", text: "Needs evidence" },
      insertion: { afterText: "Clause B", text: "New clause" },
      deletion: { targetText: "Obsolete clause" },
    });

    const route = new URL(clientPost.mock.calls[0]?.[0], "http://localhost");
    expect(route.pathname).toBe(
      "/microapps/office-suite/document/review-copy",
    );
    expect(Object.fromEntries(route.searchParams)).toEqual({
      author: "Mira Reviewer",
      commentTarget: "Clause A",
      commentText: "Needs evidence",
      insertAfter: "Clause B",
      insertText: "New clause",
      deleteTarget: "Obsolete clause",
    });
    expect(clientPost.mock.calls[0]?.[2]).toEqual({
      responseType: "blob",
      timeout: 0,
    });
  });
});
