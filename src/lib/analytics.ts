import type { AlarmCategory, AlarmRecord, AnnualAlarmVolume, AnnualMonthVolume, DashboardFilters, DaypartActuationRow, DaypartActuationSummary, InventoryAsset, ItsmIncident, RankedEntity } from "../types/operadora";
import { normalizeIssueKey } from "./itsm-join";

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function monthShortLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(year, month - 1, 1)).replace(/\.$/, "");
}

export function getAvailableMonths(records: AlarmRecord[]): string[] {
  return [...new Set(records.flatMap((record) => record.startedAt ? [monthKey(record.startedAt)] : []))].sort((a, b) => b.localeCompare(a));
}

export function getAvailableYears(records: AlarmRecord[]): number[] {
  return [...new Set(records.flatMap((record) => record.startedAt ? [record.startedAt.getFullYear()] : []))].sort((a, b) => b - a);
}

export function getDefaultMonth(records: AlarmRecord[]): string {
  const months = getAvailableMonths(records);
  if (!months.length) return "all";
  const [year, month] = months[0].split("-").map(Number);
  return monthKey(new Date(year, month - 2, 1));
}

export function isLinkRecord(record: Pick<AlarmRecord, "sourceType" | "device">): boolean {
  const type = record.sourceType.trim();
  const value = type || record.device.trim();
  return value.toLocaleUpperCase("pt-BR").startsWith("LINK");
}

export function isIncidentRecord(record: Pick<AlarmRecord, "durationMinutes" | "classification">): boolean {
  return record.durationMinutes !== null && record.durationMinutes >= 40;
}

export function filterByCategoryAll(records: AlarmRecord[], category: AlarmCategory): AlarmRecord[] {
  return records.filter((record) => isLinkRecord(record) === (category === "links"));
}

export function filterByCategory(records: AlarmRecord[], category: AlarmCategory): AlarmRecord[] {
  return filterByCategoryAll(records, category).filter(isIncidentRecord);
}

export function getDefaultCategory(records: AlarmRecord[]): AlarmCategory {
  return filterByCategoryAll(records, "links").length > 0 ? "links" : "devices";
}

function dateBound(value: string, endOfDay: boolean): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return endOfDay ? new Date(year, month - 1, day, 23, 59, 59, 999) : new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function dateInPeriod(filters: Pick<DashboardFilters, "month" | "from" | "to">) {
  const from = dateBound(filters.from, false);
  const to = dateBound(filters.to, true);
  return (date: Date | null) => {
    if (!date || Number.isNaN(date.getTime())) return filters.month === "all" && !from && !to;
    return (filters.month === "all" || monthKey(date) === filters.month) && (!from || date >= from) && (!to || date <= to);
  };
}

function includes(value: string, filter: string): boolean {
  return !filter || value.toLocaleLowerCase("pt-BR") === filter.toLocaleLowerCase("pt-BR");
}

export function normalizeLocalityKey(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}

export function filterRecords(records: AlarmRecord[], filters: DashboardFilters): AlarmRecord[] {
  const inPeriod = dateInPeriod(filters);
  const query = filters.search.trim().toLocaleLowerCase("pt-BR");
  return records.filter((record) => {
    if (!inPeriod(record.startedAt)) return false;
    if (!includes(record.operator, filters.operator)) return false;
    if (filters.locality && normalizeLocalityKey(record.locality) !== normalizeLocalityKey(filters.locality)) return false;
    if (!includes(record.responsible, filters.responsible)) return false;
    if (!includes(record.deviceType, filters.deviceType)) return false;
    if (!includes(record.sourceType, filters.sourceType)) return false;
    if (!includes(record.trap, filters.trap)) return false;
    if (!includes(record.itsmMatch?.ticket?.status ?? "", filters.itsmStatus)) return false;
    if (!includes(record.itsmMatch?.ticket?.responsible ?? "", filters.itsmResponsible)) return false;
    if (query) {
      const searchable = [record.alarm, record.device, record.sourceType, record.operator, record.locality, record.responsible, record.ticket, record.comment, record.trap, record.itsmMatch?.ticket?.key, record.itsmMatch?.ticket?.summary, record.itsmMatch?.ticket?.responsible, record.itsmMatch?.ticket?.status].join(" ").toLocaleLowerCase("pt-BR");
      if (!searchable.includes(query)) return false;
    }
    return true;
  });
}

