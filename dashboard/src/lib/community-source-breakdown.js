import { LEADERBOARD_TOKEN_COLUMNS } from "./leaderboard-columns.js";

// Validation only: source attribution and ranks come from the RPC. An older
// backend (or incomplete payload) must not be painted as eleven zero columns.
export function hasCommunitySourceBreakdown(row) {
  if (typeof row?.total_tokens !== "string" || !/^\d+$/.test(row.total_tokens)) return false;
  let sum = 0n;
  for (const { key } of LEADERBOARD_TOKEN_COLUMNS) {
    if (typeof row[key] !== "string" || !/^\d+$/.test(row[key])) return false;
    sum += BigInt(row[key]);
  }
  return sum === BigInt(row.total_tokens);
}
