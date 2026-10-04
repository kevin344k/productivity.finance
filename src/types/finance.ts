export type RecordKind =
  | "income"
  | "expense"
  | "subscription"
  | "loan"
  | "goal"
  | "asset"
  | "liability";

export interface FinanceRecord {
  id: string;
  kind: RecordKind;
  name: string;
  category: string;
  amount: number;
  date: string;
  description?: string;
  dueDay?: number;
  targetAmount?: number;
  interestRate?: number;
  endDate?: string;
  cancelled?: boolean;
}

export interface FinanceBackup {
  version: 1;
  exportedAt: string;
  records: FinanceRecord[];
}

