export type AssetRetirementUnitOfWork = Readonly<{
  run<Result>(operation: () => Promise<Result>): Promise<Result>;
}>;
