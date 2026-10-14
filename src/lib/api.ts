import type { FinanceRecord } from "@/types/finance";

export class ApiError extends Error {
  constructor(public status: number) {
    super(`API error ${status}`);
  }
}

const BASE = "/api/proxy/records";

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new ApiError(res.status);
  return res.status === 204 ? null : res.json();
}

export const apiListRecords = (): Promise<FinanceRecord[]> => request("");
export const apiPutRecord = (record: FinanceRecord) =>
  request(`/${encodeURIComponent(record.id)}`, { method: "PUT", body: JSON.stringify(record) });
export const apiDeleteRecord = (id: string) => request(`/${encodeURIComponent(id)}`, { method: "DELETE" });
export const apiReplaceRecords = (records: FinanceRecord[]) =>
  request("", { method: "PUT", body: JSON.stringify(records) });
