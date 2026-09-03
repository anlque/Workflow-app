import type { Table } from 'dexie';

import type { LocusoraDatabase } from '@/platform/storage';

import type { WorkflowRepository } from '../application/WorkflowRepository';
import type { Workflow, WorkflowId } from '../domain/Workflow';
import { WorkflowApplicationError } from '../application/WorkflowApplicationError';
import { mapWorkflowRecord, mapWorkflowToRecord } from './mapWorkflowRecord';
import type { WorkflowRecord } from './WorkflowRecord';

export class DexieWorkflowRepository implements WorkflowRepository {
  readonly #database: LocusoraDatabase;
  readonly #workflows: Table<WorkflowRecord, string>;

  public constructor(database: LocusoraDatabase) {
    this.#database = database;
    this.#workflows = database.table<WorkflowRecord, string>('workflows');
  }

  public async list(): Promise<readonly Workflow[]> {
    const records = await this.#workflows.orderBy('order').toArray();
    return records.map(mapWorkflowRecord);
  }

  public async get(id: WorkflowId): Promise<Workflow | null> {
    const record: unknown = await this.#workflows.get(id);
    return record === undefined ? null : mapWorkflowRecord(record);
  }

  public async save(workflow: Workflow): Promise<void> {
    await this.#database.runReadWrite('workflows', async () => {
      const existing = await this.#workflows.get(workflow.id);
      if (existing !== undefined) {
        await this.#workflows.put(
          mapWorkflowToRecord(workflow, existing.order),
        );
        return;
      }

      const last = await this.#workflows.orderBy('order').last();
      await this.#workflows.add(
        mapWorkflowToRecord(workflow, (last?.order ?? -1) + 1),
      );
    });
  }

  public async delete(id: WorkflowId): Promise<void> {
    await this.#database.runReadWrite('workflows', async () => {
      await this.#workflows.delete(id);
      const remaining = await this.#workflows.orderBy('order').toArray();
      await this.#workflows.bulkPut(
        remaining.map((record, order) => ({ ...record, order })),
      );
    });
  }

  public async replaceOrder(ids: readonly WorkflowId[]): Promise<void> {
    await this.#database.runReadWrite('workflows', async () => {
      const records = await this.#workflows.toArray();
      const recordsById = new Map(records.map((record) => [record.id, record]));
      const reordered = ids.map((id, order) => {
        const record = recordsById.get(id);
        if (record === undefined) {
          throw new WorkflowApplicationError(`Workflow ${id} was not found.`);
        }

        return { ...record, order };
      });

      if (
        reordered.length !== records.length ||
        new Set(ids).size !== records.length
      ) {
        throw new WorkflowApplicationError(
          'Workflow order must contain every existing Workflow exactly once.',
        );
      }

      await this.#workflows.bulkPut(reordered);
    });
  }
}
