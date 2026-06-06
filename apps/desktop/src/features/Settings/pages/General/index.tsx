import React from "react";
import HealthCheck from "./HealthCheck";
import Divider from "../../components/Divider";

export default function General() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div className="space-y-2">
        <HealthCheck />
        <Divider />
      </div>
    </div>
  );
}
