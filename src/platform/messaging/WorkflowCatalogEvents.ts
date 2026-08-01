export type WorkflowCatalogEvents = Readonly<{
  publishChanged(): Promise<void>;
  subscribeChanged(listener: () => void): () => void;
}>;