export function filterRecordsByAlarmPeriod(records: AlarmRecord[], filters: DashboardFilters): AlarmRecord[] {
  const periodFilters: DashboardFilters = {
    month: filters.month,
    from: filters.from,
    to: filters.to,
    operator: "",
    locality: "",
    responsible: "",
    deviceType: "",
    sourceType: "",
    trap: "",
    itsmStatus: "",
    itsmResponsible: "",
    search: "",
  };
  return filterRecords(records, periodFilters).filter((record) => record.startedAt && !Number.isNaN(record.startedAt.getTime()));
}

export function getDowntime(records: AlarmRecord[]): number {
  return records.reduce((total, record) => total + (record.durationMinutes ?? 0), 0);
}

export interface NetDowntimeSummary {
  grossMinutes: number;
  netMinutes: number;
  overlapMinutes: number;
  eligibleIntervals: number;
  excludedIntervals: number;
}

export interface FlappingRow extends RankedEntity {
  windowCount: number;
  windowMinutes: number;
  frequencyPerHour: number;
}

function intervalForRecord(record: AlarmRecord): { start: number; end: number } | null {
  if (!record.startedAt || Number.isNaN(record.startedAt.getTime()) || !record.device.trim()) return null;
  const start = record.startedAt.getTime();
  const durationEnd = record.durationMinutes !== null && Number.isFinite(record.durationMinutes) && record.durationMinutes >= 0
    ? start + record.durationMinutes * 60_000
    : null;
  const explicitEnd = record.endedAt && !Number.isNaN(record.endedAt.getTime()) ? record.endedAt.getTime() : null;
  const end = durationEnd ?? explicitEnd;
  return end !== null && end > start ? { start, end } : null;
}

/** Une intervalos por ativo, preservando a soma bruta para auditoria. */
export function getNetDowntime(records: AlarmRecord[]): NetDowntimeSummary {
  const intervalsByAsset = new Map<string, Array<{ start: number; end: number }>>();
  let grossMinutes = 0;
  let eligibleIntervals = 0;
  let excludedIntervals = 0;
  for (const record of records) {
    if (record.durationMinutes !== null && Number.isFinite(record.durationMinutes) && record.durationMinutes >= 0) grossMinutes += record.durationMinutes;
    const interval = intervalForRecord(record);
    if (!interval) {
      excludedIntervals += 1;
      continue;
    }
    eligibleIntervals += 1;
    const key = normalizeAssetId(record.device);
    const items = intervalsByAsset.get(key) ?? [];
    items.push(interval);
    intervalsByAsset.set(key, items);
  }

  let netMinutes = 0;
  for (const intervals of intervalsByAsset.values()) {
    intervals.sort((a, b) => a.start - b.start || a.end - b.end);
    let current = intervals[0];
    for (const next of intervals.slice(1)) {
      if (next.start <= current.end) {
        current = { start: current.start, end: Math.max(current.end, next.end) };
      } else {
        netMinutes += (current.end - current.start) / 60_000;
        current = next;
      }
    }
    if (current) netMinutes += (current.end - current.start) / 60_000;
  }
  return { grossMinutes, netMinutes, overlapMinutes: Math.max(0, grossMinutes - netMinutes), eligibleIntervals, excludedIntervals };
}

