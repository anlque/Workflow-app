import type { Workflow, WorkflowId } from '../../domain/Workflow';
import type { WorkflowRepository } from '../WorkflowRepository';

export class InMemoryWorkflowRepository implements WorkflowRepository {
  readonly #workflows = new Map<WorkflowId, Workflow>();
  #order: WorkflowId[] = [];

  public constructor(initialWorkflows: readonly Workflow[] = []) {
    initialWorkflows.forEach((workflow) => {
      this.#workflows.set(workflow.id, workflow);
      this.#order.push(workflow.id);
    });
  }

  public list(): Promise<readonly Workflow[]> {
    return Promise.resolve(
      this.#order.flatMap((id) => {
        const workflow = this.#workflows.get(id);
        return workflow === undefined ? [] : [workflow];
      }),
    );
  }

  public get(id: WorkflowId): Promise<Workflow | null> {
    return Promise.resolve(this.#workflows.get(id) ?? null);
  }

  public save(workflow: Workflow): Promise<void> {
    if (!this.#workflows.has(workflow.id)) {
      this.#order.push(workflow.id);
    }

    this.#workflows.set(workflow.id, workflow);
    return Promise.resolve();
  }

  public delete(id: WorkflowId): Promise<void> {
    this.#workflows.delete(id);
    this.#order = this.#order.filter((workflowId) => workflowId !== id);
    return Promise.resolve();
  }

  public replaceOrder(ids: readonly WorkflowId[]): Promise<void> {
    this.#order = [...ids];
    return Promise.resolve();
  }
}
