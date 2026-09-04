export type DocumentPreferenceSource = Readonly<{
  load(): Promise<unknown>;
  subscribe(listener: (value: unknown) => void): () => void;
}>;
