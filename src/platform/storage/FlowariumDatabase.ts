import Dexie from 'dexie';

export type DatabaseSchema = Readonly<{
  version: number;
  stores: Readonly<Record<string, string>>;
}>;

export type FlowariumDatabaseOptions = Readonly<{
  name?: string;
  schemas: readonly DatabaseSchema[];
}>;

export class FlowariumDatabase extends Dexie {
  public constructor({
    name = 'flowarium',
    schemas,
  }: FlowariumDatabaseOptions) {
    super(name);

    [...schemas]
      .sort((left, right) => left.version - right.version)
      .forEach(({ version, stores }) => {
        this.version(version).stores(stores);
      });
  }

  public runReadWrite<Result>(
    tableName: string,
    operation: () => Promise<Result>,
  ): Promise<Result> {
    return this.transaction('rw', tableName, operation);
  }
}
