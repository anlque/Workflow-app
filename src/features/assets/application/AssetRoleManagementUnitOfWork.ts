export type AssetRoleManagementUnitOfWork = {
  run<Result>(operation: () => Promise<Result>): Promise<Result>;
};
