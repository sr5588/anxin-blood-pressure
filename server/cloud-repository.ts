import { Repository, Store } from './repository';
export class CloudRepository implements Repository {
  constructor(private db: any) {}
  private store(db: any): Store {
    return {
      get: async <T>(c: string, id: string): Promise<T | null> => {
        try {
          const r = await db.collection(c).doc(id).get();
          const d = Array.isArray(r.data) ? r.data[0] : r.data;
          if (!d) return null;
          const { _id, ...clean } = d;
          return clean as T;
        } catch (e: any) {
          if (e.errCode === -1 && /not exist|不存在/i.test(e.errMsg || e.message)) return null;
          if (/DOCUMENT_NOT_FOUND|document.*not.*exist/i.test(e.code || e.message || ''))
            return null;
          throw e;
        }
      },
      set: async (c, id, v) => {
        await db.collection(c).doc(id).set({ data: v });
      },
      remove: async (c, id) => {
        await db.collection(c).doc(id).remove();
      },
    };
  }
  get<T>(c: string, id: string) {
    return this.store(this.db).get<T>(c, id);
  }
  set(c: string, id: string, v: unknown) {
    return this.store(this.db).set(c, id, v);
  }
  remove(c: string, id: string) {
    return this.store(this.db).remove(c, id);
  }
  async list<T>(c: string, w: Record<string, unknown>): Promise<T[]> {
    const results: T[] = [];
    let last = '';
    while (true) {
      const where = last ? { ...w, _id: this.db.command.gt(last) } : w;
      const page = await this.db.collection(c).where(where).orderBy('_id', 'asc').limit(100).get();
      for (const { _id, ...row } of page.data) results.push(row as T);
      if (page.data.length < 100) break;
      last = page.data[page.data.length - 1]._id;
    }
    return results;
  }
  transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    return this.db.runTransaction((tx: any) => fn(this.store(tx)));
  }
}
