import { useNavigate } from "react-router-dom";
import { FullPageStatus } from "@/shared/ui";
import ForgeWorkspace from "../components/ForgeWorkspace";
import useForgeWorkspace from "../hooks/useForgeWorkspace";

export default function CuixingPage() {
  const navigate = useNavigate();
  const workspace = useForgeWorkspace();

  if (workspace.loading && !workspace.snapshot) {
    return <FullPageStatus message="正在打开淬行…" />;
  }

  if (workspace.error && !workspace.snapshot) {
    return (
      <FullPageStatus
        message={`淬行加载失败：${workspace.error}`}
      />
    );
  }

  return (
    <ForgeWorkspace
      snapshot={workspace.snapshot}
      busy={workspace.busy}
      onBackToChat={() => navigate("/chat")}
      onRefresh={() => workspace.refresh()}
      onSelectProject={(projectId) => workspace.selectProject(projectId)}
      onSelectTask={(taskId) => workspace.selectTask(taskId)}
      onRegisterProject={(values) => workspace.registerProject(values)}
      onSendMessage={(value) => workspace.sendMessage(value)}
      onDispatch={(task, builder) =>
        workspace.dispatchTask(task, builder)
      }
      onCancel={(runtime) =>
        workspace.cancelDispatch(runtime.id)
      }
      onIntegrate={(task) => workspace.integrateTask(task)}
    />
  );
}
