import Dexie, { type EntityTable } from "dexie";
import type { FinanceRecord } from "@/types/finance";

class MoneyPilotDatabase extends Dexie {
  records!: EntityTable<FinanceRecord, "id">;

  constructor() {
    super("money-pilot-ai");
    this.version(1).stores({
      records: "id, kind, date, category",
    });
  }
}

export const db = new MoneyPilotDatabase();
