"use client";

import { create } from "zustand";
import { db } from "@/lib/db";
import type { FinanceRecord } from "@/types/finance";

// Ids de los datos de ejemplo de versiones anteriores; se eliminan una sola vez.
const legacyDemoIds = new Set([
  "income-1", "income-2", "expense-1", "expense-2", "expense-3", "expense-4", "expense-5",
  "sub-1", "sub-2", "sub-3", "loan-1", "goal-1", "goal-2", "asset-1", "asset-2", "liability-1",
]);

interface FinanceState {
  records: FinanceRecord[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addRecord: (record: FinanceRecord) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  replaceRecords: (records: FinanceRecord[]) => Promise<void>;
}

let hydrationPromise: Promise<void> | null = null;

export const useFinanceStore = create<FinanceState>((set, get) => ({
  records: [],
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
      const stored = await db.records.toArray();
      const demo = stored.filter((record) => legacyDemoIds.has(record.id));
      if (demo.length) await db.records.bulkDelete(demo.map((record) => record.id));
      set({ records: stored.filter((record) => !legacyDemoIds.has(record.id)), hydrated: true });
    })();
    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },
  addRecord: async (record) => {
    await db.records.put(record);
    set((state) => ({
      records: [record, ...state.records.filter((item) => item.id !== record.id)],
    }));
  },
  removeRecord: async (id) => {
    await db.records.delete(id);
    set((state) => ({ records: state.records.filter((record) => record.id !== id) }));
  },
  replaceRecords: async (records) => {
    await db.transaction("rw", db.records, async () => {
      await db.records.clear();
      await db.records.bulkPut(records);
    });
    set({ records });
  },
}));
