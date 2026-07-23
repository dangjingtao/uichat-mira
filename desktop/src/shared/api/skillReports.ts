import { client } from "@/shared/lib/request";

const reportBasePath = (threadId: string, sessionId: string) =>
  `/threads/${encodeURIComponent(threadId)}/skill-reports/${encodeURIComponent(sessionId)}`;

export const getSkillReportHtml = async (
  threadId: string,
  sessionId: string,
) => {
  const response = await client.get<string>(
    `${reportBasePath(threadId, sessionId)}/html`,
    { responseType: "text" },
  );
  return response.data;
};

export const getSkillReportPdfBlob = async (
  threadId: string,
  sessionId: string,
) => {
  const response = await client.get<Blob>(
    `${reportBasePath(threadId, sessionId)}/pdf`,
    { responseType: "blob" },
  );
  return response.data;
};
