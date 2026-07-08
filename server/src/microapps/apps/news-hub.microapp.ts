import { newsHubBindingSchema } from "@/db/repositories/micro-apps.repository.js";
import type { MicroAppDefinition } from "../types.js";

export const newsHubMicroApp: MicroAppDefinition = {
  type: "news_hub",
  label: "NewsHub",
  description:
    "为桌面内的 NewsHub 新闻聚合设置页保留共享注册定义和稳定 runtime key，不在这里承接外部接入点执行逻辑。",
  runtimeKey: "news_hub",
  supportedAccessPoints: ["desktop.news_hub"],
  bindingSchema: newsHubBindingSchema,
  async invoke() {
    return {
      mode: "error",
      errorCode: "news_hub_not_implemented",
      errorMessage:
        "news_hub 已完成共享注册，但当前线程没有引入外部接入点运行时执行逻辑。",
    };
  },
};