/** Identifica ativos com pelo menos quatro oscilações dentro da janela móvel padrão de duas horas. */
export function getFlappingRows(records: AlarmRecord[], windowMinutes = 120, threshold = 4, limit = 5): FlappingRow[] {
  const byAsset = new Map<string, Array<{ startedAt: number; duration: number }>>();
  for (const record of records) {
    if (!record.device.trim() || !record.startedAt || Number.isNaN(record.startedAt.getTime())) continue;
    const key = normalizeAssetId(record.device);
    const items = byAsset.get(key) ?? [];
    items.push({ startedAt: record.startedAt.getTime(), duration: record.durationMinutes ?? 0 });
    byAsset.set(key, items);
  }
  const rows: FlappingRow[] = [];
  for (const [name, items] of byAsset.entries()) {
    items.sort((a, b) => a.startedAt - b.startedAt);
    let bestStart = 0;
    let bestEnd = 0;
    for (let end = 0, start = 0; end < items.length; end += 1) {
      while (items[end].startedAt - items[start].startedAt > windowMinutes * 60_000) start += 1;
      if (end - start > bestEnd - bestStart) {
        bestStart = start;
        bestEnd = end;
      }
    }
    const windowCount = bestEnd - bestStart + 1;
    if (windowCount < threshold) continue;
    const windowDuration = items.slice(bestStart, bestEnd + 1).reduce((sum, item) => sum + item.duration, 0);
    rows.push({ name, alarms: windowCount, downtimeMinutes: windowDuration, windowCount, windowMinutes, frequencyPerHour: windowCount / (windowMinutes / 60) });
  }
  return rows.sort((a, b) => b.windowCount - a.windowCount || b.downtimeMinutes - a.downtimeMinutes || a.name.localeCompare(b.name, "pt-BR")).slice(0, limit);
}

export interface AvailabilitySummary {
  hoursPerAsset: number | null;
  monitoredAssets: number;
  totalHours: number | null;
  downtimeHours: number;
  availableHours: number | null;
  percent: number | null;
  excludedRecords: number;
  excludedRows: AvailabilityExcludedRow[];
  unmatchedAssets: AvailabilityUnmatchedAsset[];
  localityIssueAssets: number;
  operatorIssueAssets: number;
  status: "available" | "no-period" | "no-inventory" | "no-assets" | "no-match" | "no-locality-column" | "incomplete-locality" | "no-locality-assets" | "no-operator-column" | "incomplete-operator" | "no-operator-assets" | "exceeds-period";
}

export interface AvailabilityExcludedRow {
  sourceRow: number;
  reason: "Sem Horário Inicial" | "Sem host/Dispositivo" | "Sem data e host/Dispositivo";
}

export interface AvailabilityUnmatchedAsset {
  name: string;
  sourceRows: number[];
}

export interface MtfbRow {
  operator: string;
  locality: string;
  failures: number;
  intervals: number;
  mtfbMinutes: number | null;
  medianMinutes: number | null;
  minMinutes: number | null;
  maxMinutes: number | null;
  quality: "base suficiente" | "amostra pequena" | "sem base";
  intervalMinutes: number[];
}

export interface MtfbSummary {
  meanMinutes: number | null;
  medianMinutes: number | null;
  intervals: number;
  groupsWithBase: number;
  groupsWithoutBase: number;
}

function normalizeAssetId(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR");
}

