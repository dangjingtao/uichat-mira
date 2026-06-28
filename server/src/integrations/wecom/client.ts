import { mcpInternalError } from "@/mcp/core/errors.js";
import { resolveWecomConfig } from "./config.js";

const WECOM_API_BASE = "https://qyapi.weixin.qq.com/cgi-bin";

type WecomAccessTokenResponse = {
  errcode?: number;
  errmsg?: string;
  access_token?: string;
};

type WecomSendMessageResponse = {
  errcode?: number;
  errmsg?: string;
  invaliduser?: string;
};

type WecomDepartment = {
  id?: number;
  name?: string;
};

type WecomUserSimple = {
  userid?: string;
  name?: string;
  department?: number[];
};

type WecomUserResponse = {
  errcode?: number;
  errmsg?: string;
  userid?: string;
  name?: string;
  department?: number[];
};

type WecomDepartmentListResponse = {
  errcode?: number;
  errmsg?: string;
  department?: WecomDepartment[];
};

const assertWecomSuccess = (
  response: { errcode?: number; errmsg?: string },
  action: string,
) => {
  if ((response.errcode ?? 0) !== 0) {
    throw mcpInternalError(
      `WeCom ${action} failed: ${response.errcode ?? "unknown"} ${response.errmsg ?? ""}`.trim(),
    );
  }
};

export const getWecomAppAccessToken = async () => {
  const config = resolveWecomConfig();
  if (!config.corpId || !config.appSecret) {
    throw mcpInternalError("WeCom app config is incomplete.");
  }

  const response = await fetch(
    `${WECOM_API_BASE}/gettoken?corpid=${encodeURIComponent(
      config.corpId,
    )}&corpsecret=${encodeURIComponent(config.appSecret)}`,
  );

  if (!response.ok) {
    throw mcpInternalError(`WeCom gettoken failed: ${response.status}`);
  }

  const data = (await response.json()) as WecomAccessTokenResponse;
  assertWecomSuccess(data, "gettoken");

  if (!data.access_token) {
    throw mcpInternalError("WeCom gettoken returned no access_token.");
  }

  return data.access_token;
};

export const sendWecomTextMessageToUser = async (input: {
  userId: string;
  content: string;
}) => {
  const config = resolveWecomConfig();
  if (!config.agentId) {
    throw mcpInternalError("WeCom app config is incomplete.");
  }

  const accessToken = await getWecomAppAccessToken();
  const response = await fetch(
    `${WECOM_API_BASE}/message/send?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        touser: input.userId,
        msgtype: "text",
        agentid: Number(config.agentId),
        text: {
          content: input.content,
        },
        safe: 0,
      }),
    },
  );

  if (!response.ok) {
    throw mcpInternalError(`WeCom send message failed: ${response.status}`);
  }

  const data = (await response.json()) as WecomSendMessageResponse;
  assertWecomSuccess(data, "send message");
  return data;
};

export const getWecomUserByUserId = async (userId: string) => {
  const accessToken = await getWecomAppAccessToken();
  const response = await fetch(
    `${WECOM_API_BASE}/user/get?access_token=${encodeURIComponent(
      accessToken,
    )}&userid=${encodeURIComponent(userId)}`,
  );

  if (!response.ok) {
    throw mcpInternalError(`WeCom get user failed: ${response.status}`);
  }

  const data = (await response.json()) as WecomUserResponse;
  assertWecomSuccess(data, "get user");
  return data;
};

export const listWecomDepartments = async () => {
  const accessToken = await getWecomAppAccessToken();
  const response = await fetch(
    `${WECOM_API_BASE}/department/list?access_token=${encodeURIComponent(accessToken)}`,
  );

  if (!response.ok) {
    throw mcpInternalError(`WeCom department list failed: ${response.status}`);
  }

  const data = (await response.json()) as WecomDepartmentListResponse;
  assertWecomSuccess(data, "department list");
  return data.department ?? [];
};
