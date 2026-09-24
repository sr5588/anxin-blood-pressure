"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryRepository = void 0;
class MemoryRepository {
    constructor() {
        this.data = new Map();
        this.queue = Promise.resolve();
    }
    async get(c, id) {
        return structuredClone(this.data.get(c + '/' + id) || null);
    }
    async set(c, id, v) {
        this.data.set(c + '/' + id, structuredClone(v));
    }
    async remove(c, id) {
        this.data.delete(c + '/' + id);
    }
    async list(c, w) {
        return [...this.data.entries()]
            .filter(([k, v]) => k.startsWith(c + '/') && Object.entries(w).every(([p, x]) => v[p] === x))
            .map(([, v]) => structuredClone(v));
    }
    async transaction(fn) {
        const run = this.queue.then(async () => {
            const snapshot = structuredClone(this.data);
            try {
                return await fn(this);
            }
            catch (e) {
                this.data = snapshot;
                throw e;
            }
        });
        this.queue = run.catch(() => { });
        return run;
    }
}
exports.MemoryRepository = MemoryRepository;
