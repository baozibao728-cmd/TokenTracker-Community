export const sdkImport='npm:@insforge/sdk@1.4.5';
export const specs=[
  ['create-community','community_create','POST'],['join-community','community_join','POST'],
  ['leave-community','community_leave','POST'],['community-detail','community_read','GET'],
  ['community-leaderboard','community_leaderboard','GET'],['create-community-transfer','community_create_transfer','POST'],
  ['accept-community-transfer','community_accept_transfer','POST'],['reject-community-transfer','community_reject_transfer','POST'],
  ['delete-community','community_delete','POST'],
].map(([operation,rpc,method])=>({operation,name:`tokentracker-${operation}`,rpc,method}));
