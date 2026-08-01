export type AlarmScheduler = {
  schedule(name: string, when: number): Promise<void>;
  clear(name: string): Promise<void>;
  onFired(listener: (name: string) => Promise<void>): () => void;
};
