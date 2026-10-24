import type { Table } from 'dexie';

import type { LocusoraDatabase } from '@/platform/storage';

import { WorkflowApplicationError } from '../application/WorkflowApplicationError';
import type {
  WorkflowConversionCommit,
  WorkflowConversionUnitOfWork,
} from '../application/WorkflowConversionUnitOfWork';
import { mapWorkflowRecord, mapWorkflowToRecord } from './mapWorkflowRecord';
import type { WorkflowRecord } from './WorkflowRecord';

export class DexieWorkflowConversionUnitOfWork implements WorkflowConversionUnitOfWork {
  readonly #database: LocusoraDatabase;
  readonly #workflows: Table<WorkflowRecord, string>;

  public constructor(database: LocusoraDatabase) {
    this.#database = database;
    this.#workflows = database.table<WorkflowRecord, string>('workflows');
  }

  public commit(change: WorkflowConversionCommit): Promise<void> {
    return this.#database.runReadWrite('workflows', async () => {
      const records = await this.#workflows.toArray();
      const source = records.find(({ id }) => id === change.replacement.id);
      if (source === undefined)
        throw new WorkflowApplicationError(
          `Workflow ${change.replacement.id} was not found.`,
        );
      if (mapWorkflowRecord(source).mode !== 'quick')
        throw new WorkflowApplicationError(
          'Only a Quick Workflow can be converted.',
        );
      if (
        change.copy !== undefined &&
        records.some(({ id }) => id === change.copy?.id)
      )
        throw new WorkflowApplicationError(
          'Quick copy identifier must be unique.',
        );

      await this.#workflows.put(
        mapWorkflowToRecord(change.replacement, source.order),
      );
      if (change.copy !== undefined) {
        await this.#workflows.add(
          mapWorkflowToRecord(change.copy, records.length),
        );
      }

      const changedRecords = await this.#workflows.toArray();
      const byId = new Map(changedRecords.map((record) => [record.id, record]));
      if (
        change.order.length !== changedRecords.length ||
        new Set(change.order).size !== changedRecords.length
      )
        throw new WorkflowApplicationError(
          'Workflow order must contain every existing Workflow exactly once.',
        );
      const ordered = change.order.map((id, order) => {
        const record = byId.get(id);
        if (record === undefined)
          throw new WorkflowApplicationError(`Workflow ${id} was not found.`);
        return { ...record, order };
      });
      await this.#workflows.bulkPut(ordered);
    });
  }
}
