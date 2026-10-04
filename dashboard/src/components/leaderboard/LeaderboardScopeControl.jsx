import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SegmentedControl } from "../../ui/components/SegmentedControl.jsx";
import { copy } from "../../lib/copy";

export function LeaderboardScopeControl() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const scope = params.get("scope") === "community" ? "community" : "global";
  return <SegmentedControl
    value={scope}
    ariaLabel={copy("leaderboard.scope.label")}
    className="shrink-0"
    options={[{ id: "global", label: copy("leaderboard.scope.global") }, { id: "community", label: copy("leaderboard.scope.community") }]}
    onChange={(next) => {
      params.set("scope", next);
      params.delete("page");
      navigate(`/leaderboard?${params}`);
    }}
  />;
}
