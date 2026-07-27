import { get } from "@/shared/lib/request";
import type { DashboardOverview } from "../types/dashboard-types";

export function getDashboardOverview() {
  return get<DashboardOverview>("/dashboard/overview");
}
