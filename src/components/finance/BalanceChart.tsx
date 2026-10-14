"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { localDateString } from "@/lib/format";
import type { FinanceRecord } from "@/types/finance";

const monthLabel = new Intl.DateTimeFormat("es", { month: "short" });

function buildSeries(records: FinanceRecord[], months = 6) {
  const flows = records.filter((record) => record.kind === "income" || record.kind === "expense");
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const end = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index) + 1, 0);
    const limit = localDateString(end);
    const balance = flows
      .filter((record) => record.date <= limit)
      .reduce((sum, record) => sum + (record.kind === "income" ? record.amount : -record.amount), 0);
    return { month: monthLabel.format(end).replace(".", ""), balance };
  });
}

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export function BalanceChart({ records, detailed = false }: { records: FinanceRecord[]; detailed?: boolean }) {
  const data = useMemo(() => buildSeries(records), [records]);
  if (!records.some((record) => record.kind === "income" || record.kind === "expense")) {
    return (
      <div className={`chart-empty ${detailed ? "h-[320px]" : "h-[230px]"}`}>
        Registra ingresos y gastos para ver tu evolución.
      </div>
    );
  }
  return (
    <div className={detailed ? "h-[320px] w-full" : "h-[230px] w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#65a6ff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#65a6ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#737783", fontSize: 13 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#737783", fontSize: 13 }}
            tickFormatter={money}
            width={54}
          />
          <Tooltip
            contentStyle={{
              background: "var(--chart-tooltip-bg)",
              border: "1px solid var(--chart-tooltip-border)",
              borderRadius: 12,
              color: "var(--chart-tooltip-text)",
              fontSize: 14,
              backdropFilter: "blur(14px)",
            }}
            formatter={(value) => [money(Number(value)), "Balance"]}
            labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#65a6ff"
            strokeWidth={2.5}
            fill="url(#balanceFill)"
            activeDot={{ r: 5, strokeWidth: 0, fill: "#a9ceff" }}
            isAnimationActive
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
