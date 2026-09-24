"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudRepository = void 0;
class CloudRepository {
    constructor(db) {
        this.db = db;
    }
    store(db) {
        return {
            get: async (c, id) => {
                try {
                    const r = await db.collection(c).doc(id).get();
                    const d = Array.isArray(r.data) ? r.data[0] : r.data;
                    if (!d)
                        return null;
                    const { _id, ...clean } = d;
                    return clean;
                }
                catch (e) {
                    if (e.errCode === -1 && /not exist|不存在/i.test(e.errMsg || e.message))
                        return null;
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
    get(c, id) {
        return this.store(this.db).get(c, id);
    }
    set(c, id, v) {
        return this.store(this.db).set(c, id, v);
    }
    remove(c, id) {
        return this.store(this.db).remove(c, id);
    }
    async list(c, w) {
        const results = [];
        let last = '';
        while (true) {
            const where = last ? { ...w, _id: this.db.command.gt(last) } : w;
            const page = await this.db.collection(c).where(where).orderBy('_id', 'asc').limit(100).get();
            for (const { _id, ...row } of page.data)
                results.push(row);
            if (page.data.length < 100)
                break;
            last = page.data[page.data.length - 1]._id;
        }
        return results;
    }
    transaction(fn) {
        return this.db.runTransaction((tx) => fn(this.store(tx)));
    }
}
exports.CloudRepository = CloudRepository;
