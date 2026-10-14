"use client";

import { create } from "zustand";
import { db } from "@/lib/db";
import { apiDeleteRecord, apiListRecords, apiPutRecord, apiReplaceRecords } from "@/lib/api";
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
  reset: () => void;
  addRecord: (record: FinanceRecord) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  replaceRecords: (records: FinanceRecord[]) => Promise<void>;
}

let hydrationPromise: Promise<void> | null = null;

export const useFinanceStore = create<FinanceState>((set, get) => ({
  records: [],
  hydrated: false,
  reset: () => set({ records: [], hydrated: false }),
  hydrate: async () => {
    if (get().hydrated) return;
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
      let stored = await apiListRecords();
      if (stored.length === 0) {
        // Migración única: sube lo que había guardado localmente en el navegador.
        const local = (await db.records.toArray()).filter((record) => !legacyDemoIds.has(record.id));
        if (local.length) {
          await apiReplaceRecords(local);
          stored = local;
        }
      }
      const demo = stored.filter((record) => legacyDemoIds.has(record.id));
      for (const record of demo) await apiDeleteRecord(record.id);
      set({ records: stored.filter((record) => !legacyDemoIds.has(record.id)), hydrated: true });
    })();
    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },
  addRecord: async (record) => {
    await apiPutRecord(record);
    set((state) => ({
      records: [record, ...state.records.filter((item) => item.id !== record.id)],
    }));
  },
  removeRecord: async (id) => {
    await apiDeleteRecord(id);
    set((state) => ({ records: state.records.filter((record) => record.id !== id) }));
  },
  replaceRecords: async (records) => {
    await apiReplaceRecords(records);
    set({ records });
  },
}));
