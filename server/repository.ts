export interface Store {
  get<T>(collection: string, id: string): Promise<T | null>;
  set(collection: string, id: string, value: unknown): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
}
export interface Repository extends Store {
  list<T>(collection: string, where: Record<string, unknown>): Promise<T[]>;
  transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T>;
}
export class MemoryRepository implements Repository {
  data = new Map<string, unknown>();
  private queue: Promise<unknown> = Promise.resolve();
  async get<T>(c: string, id: string): Promise<T | null> {
    return structuredClone((this.data.get(c + '/' + id) as T) || null);
  }
  async set(c: string, id: string, v: unknown) {
    this.data.set(c + '/' + id, structuredClone(v));
  }
  async remove(c: string, id: string) {
    this.data.delete(c + '/' + id);
  }
  async list<T>(c: string, w: Record<string, unknown>): Promise<T[]> {
    return [...this.data.entries()]
      .filter(
        ([k, v]) =>
          k.startsWith(c + '/') && Object.entries(w).every(([p, x]) => (v as any)[p] === x),
      )
      .map(([, v]) => structuredClone(v as T));
  }
  async transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const snapshot = structuredClone(this.data);
      try {
        return await fn(this);
      } catch (e) {
        this.data = snapshot;
        throw e;
      }
    });
    this.queue = run.catch(() => {});
    return run;
  }
}
