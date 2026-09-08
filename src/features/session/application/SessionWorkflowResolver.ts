import type { Workflow } from '@/features/workflow';

export type SessionWorkflowResolver = {
  resolve(workflow: Workflow): Promise<Workflow>;
};
