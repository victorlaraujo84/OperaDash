import type { DashboardFilters } from "../types/operadora";
import { monthKey, monthLabel } from "./analytics";

export interface MonthComparison {
  currentMonth: string;
  previousMonth: string;
  currentLabel: string;
  previousLabel: string;
  previousFilters: DashboardFilters;
}

export type TrendDirection = "up" | "down" | "flat" | "new" | "unavailable";

export interface TrendIndicator {
  direction: TrendDirection;
  text: string;
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function toDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function previousCalendarMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return monthKey(new Date(year, month - 2, 1));
}

function shiftDateBackOneMonth(value: string): string {
  const date = parseDateOnly(value);
  if (!date) return value;
  const targetFirst = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const lastDay = new Date(targetFirst.getFullYear(), targetFirst.getMonth() + 1, 0).getDate();
  return toDateOnly(new Date(targetFirst.getFullYear(), targetFirst.getMonth(), Math.min(date.getDate(), lastDay)));
}

export function getMonthComparison(filters: DashboardFilters): MonthComparison | null {
  const fromDate = filters.from ? parseDateOnly(filters.from) : null;
  const toDate = filters.to ? parseDateOnly(filters.to) : null;
  if ((filters.from && !fromDate) || (filters.to && !toDate)) return null;
  if (fromDate && toDate && fromDate > toDate) return null;

  let currentMonth = filters.month;
  let currentStart: Date;
  let currentEnd: Date;
  if (currentMonth === "all") {
    if (!fromDate || !toDate || monthKey(fromDate) !== monthKey(toDate)) return null;
    currentMonth = monthKey(fromDate);
    currentStart = fromDate;
    currentEnd = toDate;
  } else {
    if (!/^\d{4}-\d{2}$/.test(currentMonth)) return null;
    const [year, month] = currentMonth.split("-").map(Number);
    if (month < 1 || month > 12) return null;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    currentStart = fromDate && fromDate > monthStart ? fromDate : monthStart;
    currentEnd = toDate && toDate < monthEnd ? toDate : monthEnd;
    if (currentStart > currentEnd) return null;
  }
  if (!/^\d{4}-\d{2}$/.test(currentMonth)) return null;
  const month = Number(currentMonth.slice(5, 7));
  if (month < 1 || month > 12) return null;

  const previousMonth = previousCalendarMonth(currentMonth);
  const previousFilters: DashboardFilters = {
    ...filters,
    month: previousMonth,
    from: filters.from ? shiftDateBackOneMonth(toDateOnly(currentStart)) : "",
    to: filters.to ? shiftDateBackOneMonth(toDateOnly(currentEnd)) : "",
  };
  return {
    currentMonth,
    previousMonth,
    currentLabel: monthLabel(currentMonth),
    previousLabel: monthLabel(previousMonth),
    previousFilters,
  };
}

function signedValue(value: number, suffix: string): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Math.abs(rounded));
  if (rounded === 0) return `0,0${suffix}`;
  return `${rounded > 0 ? "+" : "−"}${formatted}${suffix}`;
}

export function getRelativeTrend(current: number | null, previous: number | null): TrendIndicator {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return { direction: "unavailable", text: "Sem base" };
  }
  if (previous === 0) {
    return current === 0 ? { direction: "flat", text: "0,0%" } : { direction: "new", text: "Novo" };
  }
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(delta) < 0.05) return { direction: "flat", text: "0,0%" };
  return { direction: delta > 0 ? "up" : "down", text: signedValue(delta, "%") };
}

export function getPercentagePointTrend(current: number | null, previous: number | null): TrendIndicator {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return { direction: "unavailable", text: "Sem base" };
  }
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return { direction: "flat", text: "0,0 p.p." };
  return { direction: delta > 0 ? "up" : "down", text: signedValue(delta, " p.p.") };
}

export function trendGlyph(direction: TrendDirection): string {
  if (direction === "up" || direction === "new") return "↑";
  if (direction === "down") return "↓";
  if (direction === "flat") return "→";
  return "—";
}

export function hasRankMetricBaseline(periodHasData: boolean, metric: "downtime" | "alarms", comparisonRows: readonly unknown[], comparisonRecordCount = comparisonRows.length): boolean {
  return periodHasData && (metric === "alarms" || comparisonRows.length > 0 || comparisonRecordCount === 0);
}

export interface RankComparisonSample<T extends { name: string }> {
  name: string;
  current: T | null;
  previous: T | null;
  currentRank: number | null;
  previousRank: number | null;
}

/** Builds an unbiased, compact sample from both periods' top-ranked entities. */
export function getRankComparisonSample<T extends { name: string }>(current: readonly T[], previous: readonly T[], limit = 5): RankComparisonSample<T>[] {
  const currentTop = current.slice(0, limit);
  const previousTop = previous.slice(0, limit);
  const currentByName = new Map(current.map((row) => [row.name, row]));
  const previousByName = new Map(previous.map((row) => [row.name, row]));
  const currentRanks = new Map(currentTop.map((row, index) => [row.name, index + 1]));
  const previousRanks = new Map(previousTop.map((row, index) => [row.name, index + 1]));
  const names = [...new Set([...currentTop, ...previousTop].map((row) => row.name))];

  return names.map((name) => ({
    name,
    current: currentByName.get(name) ?? null,
    previous: previousByName.get(name) ?? null,
    currentRank: currentRanks.get(name) ?? null,
    previousRank: previousRanks.get(name) ?? null,
  }));
}
