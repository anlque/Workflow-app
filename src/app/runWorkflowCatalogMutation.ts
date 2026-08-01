import type { WorkflowCatalogEvents } from '@/platform/messaging';

export async function runWorkflowCatalogMutation<Result>(
  mutation: () => Promise<Result>,
  events: Pick<WorkflowCatalogEvents, 'publishChanged'>,
): Promise<Result> {
  const result = await mutation();
  await events.publishChanged();
  return result;
}
