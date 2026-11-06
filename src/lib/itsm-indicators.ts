import type { AlarmRecord, ItsmIncident, ItsmMonthlyVolume, ItsmOperationalSummary, ItsmOscillationOffender, ItsmReasonBreakdown } from "../types/operadora";
import { monthKey } from "./analytics";
import { normalizeIssueKey } from "./itsm-join";

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(year, month - 1, 1)).replace(".", "");
}

function validDate(value: Date | null): value is Date {
  return Boolean(value && !Number.isNaN(value.getTime()));
}

function uniqueTickets(records: AlarmRecord[]): ItsmIncident[] {
  const tickets = new Map<string, ItsmIncident>();
  for (const record of records) {
    const ticket = record.itsmMatch?.ticket;
    const key = normalizeIssueKey(ticket?.key ?? "");
    if (!ticket || !key || tickets.has(key)) continue;
    tickets.set(key, ticket);
  }
  return [...tickets.values()];
}

export function getItsmOperationalSummary(records: AlarmRecord[]): ItsmOperationalSummary {
  const tickets = uniqueTickets(records);
  const resolutionDurations = tickets.flatMap((ticket) => {
    if (!validDate(ticket.createdAt) || !validDate(ticket.resolvedAt)) return [];
    const minutes = (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / 60_000;
    return minutes >= 0 ? [minutes] : [];
  });
  const durations = records.flatMap((record) => record.durationMinutes !== null && record.durationMinutes >= 0 ? [record.durationMinutes] : []);
  const oscillationRecords = records.filter((record) => record.durationMinutes !== null && record.durationMinutes >= 0 && record.durationMinutes < 40);
  const totalOscillationMinutes = oscillationRecords.reduce((sum, record) => sum + (record.durationMinutes ?? 0), 0);
  const offenderMap = new Map<string, ItsmOscillationOffender>();
  for (const record of oscillationRecords) {
    const name = record.device.trim() || "Ativo não identificado";
    const key = `${name}\u0000${record.operator}\u0000${record.locality}`;
    const current = offenderMap.get(key) ?? { name, operator: record.operator || "Sem operadora", locality: record.locality || "Sem localidade", alarms: 0, totalMinutes: 0, averageMinutes: 0, sharePercent: 0 };
    current.alarms += 1;
    current.totalMinutes += record.durationMinutes ?? 0;
    current.averageMinutes = current.totalMinutes / current.alarms;
    offenderMap.set(key, current);
  }
  const oscillationOffenders = [...offenderMap.values()].map((offender) => ({ ...offender, sharePercent: totalOscillationMinutes ? (offender.totalMinutes / totalOscillationMinutes) * 100 : 0 })).sort((a, b) => b.alarms - a.alarms || b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name, "pt-BR")).slice(0, 10);
  const reasonCounts = new Map<string, number>();
  for (const ticket of tickets) {
    const reason = ticket.reason?.trim() || ticket.itemType?.trim() || "Outros";
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const sortedReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  const otherReasonCount = sortedReasons
    .filter(([reason]) => reason === "Outros")
    .reduce((sum, [, count]) => sum + count, 0);
  const topReasons = sortedReasons.filter(([reason]) => reason !== "Outros").slice(0, 7);
  const excludedReasonCount = sortedReasons
    .filter(([reason]) => reason !== "Outros" && !topReasons.some(([topReason]) => topReason === reason))
    .reduce((sum, [, count]) => sum + count, 0);
  const totalOtherReasons = otherReasonCount + excludedReasonCount;
  const reasonBreakdown: ItsmReasonBreakdown[] = [
    ...topReasons.map(([reason, ticketsCount]) => ({ reason, tickets: ticketsCount, sharePercent: tickets.length ? (ticketsCount / tickets.length) * 100 : 0 })),
    ...(totalOtherReasons ? [{ reason: "Outros", tickets: totalOtherReasons, sharePercent: tickets.length ? (totalOtherReasons / tickets.length) * 100 : 0 }] : []),
  ];
  const monthlyMap = new Map<string, ItsmMonthlyVolume>();
  const ensureMonth = (key: string) => {
    const current = monthlyMap.get(key);
    if (current) return current;
    const next = { key, label: monthLabel(key), alarms: 0, ticketsOpened: 0, ticketsResolved: 0 };
    monthlyMap.set(key, next);
    return next;
  };
  for (const record of records) {
    if (validDate(record.startedAt)) ensureMonth(monthKey(record.startedAt)).alarms += 1;
  }
  for (const ticket of tickets) {
    if (validDate(ticket.createdAt)) ensureMonth(monthKey(ticket.createdAt)).ticketsOpened += 1;
    if (validDate(ticket.resolvedAt)) ensureMonth(monthKey(ticket.resolvedAt)).ticketsResolved += 1;
  }
  return {
    ticketsOpened: tickets.length,
    ticketsResolved: tickets.filter((ticket) => validDate(ticket.resolvedAt)).length,
    averageResolutionMinutes: resolutionDurations.length ? resolutionDurations.reduce((sum, value) => sum + value, 0) / resolutionDurations.length : null,
    resolutionSamples: resolutionDurations.length,
    oscillationUnder40: durations.filter((value) => value < 40).length,
    oscillationUpTo10: durations.filter((value) => value <= 10).length,
    oscillationUpTo25: durations.filter((value) => value <= 25).length,
    oscillationUpTo40: durations.filter((value) => value <= 40).length,
    oscillationOffenders,
    reasonBreakdown,
    monthly: [...monthlyMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}
