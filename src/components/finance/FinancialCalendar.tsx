"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { nextChargeDate } from "@/lib/format";
import type { FinanceRecord } from "@/types/finance";

const colors: Record<string, string> = {
  income: "#22c55e",
  expense: "#ef4444",
  subscription: "#f59e0b",
  loan: "#3b82f6",
  goal: "#8b5cf6",
};

export function FinancialCalendar({ records }: { records: FinanceRecord[] }) {
  const events = records
    .filter((record) => !record.cancelled && ["income", "expense", "subscription", "loan", "goal"].includes(record.kind))
    .map((record) => ({
      id: record.id,
      title: record.name,
      date: record.kind === "subscription"
        ? nextChargeDate(record.dueDay, record.date)
        : record.date,
      backgroundColor: colors[record.kind],
      borderColor: colors[record.kind],
    }));

  return (
    <div className="calendar-shell">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "DÃ­a" }}
        locale="es"
        height="auto"
        events={events}
      />
    </div>
  );
}