export function getAvailability(records: AlarmRecord[], filteredRecords: AlarmRecord[], filters: DashboardFilters, inventoryAssets: InventoryAsset[] | null, inventoryLocalityMapped: boolean, inventoryOperatorMapped = false): AvailabilitySummary {
  const excludedRows = filteredRecords.flatMap((record): AvailabilityExcludedRow[] => {
    const missingDate = !record.startedAt || Number.isNaN(record.startedAt.getTime());
    const missingHost = !record.hasDeviceIdentifier || !record.device.trim();
    if (!missingDate && !missingHost) return [];
    const reason: AvailabilityExcludedRow["reason"] = missingDate && missingHost ? "Sem data e host/Dispositivo" : missingDate ? "Sem Horário Inicial" : "Sem host/Dispositivo";
    return [{ sourceRow: record.sourceRow, reason }];
  });
  const excludedRecords = excludedRows.length;
  const empty = (status: AvailabilitySummary["status"], hoursPerAsset: number | null = null, monitoredAssets = 0, totalHours: number | null = null, unmatchedAssets: AvailabilityUnmatchedAsset[] = [], localityIssueAssets = 0, operatorIssueAssets = 0): AvailabilitySummary => ({ hoursPerAsset, monitoredAssets, totalHours, downtimeHours: 0, availableHours: null, percent: null, excludedRecords, excludedRows, unmatchedAssets, localityIssueAssets, operatorIssueAssets, status });
  const noPeriod = () => empty("no-period");
  const datedRecords = records.flatMap((record) => record.startedAt && !Number.isNaN(record.startedAt.getTime()) ? [record.startedAt] : []);
  const from = dateBound(filters.from, false);
  const to = dateBound(filters.to, true);
  let periodStart: Date;
  let periodEnd: Date;
  if (filters.month !== "all") {
    const [year, month] = filters.month.split("-").map(Number);
    if (!year || month < 1 || month > 12) return noPeriod();
    periodStart = new Date(year, month - 1, 1);
    periodEnd = new Date(year, month, 0);
  } else if (from && to) {
    periodStart = from;
    periodEnd = to;
  } else {
    if (!datedRecords.length) return noPeriod();
    const timestamps = datedRecords.map((date) => date.getTime());
    const earliest = new Date(Math.min(...timestamps));
    const latest = new Date(Math.max(...timestamps));
    periodStart = from ?? new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    periodEnd = to ?? new Date(latest.getFullYear(), latest.getMonth() + 1, 0);
  }

  if (from && from > periodStart) periodStart = from;
  if (to && to < periodEnd) periodEnd = to;
  if (periodStart > periodEnd) return noPeriod();

  const startDay = Date.UTC(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
  const endDay = Date.UTC(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
  const hoursPerAsset = (Math.floor((endDay - startDay) / 86_400_000) + 1) * 24;
  const periodRecords = filteredRecords.filter((record) => {
    if (!record.startedAt || Number.isNaN(record.startedAt.getTime()) || !record.hasDeviceIdentifier || !record.device.trim()) return false;
    const day = Date.UTC(record.startedAt.getFullYear(), record.startedAt.getMonth(), record.startedAt.getDate());
    return day >= startDay && day <= endDay;
  });
  if (inventoryAssets === null) return empty("no-inventory", hoursPerAsset);
  let scopedInventoryAssets = inventoryAssets;
  if (filters.operator) {
    if (!inventoryOperatorMapped) return empty("no-operator-column", hoursPerAsset, 0, null, [], 0, inventoryAssets.length);
    const selectedOperator = normalizeLocalityKey(filters.operator);
    scopedInventoryAssets = scopedInventoryAssets.filter((asset) => asset.operator && normalizeLocalityKey(asset.operator) === selectedOperator);
    if (!scopedInventoryAssets.length) return empty("no-operator-assets", hoursPerAsset);
    const incompleteAssets = scopedInventoryAssets.filter((asset) => !asset.operator || asset.operatorMissing || asset.operatorConflict);
    if (incompleteAssets.length) return empty("incomplete-operator", hoursPerAsset, scopedInventoryAssets.length, null, [], 0, incompleteAssets.length);
  }
  if (filters.locality) {
    if (!inventoryLocalityMapped) return empty("no-locality-column", hoursPerAsset, 0, null, [], inventoryAssets.length);
    const selectedLocality = normalizeLocalityKey(filters.locality);
    scopedInventoryAssets = scopedInventoryAssets.filter((asset) => asset.locality && normalizeLocalityKey(asset.locality) === selectedLocality);
    const incompleteAssets = scopedInventoryAssets.filter((asset) => !asset.locality || asset.localityMissing || asset.localityConflict);
    if (incompleteAssets.length) return empty("incomplete-locality", hoursPerAsset, scopedInventoryAssets.length, null, [], incompleteAssets.length);
    if (!scopedInventoryAssets.length) return empty("no-locality-assets", hoursPerAsset);
  }

  const unmatchedById = new Map<string, { name: string; rows: Set<number> }>();
  const inventoryIds = new Set(scopedInventoryAssets.map((asset) => normalizeAssetId(asset.id)).filter(Boolean));
  {
    for (const record of periodRecords) {
      const id = normalizeAssetId(record.device);
      if (!id || inventoryIds.has(id)) continue;
      const issue = unmatchedById.get(id) ?? { name: record.device.trim(), rows: new Set<number>() };
      issue.rows.add(record.sourceRow);
      unmatchedById.set(id, issue);
    }
  }
  const unmatchedAssets = [...unmatchedById.values()].map(({ name, rows }) => ({ name, sourceRows: [...rows].sort((a, b) => a - b) }));
  const monitoredAssets = inventoryIds.size;
  if (!monitoredAssets) return empty("no-assets", hoursPerAsset, 0, null, unmatchedAssets);

  const totalHours = hoursPerAsset * monitoredAssets;
  const matchedRecords = periodRecords.filter((record) => inventoryIds.has(normalizeAssetId(record.device)));
  if (filteredRecords.length > 0 && excludedRecords === filteredRecords.length && periodRecords.length === 0) {
    return empty("no-period", hoursPerAsset, monitoredAssets, totalHours, unmatchedAssets);
  }
  if (periodRecords.length === 0) return empty("no-match", hoursPerAsset, monitoredAssets, totalHours, unmatchedAssets);
  if (unmatchedAssets.length > 0 && matchedRecords.length === 0) {
    return empty("no-match", hoursPerAsset, monitoredAssets, totalHours, unmatchedAssets);
  }

  const downtimeHours = getDowntime(matchedRecords) / 60;
  if (downtimeHours > totalHours) {
    return { ...empty("exceeds-period", hoursPerAsset, monitoredAssets, totalHours, unmatchedAssets), downtimeHours };
  }

  const availableHours = totalHours - downtimeHours;
  return { ...empty("available", hoursPerAsset, monitoredAssets, totalHours, unmatchedAssets), downtimeHours, availableHours, percent: totalHours ? (availableHours / totalHours) * 100 : null };
}

export interface ItsmTechnicianRanking {
  rows: RankedEntity[];
  uniqueTickets: number;
  duplicateRows: number;
  missingKeyRows: number;
  unassignedTickets: number;
  periodAlarmRows: number;
  unmatchedAlarmRows: number;
}

export function rankItsmTicketsByResponsible(records: ItsmIncident[], limit = 5): ItsmTechnicianRanking {
  const ticketsByKey = new Map<string, ItsmIncident>();
  let duplicateRows = 0;
  let missingKeyRows = 0;
  for (const record of records) {
    const key = normalizeIssueKey(record.key);
    if (!key) {
      missingKeyRows += 1;
      continue;
    }
    const current = ticketsByKey.get(key);
    if (!current) {
      ticketsByKey.set(key, record);
      continue;
    }
    duplicateRows += 1;
    const currentUpdatedAt = current.updatedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const candidateUpdatedAt = record.updatedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (candidateUpdatedAt > currentUpdatedAt || (candidateUpdatedAt === currentUpdatedAt && record.sourceRow >= current.sourceRow)) {
      ticketsByKey.set(key, record);
    }
  }

  const uniqueTickets = [...ticketsByKey.values()];
  const unassignedTickets = uniqueTickets.filter((record) => !record.responsible.trim()).length;
  const counts = new Map<string, number>();
  for (const record of uniqueTickets) {
    const technician = record.responsible.trim() || "Sem responsável atribuído";
    counts.set(technician, (counts.get(technician) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([name, alarms]) => ({ name, alarms, downtimeMinutes: 0 }))
    .sort((a, b) => b.alarms - a.alarms || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, limit);
  return {
    rows,
    uniqueTickets: uniqueTickets.length,
    duplicateRows,
    missingKeyRows,
    unassignedTickets,
    periodAlarmRows: 0,
    unmatchedAlarmRows: 0,
  };
}

export function rankItsmTicketsForAlarmPeriod(itsmRecords: ItsmIncident[], alarmPeriodRecords: AlarmRecord[], limit = 5): ItsmTechnicianRanking {
  const periodTicketKeys = new Set<string>();
  let matchedAlarmRows = 0;
  for (const record of alarmPeriodRecords) {
    const match = record.itsmMatch;
    if (!match || (match.status !== "matched-key" && match.status !== "matched-internal") || !match.ticket) continue;
    const key = normalizeIssueKey(match.ticket.key);
    if (!key) continue;
    periodTicketKeys.add(key);
    matchedAlarmRows += 1;
  }

  const periodTickets = itsmRecords.filter((ticket) => periodTicketKeys.has(normalizeIssueKey(ticket.key)));
  const ranking = rankItsmTicketsByResponsible(periodTickets, limit);
  return {
    ...ranking,
    missingKeyRows: itsmRecords.filter((ticket) => !normalizeIssueKey(ticket.key)).length,
    periodAlarmRows: alarmPeriodRecords.length,
    unmatchedAlarmRows: alarmPeriodRecords.length - matchedAlarmRows,
  };
}

export function formatHours(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

export function getMttr(records: AlarmRecord[]): { minutes: number | null; included: number } {
  const durations = records.flatMap((record) => record.durationMinutes !== null && record.durationMinutes >= 0 ? [record.durationMinutes] : []);
  return { minutes: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null, included: durations.length };
}

/**
 * Calcula o tempo médio entre falhas consecutivas no mesmo par operadora/localidade.
 * Sem um ID de incidente, cada linha datada é tratada como um evento de falha e o
 * resultado é explicitamente uma aproximação operacional, não um MTBF de incidente.
 */
export function getMtfbByOperatorLocality(records: AlarmRecord[]): MtfbRow[] {
  const groups = new Map<string, { operator: string; locality: string; timestamps: number[] }>();
  for (const record of records) {
    if (!record.startedAt || Number.isNaN(record.startedAt.getTime())) continue;
    const operator = record.operator.trim() || "Não informada";
    const locality = record.locality.trim() || "Não informada";
    const key = `${operator}\u0000${locality}`;
    const group = groups.get(key) ?? { operator, locality, timestamps: [] };
    group.timestamps.push(record.startedAt.getTime());
    groups.set(key, group);
  }

  return [...groups.values()]
    .map(({ operator, locality, timestamps }) => {
      timestamps.sort((a, b) => a - b);
      const gaps = timestamps.slice(1).map((timestamp, index) => Math.max(0, (timestamp - timestamps[index]) / 60_000));
      const orderedGaps = [...gaps].sort((a, b) => a - b);
      const middle = Math.floor(orderedGaps.length / 2);
      const medianMinutes = orderedGaps.length ? orderedGaps.length % 2 ? orderedGaps[middle] : (orderedGaps[middle - 1] + orderedGaps[middle]) / 2 : null;
      return {
        operator,
        locality,
        failures: timestamps.length,
        intervals: gaps.length,
        mtfbMinutes: gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : null,
        medianMinutes,
        minMinutes: orderedGaps[0] ?? null,
        maxMinutes: orderedGaps[orderedGaps.length - 1] ?? null,
        quality: (gaps.length >= 3 ? "base suficiente" : gaps.length ? "amostra pequena" : "sem base") as MtfbRow["quality"],
        intervalMinutes: gaps,
      };
    })
    .sort((a, b) => {
      if (a.mtfbMinutes === null && b.mtfbMinutes !== null) return 1;
      if (b.mtfbMinutes === null && a.mtfbMinutes !== null) return -1;
      return (a.mtfbMinutes ?? Number.POSITIVE_INFINITY) - (b.mtfbMinutes ?? Number.POSITIVE_INFINITY)
        || b.failures - a.failures
        || a.operator.localeCompare(b.operator, "pt-BR")
        || a.locality.localeCompare(b.locality, "pt-BR");
    });
}

export function getMtfbSummary(rows: MtfbRow[]): MtfbSummary {
  const validRows = rows.filter((row) => row.intervals > 0 && row.mtfbMinutes !== null);
  const intervals = validRows.reduce((sum, row) => sum + row.intervals, 0);
  const weightedMean = intervals ? validRows.reduce((sum, row) => sum + (row.mtfbMinutes ?? 0) * row.intervals, 0) / intervals : null;
  const allIntervals = validRows.flatMap((row) => row.intervalMinutes);
  const medianMinutes = allIntervals.length ? (() => { const ordered = [...allIntervals].sort((a, b) => a - b); const middle = Math.floor(ordered.length / 2); return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2; })() : null;
  return { meanMinutes: weightedMean, medianMinutes, intervals, groupsWithBase: validRows.length, groupsWithoutBase: rows.length - validRows.length };
}

export function getAcknowledgement(records: AlarmRecord[]): { acted: number; total: number; percent: number | null } {
  const acted = records.filter((record) => record.responsible.toLocaleLowerCase("pt-BR").includes("noc-solor")).length;
  return { acted, total: records.length, percent: records.length ? (acted / records.length) * 100 : null };
}

export function getDaypartActuation(records: AlarmRecord[]): DaypartActuationSummary {
  const buckets: DaypartActuationRow[] = [
    { key: "madrugada", label: "Madrugada", range: "00:00–06:00", startMinute: 0, total: 0, acted: 0, percent: null },
    { key: "diurno", label: "Diurno", range: "06:00–12:00", startMinute: 360, total: 0, acted: 0, percent: null },
    { key: "tarde", label: "Tarde", range: "12:00–18:00", startMinute: 720, total: 0, acted: 0, percent: null },
    { key: "noturno", label: "Noturno", range: "18:00–00:00", startMinute: 1080, total: 0, acted: 0, percent: null },
  ];
  let unclassified = 0;
  for (const record of records) {
    if (!record.startedAt || Number.isNaN(record.startedAt.getTime())) {
      unclassified += 1;
      continue;
    }
    const minute = record.startedAt.getHours() * 60 + record.startedAt.getMinutes();
    const index = minute < 360 ? 0 : minute < 720 ? 1 : minute < 1080 ? 2 : 3;
    const bucket = buckets[index];
    bucket.total += 1;
    if (record.responsible.toLocaleLowerCase("pt-BR").includes("noc-solor")) bucket.acted += 1;
  }
  for (const bucket of buckets) bucket.percent = bucket.total ? (bucket.acted / bucket.total) * 100 : null;
  buckets.sort((a, b) => {
    if (a.percent === null && b.percent !== null) return 1;
    if (b.percent === null && a.percent !== null) return -1;
    return (a.percent ?? 0) - (b.percent ?? 0) || a.startMinute - b.startMinute;
  });
  return { rows: buckets, unclassified };
}

export function getAnnualAlarmVolume(records: AlarmRecord[], coverageRecords: AlarmRecord[], year: number): AnnualAlarmVolume {
  const coverageMonths = coverageRecords.flatMap((record) => record.startedAt?.getFullYear() === year ? [record.startedAt.getMonth() + 1] : []);
  if (!coverageMonths.length) return { months: [], median: null };
  const first = Math.min(...coverageMonths);
  const last = Math.max(...coverageMonths);
  const counts = new Map<number, number>();
  for (const record of records) {
    if (!record.startedAt || record.startedAt.getFullYear() !== year) continue;
    const month = record.startedAt.getMonth() + 1;
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  const months: AnnualMonthVolume[] = [];
  for (let month = first; month <= last; month += 1) {
    months.push({ key: `${year}-${String(month).padStart(2, "0")}`, label: monthShortLabel(year, month), alarms: counts.get(month) ?? 0 });
  }
  const ordered = months.map((item) => item.alarms).sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  const median = ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  return { months, median };
}

function groupedRecords(records: AlarmRecord[], key: (record: AlarmRecord) => string, keepRowsWithoutDuration: boolean): RankedEntity[] {
  const groups = new Map<string, RankedEntity>();
  records.forEach((record) => {
    if (!keepRowsWithoutDuration && record.durationMinutes === null) return;
    const name = key(record).trim() || "Não informada";
    const current = groups.get(name) ?? { name, alarms: 0, downtimeMinutes: 0 };
    current.alarms += 1;
    current.downtimeMinutes += record.durationMinutes ?? 0;
    groups.set(name, current);
  });
  return [...groups.values()];
}

export function rankBy(records: AlarmRecord[], key: (record: AlarmRecord) => string, limit = 5): RankedEntity[] {
  return groupedRecords(records, key, false).sort((a, b) => b.downtimeMinutes - a.downtimeMinutes || b.alarms - a.alarms || a.name.localeCompare(b.name, "pt-BR")).slice(0, limit);
}

export function rankByIncidentCount(records: AlarmRecord[], key: (record: AlarmRecord) => string, limit = 5): RankedEntity[] {
  return groupedRecords(records, key, true).sort((a, b) => b.alarms - a.alarms || b.downtimeMinutes - a.downtimeMinutes || a.name.localeCompare(b.name, "pt-BR")).slice(0, limit);
}

export function formatMinutes(value: number | null, compact = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const total = Math.max(0, Math.round(value));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  if (compact) {
    if (days) return `${days}d ${String(hours).padStart(2, "0")}h`;
    if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    return `${minutes}m`;
  }
  if (days) return `${days} d ${hours} h ${minutes} min`;
  if (hours) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

export function formatDate(value: Date | null): string {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value) + "%";
}

export function uniqueValues(records: AlarmRecord[], key: keyof Pick<AlarmRecord, "operator" | "locality" | "responsible" | "deviceType" | "sourceType" | "trap">): string[] {
  return [...new Set(records.map((record) => record[key]).filter((value) => value.trim()))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
