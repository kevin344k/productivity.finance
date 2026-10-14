export type RecordKind =
  | "income"
  | "expense"
  | "subscription"
  | "loan"
  | "goal"
  | "asset"
  | "liability"
  | "note";

export type LoanType = "french" | "german" | "custom";

export interface LoanInstallment {
  n: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  fees: number;
  balance: number;
  paid?: boolean;
}

export interface NoteItem {
  id: string;
  text: string;
  done: boolean;
  due?: string;
  budget?: number;
}

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
  lender?: string;
  loanType?: LoanType;
  principalAmount?: number;
  termMonths?: number;
  schedule?: LoanInstallment[];
  color?: string;
  body?: string;
  items?: NoteItem[];
}

export interface FinanceBackup {
  version: 1;
  exportedAt: string;
  records: FinanceRecord[];
}

