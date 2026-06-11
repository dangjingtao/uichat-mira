import React from "react";
import HealthCheck from "./HealthCheck";
import Divider from "../../components/Divider";
import Header from "../../components/Header";
import LogButtons from "./LogsButtons";
export default function General() {
  return (
    <div className="mx-auto flex w-full  flex-col gap-6 px-4 pb-6">
      <div className="space-y-2">
        <Header
          miniTitle="Health Check & Logs"
          title="环境检查"
          description="用于确认当前桌面端是否已经连接本地后端，以及数据库与向量数据库是否处于可访问状态。"
          slot={<LogButtons />}
        />
        <HealthCheck />
        <Divider />
      </div>
    </div>
  );
}
